import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/* ------------------------------------------------------------------ *
 * better-auth core tables
 * Shapes follow the better-auth drizzle adapter contract. `role` is an
 * additional field on `user` used to gate admin-only actions (invites).
 * ------------------------------------------------------------------ */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('member'), // 'admin' | 'member'
  // Ban state. A banned user is locked out at sign-in (auth hook) and rejected
  // by authed procedures; their existing sessions are revoked at ban time.
  banned: boolean('banned').notNull().default(false),
  banReason: text('ban_reason'),
  bannedAt: timestamp('banned_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/* ------------------------------------------------------------------ *
 * Invitations
 * Registration is invite-only (except the very first, bootstrap admin).
 * An invite is bound to an email address and consumed on sign-up.
 * ------------------------------------------------------------------ */

export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    role: text('role').notNull().default('member'),
    invitedBy: text('invited_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('invitation_email_idx').on(t.email)],
)

/* ------------------------------------------------------------------ *
 * Customers / tenants — a first-class entity. Previously a free-text
 * string on each device; now a shared table so a customer can be renamed
 * once, carry contact metadata, and never diverge through typos.
 * ------------------------------------------------------------------ */

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    contact: text('contact'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customers_name_idx').on(t.name)],
)

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
    check('enrollment_tokens_kind_check', sql`${t.kind} in ('single', 'permanent')`),
    check('enrollment_tokens_use_count_check', sql`${t.useCount} >= 0`),
  ],
)

/* ------------------------------------------------------------------ *
 * Devices — the address book itself.
 * The password is stored ONLY as an AES-256-GCM ciphertext. It is never
 * selected into list/detail responses; cleartext is exposed exclusively
 * through the audited reveal/connect procedures.
 * ------------------------------------------------------------------ */

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rustdeskId: text('rustdesk_id').notNull(),
    alias: text('alias').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    osKey: text('os_key'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('offline'),
    lastSeen: timestamp('last_seen'),
    /** AES-256-GCM ciphertext (base64) — never leaves the server as cleartext. */
    passwordCipher: text('password_cipher'),
    notes: text('notes'),
    enrollmentTokenId: uuid('enrollment_token_id').references(
      () => enrollmentTokens.id,
      { onDelete: 'set null' },
    ),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('devices_rustdesk_id_idx').on(t.rustdeskId),
    index('devices_customer_id_idx').on(t.customerId),
    uniqueIndex('devices_enrollment_token_rustdesk_id_idx').on(
      t.enrollmentTokenId,
      t.rustdeskId,
    ),
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

/* ------------------------------------------------------------------ *
 * Audit log — records who revealed/connected which device, and when.
 * The secret value itself is NEVER recorded.
 * ------------------------------------------------------------------ */

export const AUDIT_ACTIONS = ['reveal_password', 'connect'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: text('action').notNull(),
    deviceId: uuid('device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('audit_log_device_idx').on(t.deviceId)],
)

/* ------------------------------------------------------------------ *
 * Favorites — per-user starred devices. A join table (not a flag on
 * `devices`) so each technician has their own favorites, private to them.
 * ------------------------------------------------------------------ */

export const deviceFavorites = pgTable(
  'device_favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.deviceId] }),
    index('device_favorites_user_idx').on(t.userId),
  ],
)

/* ------------------------------------------------------------------ *
 * Device groups — per-user, private named folders. A device can belong
 * to many of a user's groups; groups are never shared between users.
 * ------------------------------------------------------------------ */

export const deviceGroups = pgTable(
  'device_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('device_groups_user_idx').on(t.userId),
    uniqueIndex('device_groups_user_name_idx').on(t.userId, t.name),
  ],
)

export const deviceGroupMembers = pgTable(
  'device_group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => deviceGroups.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.deviceId] }),
    index('device_group_members_device_idx').on(t.deviceId),
  ],
)

export const devicesRelations = relations(devices, ({ one }) => ({
  creator: one(user, {
    fields: [devices.createdBy],
    references: [user.id],
  }),
  customer: one(customers, {
    fields: [devices.customerId],
    references: [customers.id],
  }),
}))
