import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { DropdownMenu } from 'radix-ui'
import {
  Building2,
  Download,
  History,
  LayoutGrid,
  List,
  LogOut,
  Mail,
  Monitor,
  MonitorDot,
  Moon,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  Star,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { client, orpc } from '#/orpc/client'
import {
  OS_OPTIONS,
  STATUS_META,
  formatRustdeskId,
  osLabel,
} from '#/lib/device-meta'
import { applyTheme, getCurrentTheme, type Theme } from '#/lib/theme'
import type { SessionUser } from '#/lib/auth-server'
import type { Device, DeviceInput } from '#/orpc/schema'
import { statusLabel } from '#/lib/i18n-labels'
import { m } from '#/paraglide/messages'
import { LanguageSwitcher } from '#/components/language-switcher'
import { useToast } from './toast'
import { DeviceFormDialog } from './device-form-dialog'
import { CustomerCombobox } from './customer-combobox'
import { DeviceDetailDrawer, formatLastSeen } from './device-detail-drawer'
import { InviteDialog } from './invite-dialog'
import { UsersDialog } from './users-dialog'
import { AuditDialog } from './audit-dialog'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import { GroupSidebar } from './group-sidebar'
import { CustomersDialog } from './customers-dialog'
import { EnrollmentDialog } from './enrollment-dialog'

type ViewMode = 'table' | 'grouped' | 'cards'

export function AddressBook({ user }: { user: SessionUser }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterOs, setFilterOs] = useState('all')
  const [filterCustomer, setFilterCustomer] = useState('all')
  const [filterFavorite, setFilterFavorite] = useState(false)
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null)
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [view, setView] = useState<ViewMode>('table')
  const [theme, setTheme] = useState<Theme>(getCurrentTheme())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Device | null>(null)
  const [detail, setDetail] = useState<Device | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [customersOpen, setCustomersOpen] = useState(false)
  const [enrollmentOpen, setEnrollmentOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Device | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isAdmin = user.role === 'admin'

  const listInput = {
    search: search.trim() || undefined,
    status: filterStatus !== 'all' ? (filterStatus as Device['status']) : undefined,
    osKey: filterOs !== 'all' ? filterOs : undefined,
    customer: filterCustomer !== 'all' ? filterCustomer : undefined,
    tags: activeTags.length ? activeTags : undefined,
    favorite: filterFavorite || undefined,
    groupId: filterGroupId ?? undefined,
  }

  const listQuery = useQuery(orpc.devices.list.queryOptions({ input: listInput }))
  const statsQuery = useQuery(orpc.devices.stats.queryOptions({ input: {} }))
  const customersQuery = useQuery(
    orpc.customers.list.queryOptions({ input: {} }),
  )
  const syncInfoQuery = useQuery(orpc.devices.syncInfo.queryOptions({ input: {} }))
  const syncEnabled = syncInfoQuery.data?.enabled ?? false
  const devices = listQuery.data ?? []
  const stats = statsQuery.data
  const customerNames = customersQuery.data?.map((customer) => customer.name) ?? []
  // OS suggestions: the built-in presets merged with any custom values already
  // stored, deduped and sorted — so known systems are found and new ones added.
  const osNames = [
    ...new Set([
      ...OS_OPTIONS.map((o) => o.label),
      ...(stats?.operatingSystems.map((o) => o.name) ?? []),
    ]),
  ].sort((a, b) => a.localeCompare(b, 'de'))

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.devices.key() })
    void queryClient.invalidateQueries({ queryKey: orpc.customers.key() })
  }

  const createMut = useMutation(
    orpc.devices.create.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.toast_added())
        setDialogOpen(false)
      },
      onError: (e) => toast(e.message),
    }),
  )
  const updateMut = useMutation(
    orpc.devices.update.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.toast_updated())
        setDialogOpen(false)
      },
      onError: (e) => toast(e.message),
    }),
  )
  const removeMut = useMutation(
    orpc.devices.remove.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.toast_deleted())
      },
      onError: (e) => toast(e.message),
    }),
  )
  const importMut = useMutation(
    orpc.devices.importDevices.mutationOptions({
      onSuccess: (r) => {
        invalidate()
        toast(m.toast_imported({ count: r.imported }))
      },
      onError: () => toast(m.toast_import_failed()),
    }),
  )

  const favoriteMut = useMutation(
    orpc.devices.setFavorite.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (e) => toast(e.message),
    }),
  )
  const syncMut = useMutation(
    orpc.devices.syncNow.mutationOptions({
      onSuccess: (r) => {
        invalidate()
        queryClient.invalidateQueries({ queryKey: orpc.devices.syncInfo.key() })
        if (r.enabled) toast(m.toast_synced({ count: r.updated }))
      },
      onError: (e) => toast(e.message),
    }),
  )

  function toggleFavorite(device: Device) {
    const favorite = !device.isFavorite
    favoriteMut.mutate({ id: device.id, favorite })
    // Keep the open drawer's star in sync — it holds its own device snapshot.
    setDetail((d) => (d && d.id === device.id ? { ...d, isFavorite: favorite } : d))
  }

  function openAdd() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(device: Device) {
    setDetail(null)
    setEditing(device)
    setDialogOpen(true)
  }
  function submitForm(input: DeviceInput) {
    if (editing) updateMut.mutate({ id: editing.id, data: input })
    else createMut.mutate(input)
  }
  function onDelete(device: Device) {
    setPendingDelete(device)
  }
  function confirmDelete(device: Device) {
    removeMut.mutate({ id: device.id })
    setPendingDelete(null)
    setDetail(null)
  }
  async function onConnect(device: Device) {
    try {
      const { uri } = await client.devices.connect({ id: device.id })
      // Server stamped lastSeen — refetch so the list/cards/drawer show it.
      invalidate()
      window.location.href = uri
      toast(m.toast_connecting({ alias: device.alias }))
    } catch {
      toast(m.toast_connect_failed())
    }
  }
  async function reveal(device: Device): Promise<string> {
    const { password } = await client.devices.revealPassword({ id: device.id })
    return password
  }
  function copyId(device: Device) {
    try {
      void navigator.clipboard.writeText(formatRustdeskId(device.rustdeskId))
    } catch {
      /* clipboard unavailable */
    }
    toast(m.toast_id_copied())
  }
  function onExport() {
    // Export is metadata-only — passwords are never included.
    const data = JSON.stringify(devices, null, 2)
    try {
      const blob = new Blob([data], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'rustdesk-adressbuch.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      toast(m.toast_exported({ count: devices.length }))
    } catch {
      toast(m.toast_export_failed())
    }
  }
  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const arr = JSON.parse(String(r.result))
        if (!Array.isArray(arr)) {
          toast(m.toast_invalid_format())
          return
        }
        importMut.mutate({ devices: arr })
      } catch {
        toast(m.toast_import_failed())
      }
    }
    r.readAsText(file)
    e.target.value = ''
  }
  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }
  function toggleTag(name: string) {
    setActiveTags((cur) =>
      cur.includes(name) ? cur.filter((t) => t !== name) : [...cur, name],
    )
  }
  function clearFilters() {
    setSearch('')
    setFilterStatus('all')
    setFilterOs('all')
    setFilterCustomer('all')
    setFilterFavorite(false)
    setFilterGroupId(null)
    setActiveTags([])
  }
  async function signOut() {
    await authClient.signOut()
    await router.navigate({ to: '/login' })
  }

  const hasActiveFilters =
    search !== '' ||
    filterStatus !== 'all' ||
    filterOs !== 'all' ||
    filterCustomer !== 'all' ||
    filterFavorite ||
    filterGroupId !== null ||
    activeTags.length > 0

  const grouped = useMemo(() => {
    const map = new Map<string, Device[]>()
    for (const d of devices) {
      const key = d.customer || m.unassigned()
      const arr = map.get(key) ?? []
      arr.push(d)
      map.set(key, arr)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'de'))
      .map(([name, items]) => ({ name, items }))
  }, [devices])

  const headingLabel = filterCustomer === 'all' ? m.nav_all_devices() : filterCustomer
  const initials = user.name.slice(0, 2).toUpperCase()

  return (
    <div
      data-theme={theme}
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)',
        color: 'var(--fg-1)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        overflow: 'hidden',
      }}
    >
      {/* ===== TOP BAR ===== */}
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder={m.search_placeholder()}
              style={{ height: 28, paddingLeft: 32 }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button className="tv-btn tv-btn--default tv-btn--sm" onClick={openAdd}>
            <Plus size={14} strokeWidth={1.75} />
            {m.device_add()}
          </button>
          <button
            className="tv-btn tv-btn--ghost tv-btn--icon-sm"
            onClick={toggleTheme}
            title={m.theme_toggle()}
            aria-label={m.theme_toggle()}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span style={{ width: 1, height: 20, background: 'var(--bd-1)', margin: '0 2px' }} />
          <UserMenu
            initials={initials}
            name={user.name}
            email={user.email}
            isAdmin={isAdmin}
            onInvite={() => setInviteOpen(true)}
            onUsers={() => setUsersOpen(true)}
            onAudit={() => setAuditOpen(true)}
            onEnrollment={() => setEnrollmentOpen(true)}
            onSignOut={signOut}
          />
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* App rail */}
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
            onClick={() => setEnrollmentOpen(true)}
          >
            <Rocket size={17} strokeWidth={1.5} />
          </button>
          {isAdmin && (
            <>
              <button
                className="tv-rail-ico"
                title={m.users_menu()}
                onClick={() => setUsersOpen(true)}
              >
                <Users size={17} strokeWidth={1.5} />
              </button>
              <button
                className="tv-rail-ico"
                title={m.audit_menu()}
                onClick={() => setAuditOpen(true)}
              >
                <History size={17} strokeWidth={1.5} />
              </button>
              <button
                className="tv-rail-ico"
                title={m.rail_invites()}
                onClick={() => setInviteOpen(true)}
              >
                <Mail size={17} strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>

        {/* Context sidebar */}
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
            data-active={filterCustomer === 'all' && !filterFavorite && !filterGroupId}
            onClick={() => {
              setFilterCustomer('all')
              setFilterFavorite(false)
              setFilterGroupId(null)
            }}
          >
            <MonitorDot className="tv-navitem__icon" />
            <span className="tv-navitem__label">{m.nav_all_devices()}</span>
            <span className="tv-navitem__count">{stats?.total ?? '—'}</span>
          </button>

          <button
            className="tv-navitem"
            data-active={filterFavorite}
            onClick={() => setFilterFavorite((v) => !v)}
          >
            <Star
              className="tv-navitem__icon"
              style={filterFavorite ? { fill: 'currentColor' } : undefined}
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
                onClick={() => setCustomersOpen(true)}
              >
                <Settings2 size={14} />
              </button>
            )}
          </div>
          {stats?.customers.map((c) => (
            <button
              key={c.name}
              className="tv-navitem"
              data-active={filterCustomer === c.name}
              onClick={() =>
                setFilterCustomer(filterCustomer === c.name ? 'all' : c.name)
              }
            >
              <Building2 className="tv-navitem__icon" />
              <span className="tv-navitem__label">{c.name}</span>
              <span className="tv-navitem__count">{c.count}</span>
            </button>
          ))}

          <SidebarHeading>{m.section_tags()}</SidebarHeading>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 14px 16px' }}>
            {stats?.tags.map((t) => {
              const on = activeTags.includes(t.name)
              return (
                <button
                  key={t.name}
                  onClick={() => toggleTag(t.name)}
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

          <GroupSidebar activeGroupId={filterGroupId} onSelect={setFilterGroupId} />
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Toolbar */}
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
              <span style={{ fontSize: 15, fontWeight: 600 }}>{headingLabel}</span>
              <span className="mono tnum" style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                {devices.length}
              </span>
            </div>
            <div style={{ flex: 1 }} />
            <div className="tv-seg">
              <button data-active={view === 'table'} onClick={() => setView('table')}>
                <List size={14} />
                {m.view_table()}
              </button>
              <button data-active={view === 'grouped'} onClick={() => setView('grouped')}>
                <Building2 size={14} />
                {m.view_grouped()}
              </button>
              <button data-active={view === 'cards'} onClick={() => setView('cards')}>
                <LayoutGrid size={14} />
                {m.view_cards()}
              </button>
            </div>
            <span style={{ width: 1, height: 22, background: 'var(--bd-1)' }} />
            {syncEnabled && (
              <button
                className="tv-btn tv-btn--outline tv-btn--sm"
                onClick={() => syncMut.mutate({})}
                disabled={syncMut.isPending}
                title={m.sync_now()}
              >
                <RefreshCw
                  size={14}
                  style={
                    syncMut.isPending
                      ? { animation: 'tv-spin 0.8s linear infinite' }
                      : undefined
                  }
                />
                {m.sync_now()}
              </button>
            )}
            <button
              className="tv-btn tv-btn--outline tv-btn--sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} />
              {m.action_import()}
            </button>
            <button className="tv-btn tv-btn--outline tv-btn--sm" onClick={onExport}>
              <Download size={14} />
              {m.action_export()}
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileRef}
              onChange={onImportFile}
              style={{ display: 'none' }}
            />
          </div>

          {/* Filter bar */}
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">{m.filter_all_status()}</option>
              <option value="online">{m.status_online()}</option>
              <option value="away">{m.status_away()}</option>
              <option value="offline">{m.status_offline()}</option>
            </select>
            <div style={{ width: 200 }}>
              <CustomerCombobox
                value={filterOs === 'all' ? '' : filterOs}
                onChange={(v) => setFilterOs(v || 'all')}
                options={osNames}
                placeholder={m.filter_all_os()}
                commitMode="select"
                clearLabel={m.filter_all_os()}
                aria-label={m.filter_all_os()}
              />
            </div>
            <div style={{ width: 200 }}>
              <CustomerCombobox
                value={filterCustomer === 'all' ? '' : filterCustomer}
                onChange={(v) => setFilterCustomer(v || 'all')}
                options={customerNames}
                placeholder={m.filter_all_customers()}
                commitMode="select"
                clearLabel={m.filter_all_customers()}
                aria-label={m.filter_all_customers()}
              />
            </div>
            {hasActiveFilters && (
              <button
                className="tv-btn tv-btn--ghost tv-btn--xs"
                onClick={clearFilters}
                style={{ color: 'var(--fg-3)' }}
              >
                <X size={12} />
                {m.filter_reset()}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: 'var(--fg-3)', display: 'inline-flex', gap: 12 }}>
              <span className="tnum">{m.stat_online({ count: stats?.online ?? 0 })}</span>
              <span className="tnum">
                {m.stat_customers({ count: stats?.customers.length ?? 0 })}
              </span>
            </span>
          </div>

          {/* Scroll area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
            {listQuery.isLoading ? (
              <EmptyState>{m.loading()}</EmptyState>
            ) : devices.length === 0 ? (
              <div className="tv-card tv-flush">
                <EmptyState>{m.empty_devices()}</EmptyState>
              </div>
            ) : view === 'table' ? (
              <TableView
                devices={devices}
                onOpen={setDetail}
                onConnect={onConnect}
                onEdit={openEdit}
                onDelete={onDelete}
                onToggleFavorite={toggleFavorite}
              />
            ) : view === 'grouped' ? (
              <GroupedView groups={grouped} onOpen={setDetail} onConnect={onConnect} />
            ) : (
              <CardsView
                devices={devices}
                onOpen={setDetail}
                onConnect={onConnect}
                onEdit={openEdit}
                onToggleFavorite={toggleFavorite}
              />
            )}
          </div>
        </div>
      </div>

      {/* ===== STATUS BAR ===== */}
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
        <span style={{ color: 'var(--fg-3)' }}>
          {m.sb_devices({ count: stats?.total ?? 0 })}
        </span>
        <span className="mono">{m.app_name()}</span>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {m.sb_selfhosted()}
        </span>
      </div>

      <DeviceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        device={editing}
        customers={customerNames}
        operatingSystems={osNames}
        onSubmit={submitForm}
        busy={createMut.isPending || updateMut.isPending}
      />
      <DeviceDetailDrawer
        device={detail}
        onOpenChange={(o) => !o && setDetail(null)}
        onConnect={onConnect}
        onEdit={openEdit}
        onDelete={onDelete}
        onCopyId={copyId}
        onToggleFavorite={toggleFavorite}
        reveal={reveal}
      />
      <CustomersDialog open={customersOpen} onOpenChange={setCustomersOpen} />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <UsersDialog
        open={usersOpen}
        onOpenChange={setUsersOpen}
        currentUserId={user.id}
      />
      <AuditDialog open={auditOpen} onOpenChange={setAuditOpen} />
      <EnrollmentDialog
        open={enrollmentOpen}
        onOpenChange={setEnrollmentOpen}
        customerNames={customerNames}
      />
      <ConfirmDeleteDialog
        device={pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function BrandLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 6,
          backgroundImage: 'var(--brand-gradient)',
          color: 'var(--brand-fg)',
        }}
      >
        <MonitorDot size={14} strokeWidth={2} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
        rustdesk<span style={{ color: 'var(--brand)' }}>·</span>book
      </span>
    </div>
  )
}

function SidebarHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 14px 6px',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        color: 'var(--fg-4)',
      }}
    >
      {children}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-4)', fontSize: 13 }}>
      {children}
    </div>
  )
}

function StatusDot({ status }: { status: Device['status'] }) {
  return (
    <span
      className={`tv-dot ${STATUS_META[status].dot}`}
      style={{ width: 8, height: 8 }}
      title={statusLabel(status)}
    />
  )
}

function FavoriteButton({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      className="tv-btn tv-btn--ghost tv-btn--icon-xs"
      title={active ? m.favorite_remove() : m.favorite_add()}
      aria-label={active ? m.favorite_remove() : m.favorite_add()}
      aria-pressed={active}
      style={active ? { color: 'var(--brand)' } : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <Star size={13} style={active ? { fill: 'currentColor' } : undefined} />
    </button>
  )
}

function ConnectButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      className="tv-btn tv-btn--default tv-btn--xs"
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
    >
      <Power size={12} strokeWidth={1.75} />
      {m.common_connect()}
    </button>
  )
}

function UserMenu({
  initials,
  name,
  email,
  isAdmin,
  onInvite,
  onUsers,
  onAudit,
  onEnrollment,
  onSignOut,
}: {
  initials: string
  name: string
  email: string
  isAdmin: boolean
  onInvite: () => void
  onUsers: () => void
  onAudit: () => void
  onEnrollment: () => void
  onSignOut: () => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="tv-avatar tv-avatar--sm"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 11, border: 'none', cursor: 'pointer' }}
          aria-label={m.user_menu()}
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          style={{
            minWidth: 200,
            padding: 6,
            borderRadius: 8,
            background: 'var(--bg-panel)',
            boxShadow: 'var(--sh-pop), var(--ring-card)',
            fontSize: 12.5,
            zIndex: 70,
          }}
        >
          <div style={{ padding: '6px 8px' }}>
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{email}</div>
          </div>
          <div style={{ height: 1, background: 'var(--bd-subtle)', margin: '4px 0' }} />
          <DropdownMenu.Item asChild>
            <button className="tv-menu-item" onClick={onEnrollment}>
              <Rocket size={14} /> {m.enrollment_menu()}
            </button>
          </DropdownMenu.Item>
          {isAdmin && (
            <>
              <DropdownMenu.Item asChild>
                <button className="tv-menu-item" onClick={onUsers}>
                  <Users size={14} /> {m.users_menu()}
                </button>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <button className="tv-menu-item" onClick={onInvite}>
                  <Mail size={14} /> {m.invite_users()}
                </button>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <button className="tv-menu-item" onClick={onAudit}>
                  <History size={14} /> {m.audit_menu()}
                </button>
              </DropdownMenu.Item>
            </>
          )}
          <DropdownMenu.Item asChild>
            <button className="tv-menu-item" onClick={onSignOut}>
              <LogOut size={14} /> {m.sign_out()}
            </button>
          </DropdownMenu.Item>
          <div style={{ height: 1, background: 'var(--bd-subtle)', margin: '4px 0' }} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
            }}
          >
            <span style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{m.language()}</span>
            <LanguageSwitcher />
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/* ----- Views --------------------------------------------------------------- */

function DeviceTags({ tags }: { tags: string[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {tags.map((t) => (
        <span key={t} className="tv-chip tv-chip--neutral">
          {t}
        </span>
      ))}
    </span>
  )
}

function TableView({
  devices,
  onOpen,
  onConnect,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  devices: Device[]
  onOpen: (d: Device) => void
  onConnect: (d: Device) => void
  onEdit: (d: Device) => void
  onDelete: (d: Device) => void
  onToggleFavorite: (d: Device) => void
}) {
  return (
    <div className="tv-card tv-flush">
      <div style={{ overflowX: 'auto' }}>
        <table className="tv-table" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th style={{ width: 34 }} />
              <th>{m.th_id()}</th>
              <th>{m.th_alias()}</th>
              <th>{m.th_customer()}</th>
              <th>{m.th_tags()}</th>
              <th>{m.th_os()}</th>
              <th>{m.th_last_seen()}</th>
              <th>{m.th_password()}</th>
              <th style={{ textAlign: 'right' }}>{m.th_action()}</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="tv-row-click" onClick={() => onOpen(d)}>
                <td>
                  <StatusDot status={d.status} />
                </td>
                <td className="mono" style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                  {formatRustdeskId(d.rustdeskId)}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{d.alias}</td>
                <td style={{ color: 'var(--fg-2)' }}>{d.customer || '—'}</td>
                <td>
                  <DeviceTags tags={d.tags} />
                </td>
                <td style={{ color: 'var(--fg-2)' }}>{osLabel(d.osKey)}</td>
                <td style={{ color: 'var(--fg-3)' }}>{formatLastSeen(d.lastSeen)}</td>
                <td className="mono" style={{ color: 'var(--fg-4)', letterSpacing: 1 }}>
                  {d.hasPassword ? '••••••••' : '—'}
                </td>
                <td>
                  <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <FavoriteButton
                      active={d.isFavorite}
                      onToggle={() => onToggleFavorite(d)}
                    />
                    <ConnectButton onClick={() => onConnect(d)} />
                    <button
                      className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                      title={m.common_edit()}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(d)
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                      title={m.common_delete()}
                      style={{ color: 'var(--s-err)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(d)
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupedView({
  groups,
  onOpen,
  onConnect,
}: {
  groups: { name: string; items: Device[] }[]
  onOpen: (d: Device) => void
  onConnect: (d: Device) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map((g) => (
        <div key={g.name} className="tv-card tv-flush">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 14px',
              borderBottom: '1px solid var(--bd-subtle)',
            }}
          >
            <Building2 size={15} strokeWidth={1.5} style={{ color: 'var(--fg-3)' }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</span>
            <span className="tv-badge tv-badge--secondary">{g.items.length}</span>
          </div>
          {g.items.map((d) => (
            <div
              key={d.id}
              className="tv-row-click"
              onClick={() => onOpen(d)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 14px',
                borderBottom: '1px solid var(--bd-subtle)',
              }}
            >
              <StatusDot status={d.status} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--fg-2)', width: 110 }}>
                {formatRustdeskId(d.rustdeskId)}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  width: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.alias}
              </span>
              <span style={{ color: 'var(--fg-3)', flex: 1 }}>{osLabel(d.osKey)}</span>
              <DeviceTags tags={d.tags} />
              <ConnectButton onClick={() => onConnect(d)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function CardsView({
  devices,
  onOpen,
  onConnect,
  onEdit,
  onToggleFavorite,
}: {
  devices: Device[]
  onOpen: (d: Device) => void
  onConnect: (d: Device) => void
  onEdit: (d: Device) => void
  onToggleFavorite: (d: Device) => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))',
        gap: 14,
      }}
    >
      {devices.map((d) => (
        <div
          key={d.id}
          className="tv-card tv-row-click"
          onClick={() => onOpen(d)}
          style={{ gap: 10, padding: '14px 0' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px' }}>
            <span
              className="tv-avatar tv-avatar--sm"
              style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)' }}
            >
              <Monitor size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.alias}
              </div>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                {formatRustdeskId(d.rustdeskId)}
              </div>
            </div>
            <FavoriteButton
              active={d.isFavorite}
              onToggle={() => onToggleFavorite(d)}
            />
            <span className={STATUS_META[d.status].chip}>{statusLabel(d.status)}</span>
          </div>
          <div
            style={{
              padding: '0 14px',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '4px 10px',
              fontSize: 12,
              color: 'var(--fg-3)',
            }}
          >
            <span>{m.label_customer()}</span>
            <span style={{ color: 'var(--fg-2)', textAlign: 'right' }}>{d.customer || '—'}</span>
            <span>{m.label_os()}</span>
            <span style={{ color: 'var(--fg-2)', textAlign: 'right' }}>{osLabel(d.osKey)}</span>
            <span>{m.label_last()}</span>
            <span style={{ color: 'var(--fg-2)', textAlign: 'right' }}>
              {formatLastSeen(d.lastSeen)}
            </span>
          </div>
          {d.tags.length > 0 && (
            <div style={{ padding: '0 14px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <DeviceTags tags={d.tags} />
            </div>
          )}
          <div
            style={{
              padding: '10px 14px 0',
              marginTop: 2,
              borderTop: '1px solid var(--bd-subtle)',
              display: 'flex',
              gap: 6,
            }}
          >
            <button
              className="tv-btn tv-btn--default tv-btn--sm"
              style={{ flex: 1, minWidth: 0 }}
              onClick={(e) => {
                e.stopPropagation()
                onConnect(d)
              }}
            >
              <Power size={14} strokeWidth={1.75} />
              {m.common_connect()}
            </button>
            <button
              className="tv-btn tv-btn--outline tv-btn--icon-sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(d)
              }}
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
