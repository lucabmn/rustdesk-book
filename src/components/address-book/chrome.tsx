import {
  History,
  Mail,
  Monitor,
  Moon,
  Plus,
  Rocket,
  Search,
  Sun,
  Users,
} from 'lucide-react'

import type { Theme } from '#/lib/theme'
import { m } from '#/paraglide/messages'
import { BrandLogo } from './ui-bits'
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
  return (
    <div
      style={{
        position: 'relative',
        height: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 14px',
        background: 'var(--bg-chrome)',
        borderBottom: '1px solid var(--bd-1)',
      }}
    >
      <span
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 1,
          backgroundImage: 'var(--brand-gradient)',
          opacity: 0.7,
        }}
      />
      <BrandLogo />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 460 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--fg-4)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="tv-input"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={m.search_placeholder()}
            style={{ height: 28, paddingLeft: 32 }}
          />
        </div>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
      >
        <button className="tv-btn tv-btn--default tv-btn--sm" onClick={onAdd}>
          <Plus size={14} strokeWidth={1.75} />
          {m.device_add()}
        </button>
        <button
          className="tv-btn tv-btn--ghost tv-btn--icon-sm"
          onClick={onToggleTheme}
          title={m.theme_toggle()}
          aria-label={m.theme_toggle()}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <span
          style={{
            width: 1,
            height: 20,
            background: 'var(--bd-1)',
            margin: '0 2px',
          }}
        />
        <UserMenu {...menu} />
      </div>
    </div>
  )
}

export interface AppRailProps {
  isAdmin: boolean
  onEnrollment: () => void
  onUsers: () => void
  onAudit: () => void
  onInvite: () => void
}

export function AppRail({
  isAdmin,
  onEnrollment,
  onUsers,
  onAudit,
  onInvite,
}: AppRailProps) {
  return (
    <div
      style={{
        width: 52,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '8px 0',
        background: 'var(--bg-sunken)',
        borderRight: '1px solid var(--bd-1)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: 'var(--brand-soft)',
          color: 'var(--brand)',
        }}
        title={m.nav_title()}
      >
        <span
          style={{
            position: 'absolute',
            top: 6,
            left: -9,
            bottom: 6,
            width: 3,
            borderRadius: '0 3px 3px 0',
            backgroundImage: 'var(--brand-gradient)',
          }}
        />
        <Monitor size={17} strokeWidth={1.75} />
      </div>
      <div style={{ flex: 1 }} />
      <button
        className="tv-rail-ico"
        title={m.enrollment_menu()}
        onClick={onEnrollment}
      >
        <Rocket size={17} strokeWidth={1.5} />
      </button>
      {isAdmin && (
        <>
          <button className="tv-rail-ico" title={m.users_menu()} onClick={onUsers}>
            <Users size={17} strokeWidth={1.5} />
          </button>
          <button className="tv-rail-ico" title={m.audit_menu()} onClick={onAudit}>
            <History size={17} strokeWidth={1.5} />
          </button>
          <button
            className="tv-rail-ico"
            title={m.rail_invites()}
            onClick={onInvite}
          >
            <Mail size={17} strokeWidth={1.5} />
          </button>
        </>
      )}
    </div>
  )
}

export function StatusBar({ total }: { total: number }) {
  return (
    <div
      style={{
        height: 24,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 12px',
        background: 'var(--bg-chrome)',
        borderTop: '1px solid var(--bd-1)',
        fontSize: 11,
        color: 'var(--fg-4)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span className="tv-dot tv-dot--ok" style={{ width: 5, height: 5 }} />{' '}
        {m.sb_server_connected()}
      </span>
      <span style={{ color: 'var(--fg-3)' }}>{m.sb_devices({ count: total })}</span>
      <span className="mono">{m.app_name()}</span>
      <div style={{ flex: 1 }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {m.sb_selfhosted()}
      </span>
    </div>
  )
}
