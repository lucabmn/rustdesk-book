import { Eye, EyeOff } from 'lucide-react'

import { m } from '#/paraglide/messages'
import { Section } from './drawer-parts'

export interface DevicePasswordFieldProps {
  hasPassword: boolean
  password: string | null
  revealing: boolean
  onToggleReveal: () => void
}

/**
 * The stored-secret row. The cleartext only ever exists here after an explicit,
 * audited reveal — it is never part of the device projection.
 */
export function DevicePasswordField({
  hasPassword,
  password,
  revealing,
  onToggleReveal,
}: DevicePasswordFieldProps) {
  return (
    <Section title={m.th_password()}>
      {hasPassword ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            border: '1px solid var(--bd-1)',
            borderRadius: 6,
            background: 'var(--bg-sunken)',
          }}
        >
          <span
            className="mono"
            style={{
              flex: 1,
              letterSpacing: 1,
              color: 'var(--fg-1)',
            }}
          >
            {password ?? '••••••••'}
          </span>
          <button
            type="button"
            className="tv-btn tv-btn--ghost tv-btn--icon-xs"
            onClick={onToggleReveal}
            disabled={revealing}
            aria-label={
              password ? m.drawer_hide_password() : m.drawer_show_password()
            }
          >
            {password ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      ) : (
        <span style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>
          {m.drawer_no_password()}
        </span>
      )}
    </Section>
  )
}
