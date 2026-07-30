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
  return AUDIT_ACTION_LABELS[action]?.() ?? action
}

const AUDIT_ACTION_LABELS: Record<string, () => string> = {
  reveal_password: m.audit_action_reveal_password,
  connect: m.audit_action_connect,
  device_created: m.audit_action_device_created,
  device_updated: m.audit_action_device_updated,
  device_deleted: m.audit_action_device_deleted,
  device_reassigned: m.audit_action_device_reassigned,
  device_password_changed: m.audit_action_device_password_changed,
  device_group_changed: m.audit_action_device_group_changed,
  login: m.audit_action_login,
  login_failed: m.audit_action_login_failed,
  logout: m.audit_action_logout,
  password_changed: m.audit_action_password_changed,
  customer_created: m.audit_action_customer_created,
  customer_updated: m.audit_action_customer_updated,
  customer_deleted: m.audit_action_customer_deleted,
  user_created: m.audit_action_user_created,
  user_role_changed: m.audit_action_user_role_changed,
  user_banned: m.audit_action_user_banned,
  user_unbanned: m.audit_action_user_unbanned,
  user_deleted: m.audit_action_user_deleted,
  invite_created: m.audit_action_invite_created,
  invite_revoked: m.audit_action_invite_revoked,
  invite_accepted: m.audit_action_invite_accepted,
  enrollment_token_created: m.audit_action_enrollment_token_created,
  enrollment_token_used: m.audit_action_enrollment_token_used,
  enrollment_token_revoked: m.audit_action_enrollment_token_revoked,
  import_data: m.audit_action_import_data,
  export_data: m.audit_action_export_data,
}
