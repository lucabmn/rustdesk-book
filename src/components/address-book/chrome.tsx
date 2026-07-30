import { useEffect, useRef, useState } from 'react'
import { Menu as MenuIcon, Moon, Plus, Search, Sun } from 'lucide-react'

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
  /** Opens the navigation sheet. Only reachable where the sidebar is hidden. */
  onOpenNav: () => void
  menu: UserMenuProps
}

export function TopBar({
  search,
  onSearch,
  onAdd,
  theme,
  onToggleTheme,
  onOpenNav,
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
      if (event.key !== 'k') return
      // Only the platform's own modifier. Accepting both would swallow Ctrl+K
      // on macOS, where it is kill-to-end-of-line inside any text field.
      if (isMac ? !event.metaKey : !event.ctrlKey) return
      event.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMac])

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-line border-b bg-surface pr-3 pl-2 sm:gap-3 sm:pl-4">
      {/* The sidebar's only way in once it has folded into a sheet. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenNav}
        title={m.nav_open()}
        aria-label={m.nav_open()}
      >
        <MenuIcon />
      </Button>

      {/* Aligned to the sidebar's width so the glyph sits over the nav column
          — but only where that column exists. Narrower, the wordmark is the
          first thing to go: it is decoration next to the search field. */}
      <span className="flex shrink-0 items-center gap-2 text-text lg:w-56">
        <BrandGlyph className="size-[18px]" />
        <span className="hidden font-semibold text-xs tracking-tight sm:inline">
          rustdesk<span className="text-faint">/</span>book
        </span>
      </span>

      <div className="relative min-w-0 max-w-lg flex-1">
        {/* Centred by the box rather than a top offset — the field is taller
            under `touch:` and a hand-tuned number would only be right once. */}
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
          <Search className="size-3.5 text-faint" />
        </span>
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          placeholder={m.search_placeholder()}
          aria-label={m.search_placeholder()}
          // Not `type="search"`: that puts a native clear button exactly where
          // the shortcut hint sits. This only relabels the on-screen return key.
          enterKeyHint="search"
          className="h-7 bg-sunken pr-2.5 pl-8 text-xs mouse:pr-14"
        />
        {/* Centred by the box rather than a hand-tuned offset, so it stays
            centred if the field's height ever changes. Hidden from assistive
            tech — the input's own label already says what this field is, and
            hidden outright without a keyboard to press it with. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-2 hidden items-center gap-0.5 mouse:flex"
        >
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {/* Icon-only until there is room for the label. `gap` costs nothing
            here: a `display:none` child is not a flex item. */}
        <Button
          variant="accent"
          onClick={onAdd}
          title={m.device_add()}
          aria-label={m.device_add()}
        >
          <Plus />
          <span className="hidden sm:inline">{m.device_add()}</span>
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
        <Divider vertical className="mx-1 hidden sm:block" />
        <UserMenu {...menu} />
      </div>
    </header>
  )
}
