import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
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
    customer: text('customer'),
    osKey: text('os_key'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('offline'),
    lastSeen: timestamp('last_seen'),
    /** AES-256-GCM ciphertext (base64) — never leaves the server as cleartext. */
    passwordCipher: text('password_cipher'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('devices_rustdesk_id_idx').on(t.rustdeskId),
    index('devices_customer_idx').on(t.customer),
  ],
)

/* ------------------------------------------------------------------ *
 * Audit log — records who revealed/connected which device and when.
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

export const devicesRelations = relations(devices, ({ one }) => ({
  creator: one(user, {
    fields: [devices.createdBy],
    references: [user.id],
  }),
}))
