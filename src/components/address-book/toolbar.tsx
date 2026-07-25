import { useRef } from 'react'
import {
  Building2,
  Download,
  LayoutGrid,
  List,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'

import {
  Button,
  Divider,
  Segmented,
  SegmentedItem,
  Select,
} from '#/components/ui'
import { ANY, type FilterState } from '#/lib/address-book-filters'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { CustomerCombobox } from './customer-combobox'
import type { ViewMode } from './use-address-book'

export interface ToolbarProps {
  heading: string
  count: number
  view: ViewMode
  onView: (view: ViewMode) => void
  syncEnabled: boolean
  syncPending: boolean
  onSyncNow: () => void
  onExport: () => void
  onImportFile: (file: File) => void
}

const VIEWS = [
  { key: 'table', icon: List, label: m.view_table },
  { key: 'grouped', icon: Building2, label: m.view_grouped },
  { key: 'cards', icon: LayoutGrid, label: m.view_cards },
] as const

/** Title, view switch and the import/export/sync actions. */
export function Toolbar({
  heading,
  count,
  view,
  onView,
  syncEnabled,
  syncPending,
  onSyncNow,
  onExport,
  onImportFile,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex shrink-0 items-center gap-3 border-line border-b bg-surface px-4 py-2.5">
      <h1 className="flex items-baseline gap-2">
        <span className="truncate font-semibold text-text text-lg">
          {heading}
        </span>
        <span className="tnum text-muted text-xs">{count}</span>
      </h1>

      <div className="flex-1" />

      <Segmented>
        {VIEWS.map(({ key, icon: Icon, label }) => (
          <SegmentedItem
            key={key}
            active={view === key}
            onClick={() => onView(key)}
          >
            <Icon />
            {label()}
          </SegmentedItem>
        ))}
      </Segmented>

      <Divider vertical />

      {syncEnabled && (
        <Button onClick={onSyncNow} disabled={syncPending} title={m.sync_now()}>
          <RefreshCw className={cn(syncPending && 'animate-spin')} />
          {m.sync_now()}
        </Button>
      )}
      <Button onClick={() => fileRef.current?.click()}>
        <Upload />
        {m.action_import()}
      </Button>
      <Button onClick={onExport}>
        <Download />
        {m.action_export()}
      </Button>
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
  )
}

export interface FilterBarProps {
  filters: FilterState
  patch: (next: Partial<FilterState>) => void
  osNames: string[]
  customerNames: string[]
  hasActiveFilters: boolean
  onReset: () => void
  onlineCount: number
  customerCount: number
}

/** Secondary bar: status/OS/customer selects plus the summary counters. */
export function FilterBar({
  filters,
  patch,
  osNames,
  customerNames,
  hasActiveFilters,
  onReset,
  onlineCount,
  customerCount,
}: FilterBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-line border-b bg-sunken px-4 py-2">
      <Select
        value={filters.status}
        onChange={(e) => patch({ status: e.target.value })}
        aria-label={m.filter_all_status()}
        className="h-7 w-auto text-xs"
      >
        <option value={ANY}>{m.filter_all_status()}</option>
        <option value="online">{m.status_online()}</option>
        <option value="away">{m.status_away()}</option>
        <option value="offline">{m.status_offline()}</option>
      </Select>

      <div className="w-44">
        <CustomerCombobox
          value={filters.osKey === ANY ? '' : filters.osKey}
          onChange={(v) => patch({ osKey: v || ANY })}
          options={osNames}
          placeholder={m.filter_all_os()}
          commitMode="select"
          clearLabel={m.filter_all_os()}
          aria-label={m.filter_all_os()}
        />
      </div>
      <div className="w-44">
        <CustomerCombobox
          value={filters.customer === ANY ? '' : filters.customer}
          onChange={(v) => patch({ customer: v || ANY })}
          options={customerNames}
          placeholder={m.filter_all_customers()}
          commitMode="select"
          clearLabel={m.filter_all_customers()}
          aria-label={m.filter_all_customers()}
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="xs" onClick={onReset}>
          <X />
          {m.filter_reset()}
        </Button>
      )}

      <div className="flex-1" />
      <div className="flex gap-3 text-2xs text-muted">
        <span className="tnum">{m.stat_online({ count: onlineCount })}</span>
        <span className="tnum">
          {m.stat_customers({ count: customerCount })}
        </span>
      </div>
    </div>
  )
}
