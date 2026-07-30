import { History, LogOut, Mail, Rocket, Users } from 'lucide-react'

import { LanguageSwitcher } from '#/components/language-switcher'
import {
  Avatar,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '#/components/ui'
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
    <Menu>
      <MenuTrigger asChild>
        {/* The avatar is 28px, which is a miss on a finger — under `touch:` the
            trigger grows around it rather than the mark itself getting bigger. */}
        <button
          type="button"
          aria-label={m.user_menu()}
          className="inline-flex shrink-0 touch-manipulation items-center justify-center rounded-full touch:size-10"
        >
          <Avatar initials={initials} />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>
          <div className="truncate font-semibold text-text text-xs">{name}</div>
          <div className="truncate text-2xs text-muted">{email}</div>
        </MenuLabel>
        <MenuSeparator />

        <MenuItem onClick={onEnrollment}>
          <Rocket /> {m.enrollment_menu()}
        </MenuItem>
        {isAdmin && (
          <>
            <MenuItem onClick={onUsers}>
              <Users /> {m.users_menu()}
            </MenuItem>
            <MenuItem onClick={onInvite}>
              <Mail /> {m.invite_users()}
            </MenuItem>
            <MenuItem onClick={onAudit}>
              <History /> {m.audit_menu()}
            </MenuItem>
          </>
        )}

        <MenuSeparator />
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <span className="text-2xs text-muted">{m.language()}</span>
          <LanguageSwitcher />
        </div>
        <MenuSeparator />

        <MenuItem onClick={onSignOut}>
          <LogOut /> {m.sign_out()}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
