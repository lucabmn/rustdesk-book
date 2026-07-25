import { Building2, MonitorSmartphone, Settings2, Star } from 'lucide-react'

import { Button, NavItem, SectionLabel, TagChip } from '#/components/ui'
import { ANY, type FilterState } from '#/lib/address-book-filters'
import { m } from '#/paraglide/messages'
import { GroupSidebar } from './group-sidebar'

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

/** Section header with an optional action button on the right. */
function Group({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="px-2 pt-4">
      <div className="flex h-6 items-center justify-between gap-2 px-2">
        <SectionLabel>{title}</SectionLabel>
        {action}
      </div>
      <div className="mt-0.5 flex flex-col gap-px">{children}</div>
    </div>
  )
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
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-line border-r bg-surface pb-4">
      <div className="px-4 pt-3.5 pb-1">
        <h2 className="font-semibold text-sm text-text">{m.nav_title()}</h2>
        <p className="mt-px text-muted text-xs">{m.nav_subtitle()}</p>
      </div>

      <div className="flex flex-col gap-px px-2 pt-3">
        <NavItem
          icon={MonitorSmartphone}
          label={m.nav_all_devices()}
          count={total ?? '—'}
          active={allActive}
          onClick={() =>
            patch({ customer: ANY, favorite: false, groupId: null })
          }
        />
        <NavItem
          icon={Star}
          label={m.nav_favorites()}
          active={filters.favorite}
          onClick={() => patch({ favorite: !filters.favorite })}
        />
      </div>

      <Group
        title={m.section_customers()}
        action={
          isAdmin && (
            <Button
              variant="ghost"
              size="icon-xs"
              title={m.customers_manage()}
              aria-label={m.customers_manage()}
              onClick={onManageCustomers}
            >
              <Settings2 />
            </Button>
          )
        }
      >
        {customers.length === 0 ? (
          <p className="px-2 py-1 text-2xs text-faint">{m.customers_none()}</p>
        ) : (
          customers.map((c) => (
            <NavItem
              key={c.name}
              icon={Building2}
              label={c.name}
              count={c.count}
              active={filters.customer === c.name}
              onClick={() =>
                patch({ customer: filters.customer === c.name ? ANY : c.name })
              }
            />
          ))
        )}
      </Group>

      {tags.length > 0 && (
        <Group title={m.section_tags()}>
          <div className="flex flex-wrap gap-1 px-2 pt-1">
            {tags.map((t) => (
              <TagChip
                key={t.name}
                count={t.count}
                active={filters.tags.includes(t.name)}
                onClick={() => onToggleTag(t.name)}
              >
                {t.name}
              </TagChip>
            ))}
          </div>
        </Group>
      )}

      <GroupSidebar
        activeGroupId={filters.groupId}
        onSelect={(groupId) => patch({ groupId })}
      />
    </aside>
  )
}

export { Group as SidebarGroup }
