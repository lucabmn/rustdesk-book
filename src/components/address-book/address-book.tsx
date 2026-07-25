import { useState } from 'react'

import { Card, EmptyState, Spinner } from '#/components/ui'
import { ANY, initialsOf } from '#/lib/address-book-filters'
import type { SessionUser } from '#/lib/auth-server'
import { m } from '#/paraglide/messages'
import { AuditDialog } from './audit-dialog'
import { AppRail, StatusBar, TopBar } from './chrome'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import { CustomersDialog } from './customers-dialog'
import { DeviceDetailDrawer } from './device-detail-drawer'
import { DeviceFormDialog } from './device-form-dialog'
import { EnrollmentDialog } from './enrollment-dialog'
import { FilterSidebar } from './filter-sidebar'
import { InviteDialog } from './invite-dialog'
import { FilterBar, Toolbar } from './toolbar'
import { useAddressBook } from './use-address-book'
import { UsersDialog } from './users-dialog'
import { CardsView } from './views/cards-view'
import { GroupedView } from './views/grouped-view'
import { TableView } from './views/table-view'

/**
 * Address-book shell. Layout and composition only — all state lives in
 * {@link useAddressBook}, all filter logic in `lib/address-book-filters`.
 */
export function AddressBook({ user }: { user: SessionUser }) {
  const book = useAddressBook()
  const { filters, patch, actions, stats } = book
  const isAdmin = user.role === 'admin'

  const [inviteOpen, setInviteOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [customersOpen, setCustomersOpen] = useState(false)
  const [enrollmentOpen, setEnrollmentOpen] = useState(false)

  return (
    <div
      data-theme={book.theme}
      className="flex h-screen flex-col overflow-hidden bg-canvas text-text"
    >
      <TopBar
        search={filters.search}
        onSearch={(search) => patch({ search })}
        onAdd={actions.openAdd}
        theme={book.theme}
        onToggleTheme={actions.toggleTheme}
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
        <AppRail
          isAdmin={isAdmin}
          onEnrollment={() => setEnrollmentOpen(true)}
          onUsers={() => setUsersOpen(true)}
          onAudit={() => setAuditOpen(true)}
          onInvite={() => setInviteOpen(true)}
        />

        <FilterSidebar
          filters={filters}
          patch={patch}
          onToggleTag={actions.toggleTag}
          total={stats?.total}
          customers={stats?.customers ?? []}
          tags={stats?.tags ?? []}
          isAdmin={isAdmin}
          onManageCustomers={() => setCustomersOpen(true)}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <Toolbar
            heading={
              filters.customer === ANY ? m.nav_all_devices() : filters.customer
            }
            count={book.devices.length}
            view={book.view}
            onView={book.setView}
            syncEnabled={book.syncEnabled}
            syncPending={book.syncPending}
            onSyncNow={book.syncNow}
            onExport={actions.exportDevices}
            onImportFile={actions.importFile}
          />

          <FilterBar
            filters={filters}
            patch={patch}
            osNames={book.osNames}
            customerNames={book.customerNames}
            hasActiveFilters={book.hasActiveFilters}
            onReset={actions.clearFilters}
            onlineCount={stats?.online ?? 0}
            customerCount={stats?.customers.length ?? 0}
          />

          <div className="flex-1 overflow-y-auto p-4">
            {book.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted text-xs">
                <Spinner className="size-3.5" />
                {m.loading()}
              </div>
            ) : book.devices.length === 0 ? (
              <Card>
                <EmptyState>{m.empty_devices()}</EmptyState>
              </Card>
            ) : book.view === 'table' ? (
              <TableView
                devices={book.devices}
                onOpen={book.setDetail}
                onConnect={actions.connect}
                onEdit={actions.openEdit}
                onDelete={book.setPendingDelete}
                onToggleFavorite={actions.toggleFavorite}
              />
            ) : book.view === 'grouped' ? (
              <GroupedView
                groups={book.grouped}
                onOpen={book.setDetail}
                onConnect={actions.connect}
              />
            ) : (
              <CardsView
                devices={book.devices}
                onOpen={book.setDetail}
                onConnect={actions.connect}
                onEdit={actions.openEdit}
                onToggleFavorite={actions.toggleFavorite}
              />
            )}
          </div>
        </main>
      </div>

      <StatusBar total={stats?.total ?? 0} />

      <DeviceFormDialog
        open={book.formOpen}
        onOpenChange={book.setFormOpen}
        device={book.editing}
        customers={book.customerNames}
        operatingSystems={book.osNames}
        onSubmit={actions.submitForm}
        busy={book.formBusy}
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
