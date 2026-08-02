import { Eye, EyeOff } from 'lucide-react'

import { Button, Section } from '#/components/ui'
import { m } from '#/paraglide/messages'

export interface DevicePasswordFieldProps {
  hasPassword: boolean
  password: string | null
  revealing: boolean
  onToggleReveal: () => void
  /**
   * No connection. Revealing is a server round trip by design — the key never
   * leaves it — so the control says why instead of failing when pressed.
   */
  offline?: boolean
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
  offline,
}: DevicePasswordFieldProps) {
  return (
    <Section title={m.th_password()}>
      {hasPassword ? (
        <div className="flex items-center gap-2 rounded-md border border-line bg-sunken py-1.5 pr-1.5 pl-2.5">
          <span className="flex-1 truncate font-mono text-text text-xs tracking-wider">
            {password ?? '••••••••'}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onToggleReveal}
            disabled={revealing || offline}
            title={offline ? m.offline_needs_connection() : undefined}
            aria-label={
              password ? m.drawer_hide_password() : m.drawer_show_password()
            }
          >
            {password ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      ) : (
        <p className="text-faint text-xs">{m.drawer_no_password()}</p>
      )}
      {offline && hasPassword && (
        <p className="mt-1.5 text-faint text-xs">
          {m.offline_password_disabled()}
        </p>
      )}
    </Section>
  )
}
