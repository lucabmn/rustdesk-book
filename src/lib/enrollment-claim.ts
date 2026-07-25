/**
 * Step 1 of a device enrollment: validate the bearer token and reserve the
 * device before the deployment script touches its RustDesk password.
 */
import { and, eq, isNull, lt } from 'drizzle-orm'

import type { db as Database } from '#/db'
import { devices, enrollmentClaims, enrollmentTokens } from '#/db/schema'
import {
  CLAIM_TTL_MS,
  EnrollmentError,
  generateClaimToken,
  hashEnrollmentToken,
  lockRustdeskId,
  type EnrollmentClaimInput,
} from '#/lib/enrollment-core'

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
      throw new EnrollmentError(
        401,
        'invalid_token',
        'Invalid or revoked enrollment token.',
      )
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
      .select({
        id: enrollmentClaims.id,
        expiresAt: enrollmentClaims.expiresAt,
      })
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
