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
  id: string
  /** Snapshotted so the entry survives the user being deleted. */
  name: string | null
  email: string | null
}

export interface AuditTarget {
  type: AuditTargetType
  id: string
  /** Human-readable snapshot, e.g. a device alias. */
  label: string | null
}

export interface AuditEvent {
  action: AuditAction
  actor: AuditActor
  target: AuditTarget
  /** Request headers; IP and user agent are derived from them. */
  headers: Headers
  /** Action-specific details, e.g. the fields that changed. */
  metadata?: Record<string, unknown>
}

export async function recordAuditEvent(
  db: typeof Database,
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
    deviceId: event.target.type === 'device' ? event.target.id : null,
    ipAddress,
    userAgent,
    metadata: event.metadata ?? null,
  })
}
