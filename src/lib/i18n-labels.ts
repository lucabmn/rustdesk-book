import { m } from '#/paraglide/messages'
import type { DeviceStatus } from '#/lib/device-meta'

/** Localized status label. */
export function statusLabel(status: DeviceStatus): string {
  if (status === 'online') return m.status_online()
  if (status === 'away') return m.status_away()
  return m.status_offline()
}

/** Localized role label. */
export function roleLabel(role: string): string {
  return role === 'admin' ? m.common_role_admin() : m.common_role_member()
}

/**
 * Localized audit-action label. The action set is open, so an action without
 * a label falls back to its raw key rather than borrowing another action's
 * wording — a mislabelled audit entry is worse than an untranslated one.
 */
export function auditActionLabel(action: string): string {
  if (action === 'connect') return m.audit_action_connect()
  if (action === 'reveal_password') return m.audit_action_reveal_password()
  return action
}
