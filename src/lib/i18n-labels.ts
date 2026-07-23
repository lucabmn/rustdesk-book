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
