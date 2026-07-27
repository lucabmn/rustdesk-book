/**
 * Step 2 of a device enrollment: store the permanent password and create or
 * update the device row, atomically with consuming the claim.
 */
import { eq, sql } from 'drizzle-orm'

import type { db as Database } from '#/db'
import {
  customers,
  devices,
  enrollmentClaims,
  enrollmentTokens,
} from '#/db/schema'
import { recordAuditEvent } from '#/lib/audit-service'
import { encryptSecret } from '#/lib/crypto'
import {
  EnrollmentError,
  hashEnrollmentToken,
  lockRustdeskId,
  type EnrollmentFinalizeInput,
} from '#/lib/enrollment-core'

/** Finalize a claimed enrollment and atomically store its permanent password. */
export async function finalizeEnrollment(
  db: typeof Database,
  rawClaimToken: string,
  input: EnrollmentFinalizeInput,
  /** Headers of the deployment request, for the audit entry's IP/user agent. */
  headers: Headers = new Headers(),
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
      throw new EnrollmentError(
        401,
        'invalid_claim',
        'Invalid or expired enrollment claim.',
      )
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
      throw new EnrollmentError(
        401,
        'invalid_token',
        'Invalid enrollment token.',
      )
    }
    if (claim.finalizedAt && claim.deviceId) {
      return {
        deviceId: claim.deviceId,
        rustdeskId: claim.rustdeskId,
        created: false,
      }
    }
    if (claim.expiresAt <= now) {
      throw new EnrollmentError(
        401,
        'invalid_claim',
        'Invalid or expired enrollment claim.',
      )
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

    // Written inside the same transaction as the consumption itself: no
    // session exists here, the deployment script authenticated with a token.
    await recordAuditEvent(tx, {
      action: 'enrollment_token_used',
      actor: { id: null, name: null, email: null },
      target: {
        type: 'enrollment_token',
        id: token.id,
        label: token.name,
      },
      headers,
      metadata: {
        rustdeskId: claim.rustdeskId,
        deviceId,
        deviceCreated: created,
        tokenPrefix: token.tokenPrefix,
      },
    })

    return { deviceId, rustdeskId: claim.rustdeskId, created }
  })
}
