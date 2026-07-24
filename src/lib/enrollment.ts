import { createHash, randomBytes } from 'node:crypto'

import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import { z } from 'zod'

import type { db as Database } from '#/db'
import { customers, devices, enrollmentClaims, enrollmentTokens } from '#/db/schema'
import { encryptSecret } from '#/lib/crypto'

const RustdeskIdSchema = z
  .string()
  .trim()
  .regex(/^\d{6,12}$/, 'RustDesk ID must contain 6 to 12 digits.')

export const EnrollmentClaimSchema = z.object({
  rustdeskId: RustdeskIdSchema,
  alias: z.string().trim().min(1).max(120),
  hostname: z.string().trim().max(255).optional().default(''),
  os: z.string().trim().max(120).optional().default(''),
  rustdeskVersion: z.string().trim().max(80).optional().default(''),
})

export const EnrollmentFinalizeSchema = z.object({
  password: z.string().min(8).max(256),
})

export type EnrollmentClaimInput = z.infer<typeof EnrollmentClaimSchema>
export type EnrollmentFinalizeInput = z.infer<typeof EnrollmentFinalizeSchema>

export class EnrollmentError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'EnrollmentError'
  }
}

/** Create a high-entropy bearer token. The plaintext is returned only once. */
export function generateEnrollmentToken(): string {
  return `rdb_${randomBytes(32).toString('base64url')}`
}

function generateClaimToken(): string {
  return `rdc_${randomBytes(32).toString('base64url')}`
}

/** Stable lookup digest; bearer and claim tokens are never persisted. */
export function hashEnrollmentToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function enrollmentTokenPrefix(token: string): string {
  return `${token.slice(0, 12)}…`
}

const CLAIM_TTL_MS = 30 * 60 * 1000

async function lockRustdeskId(
  tx: Parameters<Parameters<typeof Database.transaction>[0]>[0],
  rustdeskId: string,
) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${rustdeskId}))`)
}

/**
 * Validate/reserve an enrollment before the deployment script changes the
 * permanent RustDesk password. A single-use token can only hold one active
 * device claim. Repeating a completed single-use deployment is idempotent.
 */
export async function claimEnrollment(
  db: typeof Database,
  rawToken: string,
  input: EnrollmentClaimInput,
): Promise<
  | { alreadyEnrolled: true; deviceId: string }
  | { alreadyEnrolled: false; claimToken: string; expiresAt: string }
> {
  const now = new Date()
  const tokenHash = hashEnrollmentToken(rawToken)

  return db.transaction(async (tx) => {
    const [token] = await tx
      .select()
      .from(enrollmentTokens)
      .where(eq(enrollmentTokens.tokenHash, tokenHash))
      .limit(1)
      .for('update')

    if (!token || token.revokedAt) {
      throw new EnrollmentError(401, 'invalid_token', 'Invalid or revoked enrollment token.')
    }

    await lockRustdeskId(tx, input.rustdeskId)
    const [existingDevice] = await tx
      .select({ id: devices.id, enrollmentTokenId: devices.enrollmentTokenId })
      .from(devices)
      .where(eq(devices.rustdeskId, input.rustdeskId))
      .limit(1)

    if (existingDevice && existingDevice.enrollmentTokenId !== token.id) {
      throw new EnrollmentError(
        409,
        'device_exists',
        'This RustDesk ID already exists and is not owned by this enrollment token.',
      )
    }

    if (token.kind === 'single' && existingDevice) {
      return { alreadyEnrolled: true, deviceId: existingDevice.id }
    }
    if (token.kind === 'single' && token.useCount > 0) {
      throw new EnrollmentError(
        409,
        'token_used',
        'This single-use token has already enrolled a device.',
      )
    }

    const activeForDevice = await tx
      .select({ id: enrollmentClaims.id, expiresAt: enrollmentClaims.expiresAt })
      .from(enrollmentClaims)
      .where(
        and(
          eq(enrollmentClaims.rustdeskId, input.rustdeskId),
          isNull(enrollmentClaims.finalizedAt),
        ),
      )
    if (activeForDevice.some((claim) => claim.expiresAt > now)) {
      throw new EnrollmentError(
        409,
        'device_claimed',
        'This RustDesk ID already has an active enrollment claim.',
      )
    }

    const pending = await tx
      .select({
        id: enrollmentClaims.id,
        rustdeskId: enrollmentClaims.rustdeskId,
        expiresAt: enrollmentClaims.expiresAt,
      })
      .from(enrollmentClaims)
      .where(
        and(
          eq(enrollmentClaims.tokenId, token.id),
          isNull(enrollmentClaims.finalizedAt),
        ),
      )

    const activeClaim = pending.find(
      (claim) =>
        claim.expiresAt > now &&
        (token.kind === 'single' || claim.rustdeskId === input.rustdeskId),
    )
    if (activeClaim) {
      throw new EnrollmentError(
        409,
        'token_claimed',
        'This enrollment token already has an active claim. Resume the existing deployment or wait for it to expire.',
      )
    }

    // Expired unfinished claims no longer reserve a token/device. Completed
    // claims remain available for idempotent finalize retries.
    await tx
      .delete(enrollmentClaims)
      .where(
        and(
          eq(enrollmentClaims.tokenId, token.id),
          isNull(enrollmentClaims.finalizedAt),
          lt(enrollmentClaims.expiresAt, now),
        ),
      )

    const claimToken = generateClaimToken()
    const expiresAt = new Date(now.getTime() + CLAIM_TTL_MS)
    await tx.insert(enrollmentClaims).values({
      tokenId: token.id,
      claimHash: hashEnrollmentToken(claimToken),
      rustdeskId: input.rustdeskId,
      alias: input.alias,
      osKey: input.os || null,
      rustdeskVersion: input.rustdeskVersion || null,
      expiresAt,
    })

    return {
      alreadyEnrolled: false,
      claimToken,
      expiresAt: expiresAt.toISOString(),
    }
  })
}

/** Finalize a claimed enrollment and atomically store its permanent password. */
export async function finalizeEnrollment(
  db: typeof Database,
  rawClaimToken: string,
  input: EnrollmentFinalizeInput,
): Promise<{ deviceId: string; rustdeskId: string; created: boolean }> {
  const now = new Date()
  const claimHash = hashEnrollmentToken(rawClaimToken)

  return db.transaction(async (tx) => {
    const [claimRef] = await tx
      .select({ id: enrollmentClaims.id, tokenId: enrollmentClaims.tokenId })
      .from(enrollmentClaims)
      .where(eq(enrollmentClaims.claimHash, claimHash))
      .limit(1)

    if (!claimRef) {
      throw new EnrollmentError(401, 'invalid_claim', 'Invalid or expired enrollment claim.')
    }

    // Lock in the same token → claim order used by claimEnrollment to avoid
    // deadlocks between a new claim and a finalize request.
    const [token] = await tx
      .select()
      .from(enrollmentTokens)
      .where(eq(enrollmentTokens.id, claimRef.tokenId))
      .limit(1)
      .for('update')
    const [claim] = await tx
      .select()
      .from(enrollmentClaims)
      .where(eq(enrollmentClaims.id, claimRef.id))
      .limit(1)
      .for('update')

    // Revocation blocks new claims, but a claim that already changed the
    // device password must still be allowed to finalize until it expires.
    if (!token || !claim) {
      throw new EnrollmentError(401, 'invalid_token', 'Invalid enrollment token.')
    }
    if (claim.finalizedAt && claim.deviceId) {
      return {
        deviceId: claim.deviceId,
        rustdeskId: claim.rustdeskId,
        created: false,
      }
    }
    if (claim.expiresAt <= now) {
      throw new EnrollmentError(401, 'invalid_claim', 'Invalid or expired enrollment claim.')
    }

    await lockRustdeskId(tx, claim.rustdeskId)
    const [existingDevice] = await tx
      .select({ id: devices.id, enrollmentTokenId: devices.enrollmentTokenId })
      .from(devices)
      .where(eq(devices.rustdeskId, claim.rustdeskId))
      .limit(1)

    if (existingDevice && existingDevice.enrollmentTokenId !== token.id) {
      throw new EnrollmentError(
        409,
        'device_exists',
        'This RustDesk ID already exists and is not owned by this enrollment token.',
      )
    }
    if (token.kind === 'single' && token.useCount > 0 && !existingDevice) {
      throw new EnrollmentError(
        409,
        'token_used',
        'This single-use token has already enrolled a device.',
      )
    }

    let customerId: string | null = null
    const customerName = token.customer?.trim()
    if (customerName) {
      const [existingCustomer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.name, customerName))
        .limit(1)
      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        const [createdCustomer] = await tx
          .insert(customers)
          .values({ name: customerName })
          .onConflictDoNothing()
          .returning({ id: customers.id })
        if (createdCustomer) {
          customerId = createdCustomer.id
        } else {
          const [racedCustomer] = await tx
            .select({ id: customers.id })
            .from(customers)
            .where(eq(customers.name, customerName))
            .limit(1)
          customerId = racedCustomer?.id ?? null
        }
      }
    }

    const passwordCipher = encryptSecret(input.password)
    let deviceId: string
    let created = false

    if (existingDevice) {
      await tx
        .update(devices)
        .set({
          alias: claim.alias,
          customerId,
          osKey: claim.osKey,
          tags: token.tags,
          lastSeen: now,
          passwordCipher,
          updatedAt: now,
        })
        .where(eq(devices.id, existingDevice.id))
      deviceId = existingDevice.id
    } else {
      const [device] = await tx
        .insert(devices)
        .values({
          rustdeskId: claim.rustdeskId,
          alias: claim.alias,
          customerId,
          osKey: claim.osKey,
          tags: token.tags,
          status: 'offline',
          lastSeen: now,
          passwordCipher,
          enrollmentTokenId: token.id,
          createdBy: token.createdBy,
        })
        .returning({ id: devices.id })
      deviceId = device.id
      created = true
    }

    await tx
      .update(enrollmentClaims)
      .set({ finalizedAt: now, deviceId })
      .where(eq(enrollmentClaims.id, claim.id))

    await tx
      .update(enrollmentTokens)
      .set({
        useCount: sql`${enrollmentTokens.useCount} + 1`,
        usedAt: token.kind === 'single' ? now : token.usedAt,
        lastUsedAt: now,
      })
      .where(eq(enrollmentTokens.id, token.id))

    return { deviceId, rustdeskId: claim.rustdeskId, created }
  })
}
