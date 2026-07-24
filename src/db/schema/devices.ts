import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { user } from './auth'
import { customers } from './customers'
import { enrollmentTokens } from './enrollment'

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
