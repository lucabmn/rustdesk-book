import { DropdownMenu } from 'radix-ui'
import { History, LogOut, Mail, Rocket, Users } from 'lucide-react'

import { LanguageSwitcher } from '#/components/language-switcher'
import { m } from '#/paraglide/messages'

export interface UserMenuProps {
  initials: string
  name: string
  email: string
  isAdmin: boolean
  onInvite: () => void
  onUsers: () => void
  onAudit: () => void
  onEnrollment: () => void
  onSignOut: () => void
}

/** Avatar dropdown: account details, admin entry points and the language switch. */
export function UserMenu({
  initials,
  name,
  email,
  isAdmin,
  onInvite,
  onUsers,
  onAudit,
  onEnrollment,
  onSignOut,
}: UserMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="tv-avatar tv-avatar--sm"
          style={{
            background: 'var(--brand-soft)',
            color: 'var(--brand)',
            fontSize: 11,
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label={m.user_menu()}
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          style={{
            minWidth: 200,
            padding: 6,
            borderRadius: 8,
            background: 'var(--bg-panel)',
            boxShadow: 'var(--sh-pop), var(--ring-card)',
            fontSize: 12.5,
            zIndex: 70,
          }}
        >
          <div style={{ padding: '6px 8px' }}>
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{email}</div>
          </div>
          <div
            style={{ height: 1, background: 'var(--bd-subtle)', margin: '4px 0' }}
          />
          <DropdownMenu.Item asChild>
            <button className="tv-menu-item" onClick={onEnrollment}>
              <Rocket size={14} /> {m.enrollment_menu()}
            </button>
          </DropdownMenu.Item>
          {isAdmin && (
            <>
              <DropdownMenu.Item asChild>
                <button className="tv-menu-item" onClick={onUsers}>
                  <Users size={14} /> {m.users_menu()}
                </button>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <button className="tv-menu-item" onClick={onInvite}>
                  <Mail size={14} /> {m.invite_users()}
                </button>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <button className="tv-menu-item" onClick={onAudit}>
                  <History size={14} /> {m.audit_menu()}
                </button>
              </DropdownMenu.Item>
            </>
          )}
          <DropdownMenu.Item asChild>
            <button className="tv-menu-item" onClick={onSignOut}>
              <LogOut size={14} /> {m.sign_out()}
            </button>
          </DropdownMenu.Item>
          <div
            style={{ height: 1, background: 'var(--bd-subtle)', margin: '4px 0' }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
            }}
          >
            <span style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>
              {m.language()}
            </span>
            <LanguageSwitcher />
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
