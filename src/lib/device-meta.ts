/**
 * Shared, framework-agnostic device metadata. Safe to import on both the
 * server (schema/validation) and the client (labels, status styling).
 */

export const OS_OPTIONS = [
  { key: 'win11', label: 'Windows 11' },
  { key: 'win10', label: 'Windows 10' },
  { key: 'winsrv', label: 'Windows Server 2022' },
  { key: 'ubuntu', label: 'Ubuntu 22.04' },
  { key: 'macos', label: 'macOS 14' },
  { key: 'android', label: 'Android' },
] as const

export type OsKey = (typeof OS_OPTIONS)[number]['key']

export const OS_KEYS = OS_OPTIONS.map((o) => o.key) as [OsKey, ...OsKey[]]

export function osLabel(key: string | null | undefined): string {
  return OS_OPTIONS.find((o) => o.key === key)?.label ?? (key || '—')
}

export const DEVICE_STATUSES = ['online', 'away', 'offline'] as const
export type DeviceStatus = (typeof DEVICE_STATUSES)[number]

/** Per-status presentation: i18n label key + Tenvima dot/chip classes. */
export const STATUS_META: Record<DeviceStatus, { dot: string; chip: string }> =
  {
    online: { dot: 'tv-dot--ok', chip: 'tv-chip tv-chip--ok' },
    away: { dot: 'tv-dot--warn', chip: 'tv-chip tv-chip--warn' },
    offline: { dot: 'tv-dot--neutral', chip: 'tv-chip tv-chip--neutral' },
  }

/** Formats a RustDesk id for display: 123456789 -> "123 456 789". */
export function formatRustdeskId(id: string): string {
  return String(id)
    .replace(/\D/g, '')
    .replace(/(\d{3})(?=\d)/g, '$1 ')
    .trim()
}
