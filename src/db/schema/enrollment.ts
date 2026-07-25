import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { user } from './auth'
import { devices } from './devices'

/* ------------------------------------------------------------------ *
 * Enrollment tokens — allow deployment scripts to add RustDesk OSS
 * devices without an interactive rustdesk-book login. Only a SHA-256
 * digest is stored; the bearer token is shown once when it is created.
 * ------------------------------------------------------------------ */

export const ENROLLMENT_TOKEN_KINDS = ['single', 'permanent'] as const
export type EnrollmentTokenKind = (typeof ENROLLMENT_TOKEN_KINDS)[number]

export const enrollmentTokens = pgTable(
  'enrollment_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    /** Reversible token storage is limited to permanent deployments. */
    tokenCipher: text('token_cipher'),
    tokenPrefix: text('token_prefix').notNull(),
    kind: text('kind').notNull(),
    installIfMissing: boolean('install_if_missing').notNull().default(true),
    customer: text('customer'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    rustdeskConfig: text('rustdesk_config'),
    useCount: integer('use_count').notNull().default(0),
    usedAt: timestamp('used_at'),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('enrollment_tokens_hash_idx').on(t.tokenHash),
    index('enrollment_tokens_created_by_idx').on(t.createdBy),
    check(
      'enrollment_tokens_kind_check',
      sql`${t.kind} in ('single', 'permanent')`,
    ),
    check('enrollment_tokens_use_count_check', sql`${t.useCount} >= 0`),
  ],
)

/* ------------------------------------------------------------------ *
 * Enrollment claims — short-lived credentials issued after a device ID
 * has been validated, but before its permanent password is changed.
 * ------------------------------------------------------------------ */

export const enrollmentClaims = pgTable(
  'enrollment_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenId: uuid('token_id')
      .notNull()
      .references(() => enrollmentTokens.id, { onDelete: 'cascade' }),
    claimHash: text('claim_hash').notNull(),
    rustdeskId: text('rustdesk_id').notNull(),
    alias: text('alias').notNull(),
    osKey: text('os_key'),
    rustdeskVersion: text('rustdesk_version'),
    expiresAt: timestamp('expires_at').notNull(),
    finalizedAt: timestamp('finalized_at'),
    deviceId: uuid('device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('enrollment_claims_hash_idx').on(t.claimHash),
    index('enrollment_claims_token_idx').on(t.tokenId),
  ],
)
