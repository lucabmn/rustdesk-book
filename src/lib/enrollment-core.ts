/**
 * Enrollment primitives: token generation and hashing, the payload schemas and
 * the locking helpers shared by the claim and finalize steps.
 */
import { createHash, randomBytes } from 'node:crypto'

import { sql } from 'drizzle-orm'
import { z } from 'zod'

import type { db as Database } from '#/db'

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

export function generateClaimToken(): string {
  return `rdc_${randomBytes(32).toString('base64url')}`
}

/** Stable lookup digest; bearer and claim tokens are never persisted. */
export function hashEnrollmentToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function enrollmentTokenPrefix(token: string): string {
  return `${token.slice(0, 12)}…`
}

export const CLAIM_TTL_MS = 30 * 60 * 1000

export async function lockRustdeskId(
  tx: Parameters<Parameters<typeof Database.transaction>[0]>[0],
  rustdeskId: string,
) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${rustdeskId}))`)
}
