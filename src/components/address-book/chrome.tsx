import { useEffect, useRef, useState } from 'react'
import {
  History,
  Mail,
  MonitorSmartphone,
  Moon,
  Plus,
  Rocket,
  Search,
  Sun,
  Users,
} from 'lucide-react'

import { BrandMark } from '#/components/brand-mark'
import { Button, Divider, Input, Kbd, RailButton } from '#/components/ui'
import type { Theme } from '#/lib/theme'
import { m } from '#/paraglide/messages'
import { UserMenu, type UserMenuProps } from './user-menu'

/** Window chrome: the top bar, the icon rail and the status bar. */

export interface TopBarProps {
  search: string
  onSearch: (value: string) => void
  onAdd: () => void
  theme: Theme
  onToggleTheme: () => void
  menu: UserMenuProps
}

export function TopBar({
  search,
  onSearch,
  onAdd,
  theme,
  onToggleTheme,
  menu,
}: TopBarProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
  }, [])

  // Cmd/Ctrl+K jumps to search from anywhere; Escape gives the list back.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-line border-b bg-surface px-3">
      <BrandMark size="sm" />

      <div className="flex flex-1 justify-center">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-faint" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
            placeholder={m.search_placeholder()}
            aria-label={m.search_placeholder()}
            className="h-7 bg-sunken pr-14 pl-8 text-xs"
          />
          <span className="pointer-events-none absolute top-1.5 right-2 flex gap-0.5">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="accent" onClick={onAdd}>
          <Plus />
          {m.device_add()}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleTheme}
          title={m.theme_toggle()}
          aria-label={m.theme_toggle()}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <Divider vertical className="mx-1" />
        <UserMenu {...menu} />
      </div>
    </header>
  )
}

export interface AppRailProps {
  isAdmin: boolean
  onEnrollment: () => void
  onUsers: () => void
  onAudit: () => void
  onInvite: () => void
}

/** Far-left icon rail. Devices is the only destination; the rest open dialogs. */
export function AppRail({
  isAdmin,
  onEnrollment,
  onUsers,
  onAudit,
  onInvite,
}: AppRailProps) {
  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-line border-r bg-sunken py-2">
      <RailButton active icon={MonitorSmartphone} label={m.nav_title()} />
      <div className="flex-1" />
      <RailButton
        icon={Rocket}
        label={m.enrollment_menu()}
        onClick={onEnrollment}
      />
      {isAdmin && (
        <>
          <RailButton icon={Users} label={m.users_menu()} onClick={onUsers} />
          <RailButton icon={History} label={m.audit_menu()} onClick={onAudit} />
          <RailButton icon={Mail} label={m.rail_invites()} onClick={onInvite} />
        </>
      )}
    </nav>
  )
}

export function StatusBar({ total }: { total: number }) {
  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 whitespace-nowrap border-line border-t bg-surface px-3 text-2xs text-faint">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-ok" />
        {m.sb_server_connected()}
      </span>
      <span className="tnum text-muted">{m.sb_devices({ count: total })}</span>
      <div className="flex-1" />
      <span>{m.sb_selfhosted()}</span>
      <span className="font-mono">{m.app_name()}</span>
    </footer>
  )
}
