import { useRef } from 'react'
import {
  Building2,
  Download,
  LayoutGrid,
  List,
  MoreHorizontal,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'

import {
  Button,
  Divider,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Segmented,
  SegmentedItem,
} from '#/components/ui'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { ViewMode } from './use-address-book'

export interface ContentHeaderProps {
  heading: string
  count: number
  onlineCount: number
  customerCount: number
  view: ViewMode
  onView: (view: ViewMode) => void
  syncEnabled: boolean
  syncPending: boolean
  onSyncNow: () => void
  onExport: () => void
  onImportFile: (file: File) => void
  hasActiveFilters: boolean
  onResetFilters: () => void
}

const VIEWS = [
  { key: 'table', icon: List, label: m.view_table },
  { key: 'grouped', icon: Building2, label: m.view_grouped },
  { key: 'cards', icon: LayoutGrid, label: m.view_cards },
] as const

/**
 * One header band instead of the old toolbar-plus-filter-bar stack: the scope
 * and its counts on the left, the view switch and the data actions on the
 * right. Filtering itself lives in the sidebar, so nothing here duplicates it —
 * only the escape hatch back to "no filters" appears, and only when it applies.
 */
export function ContentHeader({
  heading,
  count,
  onlineCount,
  customerCount,
  view,
  onView,
  syncEnabled,
  syncPending,
  onSyncNow,
  onExport,
  onImportFile,
  hasActiveFilters,
  onResetFilters,
}: ContentHeaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const openImport = () => fileRef.current?.click()

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-line border-b bg-surface px-3 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="truncate font-semibold text-base text-text">
          {heading}
        </h1>
        <span className="tnum shrink-0 text-muted text-xs">{count}</span>
      </div>

      <Divider vertical className="hidden sm:block" />

      <div className="hidden shrink-0 gap-3 text-2xs text-faint sm:flex">
        <span className="tnum">{m.stat_online({ count: onlineCount })}</span>
        <span className="tnum">
          {m.stat_customers({ count: customerCount })}
        </span>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onResetFilters}
          title={m.filter_reset()}
          aria-label={m.filter_reset()}
        >
          <X />
          <span className="hidden sm:inline">{m.filter_reset()}</span>
        </Button>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Segmented>
          {VIEWS.map(({ key, icon: Icon, label }) => (
            <SegmentedItem
              key={key}
              active={view === key}
              title={label()}
              onClick={() => onView(key)}
            >
              <Icon />
              <span className="hidden lg:inline">{label()}</span>
            </SegmentedItem>
          ))}
        </Segmented>

        <Divider vertical className="hidden sm:block" />

        {/* Three icon buttons is a third of a phone's width, and none of them
            is why the screen was opened. Below `sm` they fold into one menu;
            above it they stay one tap away. */}
        <Menu>
          <MenuTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              className="sm:hidden"
              title={m.action_more()}
              aria-label={m.action_more()}
            >
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {syncEnabled && (
              <MenuItem onClick={onSyncNow} disabled={syncPending}>
                <RefreshCw className={cn(syncPending && 'animate-spin')} />
                {m.sync_now()}
              </MenuItem>
            )}
            <MenuItem onClick={openImport}>
              <Upload />
              {m.action_import()}
            </MenuItem>
            <MenuItem onClick={onExport}>
              <Download />
              {m.action_export()}
            </MenuItem>
          </MenuContent>
        </Menu>

        <div className="hidden items-center gap-2 sm:flex">
          {syncEnabled && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onSyncNow}
              disabled={syncPending}
              title={m.sync_now()}
              aria-label={m.sync_now()}
            >
              <RefreshCw className={cn(syncPending && 'animate-spin')} />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={openImport}
            title={m.action_import()}
            aria-label={m.action_import()}
          >
            <Upload />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onExport}
            title={m.action_export()}
            aria-label={m.action_export()}
          >
            <Download />
          </Button>
        </div>

        <input
          type="file"
          accept=".json"
          ref={fileRef}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
