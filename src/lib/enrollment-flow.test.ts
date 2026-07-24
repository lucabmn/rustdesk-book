import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { devices, enrollmentClaims, enrollmentTokens } from '#/db/schema'
import { decryptSecret } from '#/lib/crypto'
import {
  claimEnrollment,
  EnrollmentError,
  finalizeEnrollment,
  generateEnrollmentToken,
  hashEnrollmentToken,
} from '#/lib/enrollment'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'

let db: TestDb

const claimInput = {
  rustdeskId: '123456789',
  alias: 'WORKSTATION-01',
  hostname: 'WORKSTATION-01',
  os: 'Windows 11 Pro',
  rustdeskVersion: '1.4.9',
}

async function seedToken(
  kind: 'single' | 'permanent',
  overrides: Partial<typeof enrollmentTokens.$inferInsert> = {},
) {
  const token = generateEnrollmentToken()
  const [row] = await db
    .insert(enrollmentTokens)
    .values({
      name: `${kind} token`,
      tokenHash: hashEnrollmentToken(token),
      tokenPrefix: token.slice(0, 12),
      kind,
      customer: 'Acme',
      tags: ['fleet'],
      createdBy: 'user-1',
      ...overrides,
    })
    .returning()
  return { token, row }
}

/** Claim + finalize in one step, the way a deployment script runs. */
async function enroll(
  token: string,
  input = claimInput,
  password = 'pw-123456',
) {
  const claim = await claimEnrollment(db as never, token, input)
  if (claim.alreadyEnrolled) return { claim, result: null }
  const result = await finalizeEnrollment(db as never, claim.claimToken, {
    password,
  })
  return { claim, result }
}

beforeEach(async () => {
  db = await createTestDb()
  await createUser(db)
})

afterEach(async () => {
  await db.$close()
})

describe('claimEnrollment', () => {
  it('issues a one-time claim token with a TTL', async () => {
    const { token } = await seedToken('single')
    const claim = await claimEnrollment(db as never, token, claimInput)

    expect(claim.alreadyEnrolled).toBe(false)
    if (claim.alreadyEnrolled) return
    expect(claim.claimToken).toMatch(/^rdc_[A-Za-z0-9_-]{43}$/)
    expect(new Date(claim.expiresAt).getTime()).toBeGreaterThan(Date.now())

    // Only the digest is persisted — never the bearer value.
    const [row] = await db.select().from(enrollmentClaims)
    expect(row.claimHash).toBe(hashEnrollmentToken(claim.claimToken))
    expect(row.claimHash).not.toContain(claim.claimToken)
  })

  it('rejects unknown and revoked tokens', async () => {
    await expect(
      claimEnrollment(db as never, 'rdb_nope', claimInput),
    ).rejects.toThrow(EnrollmentError)

    const { token } = await seedToken('permanent', { revokedAt: new Date() })
    await expect(
      claimEnrollment(db as never, token, claimInput),
    ).rejects.toMatchObject({ code: 'invalid_token', status: 401 })
  })

  it('refuses a device owned by a different enrollment token', async () => {
    const first = await seedToken('permanent')
    await enroll(first.token)
    const second = await seedToken('permanent')

    await expect(
      claimEnrollment(db as never, second.token, claimInput),
    ).rejects.toMatchObject({ code: 'device_exists', status: 409 })
  })

  it('refuses a second concurrent claim for the same device', async () => {
    const { token } = await seedToken('permanent')
    await claimEnrollment(db as never, token, claimInput)
    await expect(
      claimEnrollment(db as never, token, claimInput),
    ).rejects.toMatchObject({ code: 'device_claimed' })
  })

  it('refuses a single-use token that already holds an open claim', async () => {
    const { token } = await seedToken('single')
    await claimEnrollment(db as never, token, claimInput)
    await expect(
      claimEnrollment(db as never, token, {
        ...claimInput,
        rustdeskId: '222222222',
      }),
    ).rejects.toMatchObject({ code: 'token_claimed' })
  })

  it('lets a permanent token claim a second, different device', async () => {
    const { token } = await seedToken('permanent')
    await enroll(token)
    const second = await claimEnrollment(db as never, token, {
      ...claimInput,
      rustdeskId: '222222222',
      alias: 'WORKSTATION-02',
    })
    expect(second.alreadyEnrolled).toBe(false)
  })

  it('is idempotent for a completed single-use deployment', async () => {
    const { token } = await seedToken('single')
    const first = await enroll(token)
    const repeat = await claimEnrollment(db as never, token, claimInput)
    expect(repeat).toEqual({
      alreadyEnrolled: true,
      deviceId: first.result?.deviceId,
    })
  })

  it('refuses a used single-use token for a new device', async () => {
    const { token } = await seedToken('single')
    await enroll(token)
    await expect(
      claimEnrollment(db as never, token, {
        ...claimInput,
        rustdeskId: '222222222',
      }),
    ).rejects.toMatchObject({ code: 'token_used' })
  })

  it('reclaims after the previous claim expired', async () => {
    const { token } = await seedToken('permanent')
    await claimEnrollment(db as never, token, claimInput)
    await db
      .update(enrollmentClaims)
      .set({ expiresAt: new Date(Date.now() - 1000) })

    const retry = await claimEnrollment(db as never, token, claimInput)
    expect(retry.alreadyEnrolled).toBe(false)
    // The stale claim is cleaned up rather than accumulating.
    expect(await db.select().from(enrollmentClaims)).toHaveLength(1)
  })
})

describe('finalizeEnrollment', () => {
  it('creates the device with the token`s customer, tags and owner', async () => {
    const { token, row } = await seedToken('permanent')
    const { result } = await enroll(token)

    expect(result?.created).toBe(true)
    const [device] = await db.select().from(devices)
    expect(device.alias).toBe('WORKSTATION-01')
    expect(device.tags).toEqual(['fleet'])
    expect(device.enrollmentTokenId).toBe(row.id)
    expect(device.createdBy).toBe('user-1')
    expect(device.customerId).not.toBeNull()
    expect(decryptSecret(device.passwordCipher!)).toBe('pw-123456')
  })

  it('reuses an existing customer row instead of duplicating it', async () => {
    const first = await seedToken('permanent')
    await enroll(first.token)
    const second = await seedToken('permanent')
    await enroll(second.token, { ...claimInput, rustdeskId: '222222222' })

    const rows = await db.select().from(devices)
    expect(rows).toHaveLength(2)
    expect(rows[0].customerId).toBe(rows[1].customerId)
  })

  it('leaves the customer unset when the token has none', async () => {
    const { token } = await seedToken('permanent', { customer: null })
    await enroll(token)
    const [device] = await db.select().from(devices)
    expect(device.customerId).toBeNull()
  })

  it('is idempotent — a replayed claim token returns the same device', async () => {
    const { token } = await seedToken('single')
    const claim = await claimEnrollment(db as never, token, claimInput)
    if (claim.alreadyEnrolled) throw new Error('unexpected')

    const first = await finalizeEnrollment(db as never, claim.claimToken, {
      password: 'pw-123456',
    })
    const second = await finalizeEnrollment(db as never, claim.claimToken, {
      password: 'other-password',
    })

    expect(second).toEqual({ ...first, created: false })
    const [device] = await db.select().from(devices)
    // The replay must NOT overwrite the stored password.
    expect(decryptSecret(device.passwordCipher!)).toBe('pw-123456')
  })

  it('rejects an unknown or expired claim', async () => {
    await expect(
      finalizeEnrollment(db as never, 'rdc_nope', { password: 'pw-123456' }),
    ).rejects.toMatchObject({ code: 'invalid_claim', status: 401 })

    const { token } = await seedToken('permanent')
    const claim = await claimEnrollment(db as never, token, claimInput)
    if (claim.alreadyEnrolled) throw new Error('unexpected')
    await db
      .update(enrollmentClaims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
    await expect(
      finalizeEnrollment(db as never, claim.claimToken, {
        password: 'pw-123456',
      }),
    ).rejects.toMatchObject({ code: 'invalid_claim' })
  })

  it('still finalizes a claim whose token was revoked mid-deployment', async () => {
    const { token, row } = await seedToken('permanent')
    const claim = await claimEnrollment(db as never, token, claimInput)
    if (claim.alreadyEnrolled) throw new Error('unexpected')
    await db
      .update(enrollmentTokens)
      .set({ revokedAt: new Date() })
      .where(eq(enrollmentTokens.id, row.id))

    // The device password was already changed by the script — refusing here
    // would strand the machine with an unknown secret.
    await expect(
      finalizeEnrollment(db as never, claim.claimToken, {
        password: 'pw-123456',
      }),
    ).resolves.toMatchObject({ created: true })
  })

  it('updates the existing device on re-enrollment through the same token', async () => {
    const { token } = await seedToken('permanent')
    await enroll(token)
    const second = await enroll(
      token,
      { ...claimInput, alias: 'RENAMED' },
      'new-password',
    )

    expect(second.result?.created).toBe(false)
    const rows = await db.select().from(devices)
    expect(rows).toHaveLength(1)
    expect(rows[0].alias).toBe('RENAMED')
    expect(decryptSecret(rows[0].passwordCipher!)).toBe('new-password')
  })

  it('counts uses and stamps the timestamps', async () => {
    const { token, row } = await seedToken('single')
    await enroll(token)
    const [updated] = await db
      .select()
      .from(enrollmentTokens)
      .where(eq(enrollmentTokens.id, row.id))
    expect(updated.useCount).toBe(1)
    expect(updated.usedAt).not.toBeNull()
    expect(updated.lastUsedAt).not.toBeNull()
  })
})
