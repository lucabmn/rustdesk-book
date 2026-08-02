import {
  Building2,
  Monitor,
  MonitorSmartphone,
  Settings2,
  Star,
} from 'lucide-react'

import {
  Button,
  Drawer,
  NavItem,
  SectionLabel,
  StatusDot,
  TagChip,
} from '#/components/ui'
import { ANY, type FilterState } from '#/lib/address-book-filters'
import { DEVICE_STATUSES } from '#/lib/device-meta'
import { statusLabel } from '#/lib/i18n-labels'
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
  operatingSystems: Facet[]
  tags: Facet[]
  isAdmin: boolean
  onManageCustomers: () => void
  /**
   * No connection. Every facet here is answered from the stored address book
   * except group membership, which lives in a table the snapshot does not
   * carry — so the groups step aside rather than offer a filter that would
   * silently return the unfiltered list.
   */
  offline?: boolean
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

/**
 * The app's only navigation. Every filter dimension lives here — scope, status,
 * customer, OS, tag, group — which is what let the separate filter bar go: you
 * narrow the list where you already are, instead of in a band above it.
 *
 * Rendered as a permanent column on a wide screen and as a sheet on a narrow
 * one; both mount this same body, so there is one definition of the navigation
 * rather than two that can drift.
 */
function SidebarBody({
  filters,
  patch,
  onToggleTag,
  total,
  customers,
  operatingSystems,
  tags,
  isAdmin,
  onManageCustomers,
  offline,
}: FilterSidebarProps) {
  const allActive =
    filters.customer === ANY &&
    !filters.favorite &&
    !filters.groupId &&
    filters.status === ANY &&
    filters.osKey === ANY

  return (
    <>
      <div className="flex flex-col gap-px px-2 pt-3">
        <NavItem
          icon={MonitorSmartphone}
          label={m.nav_all_devices()}
          count={total ?? '—'}
          active={allActive}
          onClick={() =>
            patch({
              customer: ANY,
              favorite: false,
              groupId: null,
              status: ANY,
              osKey: ANY,
            })
          }
        />
        <NavItem
          icon={Star}
          label={m.nav_favorites()}
          active={filters.favorite}
          onClick={() => patch({ favorite: !filters.favorite })}
        />
      </div>

      <Group title={m.form_status_label()}>
        <div className="flex flex-wrap gap-1 px-2 pt-1">
          {DEVICE_STATUSES.map((s) => {
            const on = filters.status === s
            return (
              <TagChip
                key={s}
                active={on}
                onClick={() => patch({ status: on ? ANY : s })}
              >
                <StatusDot status={s} className="size-1.5" />
                {statusLabel(s)}
              </TagChip>
            )
          })}
        </div>
      </Group>

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

      {operatingSystems.length > 0 && (
        <Group title={m.form_os_label()}>
          {operatingSystems.map((o) => (
            <NavItem
              key={o.name}
              icon={Monitor}
              label={o.name}
              count={o.count}
              active={filters.osKey === o.name}
              onClick={() =>
                patch({ osKey: filters.osKey === o.name ? ANY : o.name })
              }
            />
          ))}
        </Group>
      )}

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

      {!offline && (
        <GroupSidebar
          activeGroupId={filters.groupId}
          onSelect={(groupId) => patch({ groupId })}
        />
      )}
    </>
  )
}

/** The permanent column. Below `lg` there is no room for it — see {@link FilterSheet}. */
export function FilterSidebar(props: FilterSidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto border-line border-r bg-surface pb-6 lg:flex">
      <div className="px-4 pt-3.5 pb-1">
        <h2 className="font-semibold text-sm text-text">{m.nav_title()}</h2>
        <p className="mt-px text-muted text-xs">{m.nav_subtitle()}</p>
      </div>
      <SidebarBody {...props} />
    </aside>
  )
}

/**
 * The same navigation as a left sheet, for viewports that cannot spare a
 * column. Choosing a scope closes it — the point of the tap was to see the
 * list — but toggling a tag does not, because tags are a multiple choice and
 * closing after each one would make picking two of them a chore.
 */
export function FilterSheet({
  open,
  onOpenChange,
  ...props
}: FilterSidebarProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const close = () => onOpenChange(false)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="left"
      width={300}
      title={m.nav_title()}
      subtitle={m.nav_subtitle()}
    >
      <div className="pb-6">
        <SidebarBody
          {...props}
          patch={(next) => {
            props.patch(next)
            close()
          }}
          onManageCustomers={() => {
            close()
            props.onManageCustomers()
          }}
        />
      </div>
    </Drawer>
  )
}
