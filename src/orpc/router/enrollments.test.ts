import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { enrollmentClaims, enrollmentTokens } from '#/db/schema'
import { decryptSecret } from '#/lib/crypto'
import { claimEnrollment, hashEnrollmentToken } from '#/lib/enrollment'
import * as enrollments from './enrollments'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { rpc } from '#/test/rpc'
import { signIn } from '#/test/session'
import { auditActions, auditEntries } from '#/test/audit'

let db: TestDb
let callRpc: ReturnType<typeof rpc>

const baseUrl = 'https://book.example.com'

interface CreateResult {
  id: string
  kind: 'single' | 'permanent'
  token: string
  scripts: Record<string, string>
}

const create = (overrides: Record<string, unknown> = {}) =>
  callRpc(enrollments.create, {
    name: 'Fleet rollout',
    kind: 'permanent',
    installIfMissing: true,
    customer: 'Acme',
    tags: ['fleet', 'fleet'],
    rustdeskConfig: '',
    baseUrl,
    ...overrides,
  }) as Promise<CreateResult>

beforeEach(async () => {
  db = await createTestDb()
  callRpc = rpc(db)
  await createUser(db, { id: 'user-1', email: 'one@example.com' })
  await createUser(db, { id: 'user-2', email: 'two@example.com' })
  signIn({ id: 'user-1', email: 'one@example.com', role: 'member' })
  delete process.env.BETTER_AUTH_URL
})

afterEach(async () => {
  await db.$close()
  delete process.env.BETTER_AUTH_URL
})

describe('create', () => {
  it('returns the plaintext token once and stores only a digest', async () => {
    const result = await create()
    expect(result.token).toMatch(/^rdb_/)

    const [row] = await db.select().from(enrollmentTokens)
    expect(row.tokenHash).toBe(hashEnrollmentToken(result.token))
    expect(row.tokenPrefix).not.toBe(result.token)
    expect(row.tags).toEqual(['fleet'])
  })

  it('stores a reversible copy for permanent tokens only', async () => {
    const permanent = await create()
    const single = await create({ kind: 'single', name: 'One-shot' })

    const rows = await db.select().from(enrollmentTokens)
    const permanentRow = rows.find((r) => r.id === permanent.id)
    const singleRow = rows.find((r) => r.id === single.id)
    expect(decryptSecret(permanentRow!.tokenCipher!)).toBe(permanent.token)
    expect(singleRow!.tokenCipher).toBeNull()
  })

  it('emits deployment scripts carrying the token and base URL', async () => {
    const result = await create()
    const scripts = Object.values(result.scripts).join('\n')
    expect(scripts).toContain(result.token)
    expect(scripts).toContain(baseUrl)
  })

  it('refuses a plaintext base URL that is not loopback', async () => {
    await expect(
      create({ baseUrl: 'http://book.example.com' }),
    ).rejects.toThrow(/HTTPS/)
    await expect(
      create({ baseUrl: 'http://localhost:3000' }),
    ).resolves.toBeDefined()
  })

  it('prefers the configured public origin over the caller-supplied one', async () => {
    process.env.BETTER_AUTH_URL = 'https://configured.example.com'
    const result = await create({ baseUrl: 'https://spoofed.example.com' })
    const scripts = Object.values(result.scripts).join('\n')
    expect(scripts).toContain('https://configured.example.com')
    expect(scripts).not.toContain('spoofed.example.com')
  })
})

describe('list', () => {
  it('shows a member only their own tokens', async () => {
    await create()
    signIn({ id: 'user-2', email: 'two@example.com', role: 'member' })
    expect(await callRpc(enrollments.list)).toEqual([])
  })

  it('shows an admin every token', async () => {
    await create()
    signIn({ id: 'user-2', email: 'two@example.com', role: 'admin' })
    expect(await callRpc(enrollments.list)).toHaveLength(1)
  })

  it('never returns the token hash or ciphertext', async () => {
    await create()
    const [row] = (await callRpc(enrollments.list)) as Array<
      Record<string, unknown>
    >
    expect(row).not.toHaveProperty('tokenHash')
    expect(row).not.toHaveProperty('tokenCipher')
    expect(row.tokenPrefix).toBeTruthy()
  })
})

describe('scripts', () => {
  it('re-issues the scripts for a permanent token', async () => {
    const created = await create()
    const again = (await callRpc(enrollments.scripts, {
      id: created.id,
      baseUrl,
    })) as { rotated: boolean; scripts: Record<string, string> }

    expect(again.rotated).toBe(false)
    expect(Object.values(again.scripts).join('\n')).toContain(created.token)
  })

  it('rotates legacy tokens that predate reversible storage', async () => {
    const created = await create()
    await db
      .update(enrollmentTokens)
      .set({ tokenCipher: null })
      .where(eq(enrollmentTokens.id, created.id))

    const again = (await callRpc(enrollments.scripts, {
      id: created.id,
      baseUrl,
    })) as { rotated: boolean; scripts: Record<string, string> }

    expect(again.rotated).toBe(true)
    const [row] = await db.select().from(enrollmentTokens)
    const rotated = decryptSecret(row.tokenCipher!)
    expect(rotated).not.toBe(created.token)
    expect(row.tokenHash).toBe(hashEnrollmentToken(rotated))
    // The superseded token must no longer appear anywhere.
    expect(Object.values(again.scripts).join('\n')).not.toContain(created.token)
  })

  it('refuses single-use, revoked and foreign tokens', async () => {
    const single = await create({ kind: 'single', name: 'One-shot' })
    await expect(
      callRpc(enrollments.scripts, { id: single.id, baseUrl }),
    ).rejects.toThrow(/permanent tokens/)

    const revoked = await create({ name: 'Revoked' })
    await callRpc(enrollments.revoke, { id: revoked.id })
    await expect(
      callRpc(enrollments.scripts, { id: revoked.id, baseUrl }),
    ).rejects.toThrow(/Revoked tokens/)

    const mine = await create({ name: 'Mine' })
    signIn({ id: 'user-2', email: 'two@example.com', role: 'member' })
    await expect(
      callRpc(enrollments.scripts, { id: mine.id, baseUrl }),
    ).rejects.toThrow()
  })
})

describe('revoke', () => {
  it('stamps revokedAt and blocks further claims', async () => {
    const created = await create()
    expect(await callRpc(enrollments.revoke, { id: created.id })).toEqual({
      ok: true,
    })
    await expect(
      claimEnrollment(db as never, created.token, {
        rustdeskId: '123456789',
        alias: 'PC',
        hostname: '',
        os: '',
        rustdeskVersion: '',
      }),
    ).rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('reports failure for a token the caller cannot see', async () => {
    const created = await create()
    signIn({ id: 'user-2', email: 'two@example.com', role: 'member' })
    expect(await callRpc(enrollments.revoke, { id: created.id })).toEqual({
      ok: false,
    })
  })
})

describe('remove', () => {
  it('deletes an unused token', async () => {
    const created = await create()
    expect(await callRpc(enrollments.remove, { id: created.id })).toEqual({
      ok: true,
    })
    expect(await db.select().from(enrollmentTokens)).toHaveLength(0)
  })

  it('refuses while an enrollment claim is still open', async () => {
    const created = await create()
    await claimEnrollment(db as never, created.token, {
      rustdeskId: '123456789',
      alias: 'PC',
      hostname: '',
      os: '',
      rustdeskVersion: '',
    })
    await expect(
      callRpc(enrollments.remove, { id: created.id }),
    ).rejects.toThrow(/active enrollment/)
  })

  it('allows deletion once the claim has expired', async () => {
    const created = await create()
    await claimEnrollment(db as never, created.token, {
      rustdeskId: '123456789',
      alias: 'PC',
      hostname: '',
      os: '',
      rustdeskVersion: '',
    })
    await db
      .update(enrollmentClaims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
    expect(await callRpc(enrollments.remove, { id: created.id })).toEqual({
      ok: true,
    })
  })

  it('reports failure for a token the caller cannot see', async () => {
    const created = await create()
    signIn({ id: 'user-2', email: 'two@example.com', role: 'member' })
    expect(await callRpc(enrollments.remove, { id: created.id })).toEqual({
      ok: false,
    })
  })
})

describe('audit trail', () => {
  it('records creation with the prefix only, never the token', async () => {
    const created = await create()
    const [entry] = await auditEntries(db)
    expect(entry).toMatchObject({
      action: 'enrollment_token_created',
      targetType: 'enrollment_token',
      targetId: created.id,
      targetLabel: 'Fleet rollout',
    })
    expect(JSON.stringify(entry)).not.toContain(created.token)
    expect(entry.metadata).toMatchObject({ kind: 'permanent' })
  })

  it('records a revocation once, and nothing for a foreign token', async () => {
    const created = await create()
    await callRpc(enrollments.revoke, { id: created.id })
    expect(await auditActions(db)).toEqual([
      'enrollment_token_created',
      'enrollment_token_revoked',
    ])

    // A member may not revoke someone else's token: the update matches no row.
    signIn({ id: 'user-2', email: 'two@example.com', role: 'member' })
    const other = await create({ name: 'Other' })
    signIn({ id: 'user-1', email: 'one@example.com', role: 'member' })
    await callRpc(enrollments.revoke, { id: other.id })
    expect(await auditActions(db)).toEqual([
      'enrollment_token_created',
      'enrollment_token_revoked',
      'enrollment_token_created',
    ])
  })
})
