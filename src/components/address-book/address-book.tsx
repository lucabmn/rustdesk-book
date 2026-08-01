import { useState } from 'react'

import { EmptyState, Spinner } from '#/components/ui'
import { ANY, initialsOf } from '#/lib/address-book-filters'
import type { SessionUser } from '#/lib/auth-server'
import type { ViewMode } from '#/lib/view-mode'
import { m } from '#/paraglide/messages'
import { AuditDialog } from './audit-dialog'
import { TopBar } from './chrome'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import { CustomersDialog } from './customers-dialog'
import { DeviceDetailDrawer } from './device-detail-drawer'
import { DeviceFormDialog } from './device-form-dialog'
import { EnrollmentDialog } from './enrollment-dialog'
import { FilterSheet, FilterSidebar } from './filter-sidebar'
import { InviteDialog } from './invite-dialog'
import { OfflineNotice } from './offline-notice'
import { QueueDialog } from './queue-dialog'
import { ContentHeader } from './toolbar'
import { useAddressBook } from './use-address-book'
import { UsersDialog } from './users-dialog'
import { CardsView } from './views/cards-view'
import { GroupedView } from './views/grouped-view'
import { TableView } from './views/table-view'

/**
 * Address-book shell: one top bar, one sidebar, one content header, then data.
 * Layout and composition only — all state lives in {@link useAddressBook}, all
 * filter logic in `lib/address-book-filters`.
 */
export function AddressBook({
  user,
  initialView,
}: {
  user: SessionUser
  initialView: ViewMode
}) {
  const book = useAddressBook(initialView, user.id)
  const { filters, patch, actions, stats } = book
  const isAdmin = user.role === 'admin'

  // Only ever true below `lg`, where the sidebar has folded into a sheet — the
  // control that sets it is hidden at every wider size.
  const [navOpen, setNavOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [customersOpen, setCustomersOpen] = useState(false)
  const [enrollmentOpen, setEnrollmentOpen] = useState(false)

  // The table bleeds into a bounded scroll area so its header can pin; the card
  // and grouped views are collections of their own surfaces and keep padding.
  const isTable = book.view === 'table'

  // Shared by the permanent sidebar and the sheet it becomes on a narrow
  // screen, so the two can never present different filters.
  const navProps = {
    filters,
    patch,
    onToggleTag: actions.toggleTag,
    total: stats?.total,
    customers: stats?.customers ?? [],
    operatingSystems: stats?.operatingSystems ?? [],
    tags: stats?.tags ?? [],
    isAdmin,
    onManageCustomers: () => setCustomersOpen(true),
    offline: book.offline,
  }

  function body() {
    if (book.isLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-16 text-muted text-xs">
          <Spinner className="size-3.5" />
          {m.loading()}
        </div>
      )
    }
    if (book.devices.length === 0) {
      return <EmptyState className="py-20">{m.empty_devices()}</EmptyState>
    }
    if (isTable) {
      return (
        <TableView
          devices={book.devices}
          onOpen={book.setDetail}
          onConnect={actions.connect}
          onEdit={actions.openEdit}
          onDelete={book.setPendingDelete}
          onToggleFavorite={actions.toggleFavorite}
        />
      )
    }
    if (book.view === 'grouped') {
      return (
        <GroupedView
          groups={book.grouped}
          onOpen={book.setDetail}
          onConnect={actions.connect}
        />
      )
    }
    return (
      <CardsView
        devices={book.devices}
        onOpen={book.setDetail}
        onConnect={actions.connect}
        onEdit={actions.openEdit}
        onToggleFavorite={actions.toggleFavorite}
      />
    )
  }

  return (
    <div
      data-theme={book.theme}
      // `dvh`, not `vh`: a mobile browser counts its collapsing address bar as
      // usable height, so a `h-screen` shell hides its own footer until the
      // user scrolls. `px-safe` keeps the chrome out from under a notch when
      // the phone is held sideways.
      className="flex h-dvh flex-col overflow-hidden bg-canvas px-safe text-text"
    >
      <TopBar
        search={filters.search}
        onSearch={(search) => patch({ search })}
        onAdd={actions.openAdd}
        theme={book.theme}
        onToggleTheme={actions.toggleTheme}
        onOpenNav={() => setNavOpen(true)}
        menu={{
          initials: initialsOf(user.name),
          name: user.name,
          email: user.email,
          isAdmin,
          onInvite: () => setInviteOpen(true),
          onUsers: () => setUsersOpen(true),
          onAudit: () => setAuditOpen(true),
          onEnrollment: () => setEnrollmentOpen(true),
          onSignOut: actions.signOut,
        }}
      />

      <div className="flex min-h-0 flex-1">
        <FilterSidebar {...navProps} />
        {/* Radix renders nothing while closed, so the navigation exists once
            in the tree at any moment despite being declared twice. */}
        <FilterSheet {...navProps} open={navOpen} onOpenChange={setNavOpen} />

        <main className="flex min-w-0 flex-1 flex-col">
          {/* Above the toolbar and in normal flow: what it says changes how
              everything below it should be read. */}
          <OfflineNotice
            offline={book.offline}
            fetchedAt={book.cachedAt}
            pending={book.pendingCount}
            stuck={book.stuckCount}
            onReview={() => book.setQueueOpen(true)}
          />
          <ContentHeader
            heading={
              filters.customer === ANY ? m.nav_all_devices() : filters.customer
            }
            count={book.devices.length}
            onlineCount={stats?.online ?? 0}
            customerCount={stats?.customers.length ?? 0}
            view={book.view}
            onView={book.setView}
            syncEnabled={book.syncEnabled}
            syncPending={book.syncPending}
            onSyncNow={book.syncNow}
            onExport={actions.exportDevices}
            onImportFile={actions.importFile}
            hasActiveFilters={book.hasActiveFilters}
            onResetFilters={actions.clearFilters}
          />

          <div
            className={
              isTable
                ? 'min-h-0 flex-1'
                : 'min-h-0 flex-1 overflow-y-auto p-3 sm:p-4'
            }
          >
            {body()}
          </div>
        </main>
      </div>

      <DeviceFormDialog
        open={book.formOpen}
        onOpenChange={book.setFormOpen}
        device={book.editing}
        customers={book.customerNames}
        operatingSystems={book.osNames}
        onSubmit={actions.submitForm}
        busy={book.formBusy}
        offline={book.offline}
      />
      <DeviceDetailDrawer
        device={book.detail}
        onOpenChange={(open) => !open && book.setDetail(null)}
        onConnect={actions.connect}
        onEdit={actions.openEdit}
        onDelete={book.setPendingDelete}
        onCopyId={actions.copyId}
        onToggleFavorite={actions.toggleFavorite}
        reveal={actions.reveal}
        offline={book.offline}
      />
      <QueueDialog
        open={book.queueOpen}
        onOpenChange={book.setQueueOpen}
        queue={book.queue}
        offline={book.offline}
        conflictNames={book.conflictNames}
        onAdopt={actions.adoptConflict}
        onDiscard={actions.discardEntry}
        onRetry={actions.retryEntry}
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
        customerNames={book.customerNames}
      />
      <ConfirmDeleteDialog
        device={book.pendingDelete}
        onOpenChange={(open) => !open && book.setPendingDelete(null)}
        onConfirm={actions.confirmDelete}
      />
    </div>
  )
}
