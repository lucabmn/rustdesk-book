import { Building2, MonitorDot, Settings2, Star } from 'lucide-react'

import { ANY, type FilterState } from '#/lib/address-book-filters'
import { m } from '#/paraglide/messages'
import { GroupSidebar } from './group-sidebar'
import { SidebarHeading } from './ui-bits'

export interface Facet {
  name: string
  count: number
}

export interface FilterSidebarProps {
  filters: FilterState
  patch: (next: Partial<FilterState>) => void
  onToggleTag: (name: string) => void
  total?: number
  customers: Facet[]
  tags: Facet[]
  isAdmin: boolean
  onManageCustomers: () => void
}

/** Context sidebar: scope selection, customer facets, tag facets and groups. */
export function FilterSidebar({
  filters,
  patch,
  onToggleTag,
  total,
  customers,
  tags,
  isAdmin,
  onManageCustomers,
}: FilterSidebarProps) {
  const allActive =
    filters.customer === ANY && !filters.favorite && !filters.groupId

  return (
    <div
      style={{
        width: 246,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-chrome)',
        borderRight: '1px solid var(--bd-1)',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '14px 14px 10px' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{m.nav_title()}</div>
        <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2 }}>
          {m.nav_subtitle()}
        </div>
      </div>

      <button
        className="tv-navitem"
        data-active={allActive}
        onClick={() => patch({ customer: ANY, favorite: false, groupId: null })}
      >
        <MonitorDot className="tv-navitem__icon" />
        <span className="tv-navitem__label">{m.nav_all_devices()}</span>
        <span className="tv-navitem__count">{total ?? '—'}</span>
      </button>

      <button
        className="tv-navitem"
        data-active={filters.favorite}
        onClick={() => patch({ favorite: !filters.favorite })}
      >
        <Star
          className="tv-navitem__icon"
          style={filters.favorite ? { fill: 'currentColor' } : undefined}
        />
        <span className="tv-navitem__label">{m.nav_favorites()}</span>
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 14px 6px',
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            color: 'var(--fg-4)',
          }}
        >
          {m.section_customers()}
        </span>
        {isAdmin && (
          <button
            className="tv-btn tv-btn--ghost tv-btn--icon-xs"
            title={m.customers_manage()}
            aria-label={m.customers_manage()}
            onClick={onManageCustomers}
          >
            <Settings2 size={14} />
          </button>
        )}
      </div>
      {customers.map((c) => (
        <button
          key={c.name}
          className="tv-navitem"
          data-active={filters.customer === c.name}
          onClick={() =>
            patch({ customer: filters.customer === c.name ? ANY : c.name })
          }
        >
          <Building2 className="tv-navitem__icon" />
          <span className="tv-navitem__label">{c.name}</span>
          <span className="tv-navitem__count">{c.count}</span>
        </button>
      ))}

      <SidebarHeading>{m.section_tags()}</SidebarHeading>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '0 14px 16px',
        }}
      >
        {tags.map((t) => {
          const on = filters.tags.includes(t.name)
          return (
            <button
              key={t.name}
              onClick={() => onToggleTag(t.name)}
              style={{
                height: 22,
                padding: '0 9px',
                borderRadius: 999,
                border: `1px solid ${on ? 'var(--brand)' : 'var(--bd-1)'}`,
                background: on ? 'var(--brand-soft)' : 'var(--bg-sunken)',
                color: on ? 'var(--brand)' : 'var(--fg-2)',
                fontFamily: 'var(--font-sans)',
                fontSize: 11.5,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {t.name}
              <span style={{ opacity: 0.6, marginLeft: 3 }}>{t.count}</span>
            </button>
          )
        })}
      </div>

      <GroupSidebar
        activeGroupId={filters.groupId}
        onSelect={(groupId) => patch({ groupId })}
      />
    </div>
  )
}
