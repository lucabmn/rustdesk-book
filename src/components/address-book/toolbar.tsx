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

import { ANY, type FilterState } from '#/lib/address-book-filters'
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
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 18px',
        borderBottom: '1px solid var(--bd-1)',
        background: 'var(--bg-chrome)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{heading}</span>
        <span
          className="mono tnum"
          style={{ fontSize: 12, color: 'var(--fg-3)' }}
        >
          {count}
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div className="tv-seg">
        <button
          type="button"
          data-active={view === 'table'}
          onClick={() => onView('table')}
        >
          <List size={14} />
          {m.view_table()}
        </button>
        <button
          type="button"
          data-active={view === 'grouped'}
          onClick={() => onView('grouped')}
        >
          <Building2 size={14} />
          {m.view_grouped()}
        </button>
        <button
          type="button"
          data-active={view === 'cards'}
          onClick={() => onView('cards')}
        >
          <LayoutGrid size={14} />
          {m.view_cards()}
        </button>
      </div>
      <span style={{ width: 1, height: 22, background: 'var(--bd-1)' }} />
      {syncEnabled && (
        <button
          type="button"
          className="tv-btn tv-btn--outline tv-btn--sm"
          onClick={onSyncNow}
          disabled={syncPending}
          title={m.sync_now()}
        >
          <RefreshCw
            size={14}
            style={
              syncPending
                ? { animation: 'tv-spin 0.8s linear infinite' }
                : undefined
            }
          />
          {m.sync_now()}
        </button>
      )}
      <button
        type="button"
        className="tv-btn tv-btn--outline tv-btn--sm"
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={14} />
        {m.action_import()}
      </button>
      <button
        type="button"
        className="tv-btn tv-btn--outline tv-btn--sm"
        onClick={onExport}
      >
        <Download size={14} />
        {m.action_export()}
      </button>
      <input
        type="file"
        accept=".json"
        ref={fileRef}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImportFile(file)
          e.target.value = ''
        }}
        style={{ display: 'none' }}
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
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '10px 18px',
        borderBottom: '1px solid var(--bd-subtle)',
        background: 'var(--bg-panel)',
      }}
    >
      <select
        className="tv-select"
        value={filters.status}
        onChange={(e) => patch({ status: e.target.value })}
        aria-label={m.filter_all_status()}
      >
        <option value={ANY}>{m.filter_all_status()}</option>
        <option value="online">{m.status_online()}</option>
        <option value="away">{m.status_away()}</option>
        <option value="offline">{m.status_offline()}</option>
      </select>
      <div style={{ width: 200 }}>
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
      <div style={{ width: 200 }}>
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
        <button
          type="button"
          className="tv-btn tv-btn--ghost tv-btn--xs"
          onClick={onReset}
          style={{ color: 'var(--fg-3)' }}
        >
          <X size={12} />
          {m.filter_reset()}
        </button>
      )}
      <div style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--fg-3)',
          display: 'inline-flex',
          gap: 12,
        }}
      >
        <span className="tnum">{m.stat_online({ count: onlineCount })}</span>
        <span className="tnum">
          {m.stat_customers({ count: customerCount })}
        </span>
      </span>
    </div>
  )
}
