import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { user } from './auth'
import { devices } from './devices'

/* ------------------------------------------------------------------ *
 * Audit log — records who did what to which entity, and when.
 * The secret value itself is NEVER recorded.
 *
 * Every entry carries snapshots (actor name/email, target label) next to
 * the foreign keys, so a row stays readable after the actor or the target
 * is deleted — exactly when an audit log has to hold up. The read
 * procedures still resolve their labels through the foreign keys; moving
 * them onto the snapshots is the contract step.
 * ------------------------------------------------------------------ */

/**
 * Known actions. Open set: adding one means appending an entry here and a
 * label message — nothing else switches on the value, and the column is
 * `text` rather than a PG enum, so no migration is needed either.
 */
export const AUDIT_ACTIONS = ['reveal_password', 'connect'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/** Entity kinds an entry can point at. Open set, same as the actions. */
export const AUDIT_TARGET_TYPES = ['device', 'user'] as const
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number]

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: text('action').notNull(),
    /**
     * Legacy device pointer. Still filled for device targets so the admin
     * dialog and the device history keep working unchanged.
     */
    deviceId: uuid('device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    actorName: text('actor_name'),
    actorEmail: text('actor_email'),
    targetType: text('target_type'),
    /** Text, not uuid — not every target id is a uuid (user ids are text). */
    targetId: text('target_id'),
    targetLabel: text('target_label'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    /** Action-specific details, e.g. which fields changed. */
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_device_idx').on(t.deviceId),
    index('audit_log_target_idx').on(t.targetType, t.targetId),
  ],
)
