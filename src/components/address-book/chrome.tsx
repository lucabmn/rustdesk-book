import { useEffect, useRef, useState } from 'react'
import { Moon, Plus, Search, Sun } from 'lucide-react'

import { BrandGlyph } from '#/components/brand-mark'
import { Button, Divider, Input, Kbd } from '#/components/ui'
import type { Theme } from '#/lib/theme'
import { m } from '#/paraglide/messages'
import { UserMenu, type UserMenuProps } from './user-menu'

/**
 * The single piece of window chrome. Everything that used to live in a second
 * icon rail is reachable from the user menu, so the app has one vertical
 * navigation instead of two.
 */

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
    <header className="flex h-12 shrink-0 items-center gap-3 border-line border-b bg-surface pr-3 pl-4">
      {/* Aligned to the sidebar's width so the glyph sits over the nav column. */}
      <span className="flex w-56 shrink-0 items-center gap-2 text-text">
        <BrandGlyph className="size-[18px]" />
        <span className="font-semibold text-xs tracking-tight">
          rustdesk<span className="text-faint">/</span>book
        </span>
      </span>

      <div className="relative min-w-0 max-w-lg flex-1">
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

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
