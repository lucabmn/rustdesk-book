/**
 * The single write path for the audit log. Routers and services record events
 * through {@link recordAuditEvent} and never insert into `audit_log`
 * themselves — that is what keeps every entry complete (actor snapshot,
 * target snapshot, request context) instead of complete-by-convention.
 */
import type { db as Database } from '#/db'
import { auditLog, type AuditAction, type AuditTargetType } from '#/db/schema'
import { requestContextFrom } from '#/lib/request-context'

export interface AuditActor {
  /**
   * The acting user, or null when there is none — a failed login happens
   * before any session exists, and `user_id` is a foreign key.
   */
  id: string | null
  /** Snapshotted so the entry survives the user being deleted. */
  name: string | null
  /** For an actorless event, the address that was used in the attempt. */
  email: string | null
}

export interface AuditTarget {
  type: AuditTargetType
  /** Null when the event has no single row as its subject (import/export). */
  id: string | null
  /** Human-readable snapshot, e.g. a device alias. */
  label: string | null
  /**
   * Set when the target row is already gone (a deletion). The legacy
   * `device_id` foreign key is then left empty — only the snapshot remains,
   * which is exactly what makes the entry outlive its subject.
   */
  deleted?: boolean
}

export interface AuditEvent {
  action: AuditAction
  actor: AuditActor
  target: AuditTarget
  /** Request headers; IP and user agent are derived from them. */
  headers: Headers
  /**
   * Action-specific details, e.g. the fields that changed. Never the values
   * themselves for anything secret — see {@link changedFields}.
   */
  metadata?: Record<string, unknown>
}

/**
 * Accepts a transaction handle as well as the pooled database, so an entry can
 * be written inside the same transaction as the change it describes.
 */
export type AuditWriter = Pick<typeof Database, 'insert'>

export async function recordAuditEvent(
  db: AuditWriter,
  event: AuditEvent,
): Promise<void> {
  const { ipAddress, userAgent } = requestContextFrom(event.headers)
  await db.insert(auditLog).values({
    action: event.action,
    userId: event.actor.id,
    actorName: event.actor.name,
    actorEmail: event.actor.email,
    targetType: event.target.type,
    targetId: event.target.id,
    targetLabel: event.target.label,
    // Legacy column, filled in parallel so the admin dialog and the device
    // history keep reading the same rows they always did.
    deviceId:
      event.target.type === 'device' && !event.target.deleted
        ? event.target.id
        : null,
    ipAddress,
    userAgent,
    metadata: event.metadata ?? null,
  })
}

/**
 * The names of the fields whose value differs between two snapshots — names
 * only, never values, so a secret can not reach the log through this path.
 * Compared with `JSON.stringify` so arrays (tags) and nulls behave.
 */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort()
}
