import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { user } from './auth'
import { devices } from './devices'

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
