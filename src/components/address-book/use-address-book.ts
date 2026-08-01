import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client'
import { client, orpc } from '#/orpc/client'
import {
  buildListInput,
  EMPTY_FILTERS,
  filterDevices,
  groupByCustomer,
  hasActiveFilters,
  mergeOsOptions,
  toggleTag as toggleTagIn,
  type FilterState,
} from '#/lib/address-book-filters'
import { type DisplayDevice, staleDevices } from '#/lib/offline-cache'
import { queuedDevices, stuckEntries } from '#/lib/offline-queue'
import type { SyncOutcome } from '#/lib/offline-sync'
import { useOfflineBook } from './use-offline-book'
import {
  EXPORT_FILENAME,
  parseDeviceImport,
  serializeDevices,
} from '#/lib/device-transfer'
import { formatRustdeskId } from '#/lib/device-meta'
import { clearRuntimeCache } from '#/lib/sw-client'
import { applyTheme, getCurrentTheme, type Theme } from '#/lib/theme'
import { type ViewMode, writeViewCookie } from '#/lib/view-mode'
import type { Device, DeviceInput } from '#/orpc/schema'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'

export type { ViewMode }

/**
 * All address-book state: filters, server data, mutations and the actions the
 * shell wires to its controls. Keeping it here leaves the components purely
 * about layout.
 *
 * `initialView` comes from the route loader, which reads it from a cookie, so
 * the server renders the view the user last chose instead of a default the
 * client then has to correct.
 */
export function useAddressBook(initialView: ViewMode, userId: string) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [view, setViewState] = useState<ViewMode>(initialView)
  const [theme, setTheme] = useState<Theme>(getCurrentTheme())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Device | null>(null)
  const [detail, setDetail] = useState<DisplayDevice | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DisplayDevice | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)

  /**
   * One summary for a whole transfer, in the words of issue #37: "3 devices
   * transferred", not a cascade of toasts. An expired session is the one
   * outcome that needs more than a sentence — it needs the login.
   */
  const onSynced = useCallback(
    (outcome: SyncOutcome) => {
      if (outcome.transferred.length) {
        void queryClient.invalidateQueries({ queryKey: orpc.devices.key() })
        void queryClient.invalidateQueries({ queryKey: orpc.customers.key() })
        toast(m.toast_transferred({ count: outcome.transferred.length }))
      }
      if (outcome.stoppedBy === 'unauthorized') {
        toast(m.toast_sync_expired())
        void router.navigate({ to: '/login' })
      }
    },
    [queryClient, router, toast],
  )

  const offlineBook = useOfflineBook({ userId, onSynced })

  const patch = (next: Partial<FilterState>) =>
    setFilters((current) => ({ ...current, ...next }))

  const setView = (next: ViewMode) => {
    writeViewCookie(next)
    setViewState(next)
  }

  const listQuery = useQuery(
    orpc.devices.list.queryOptions({ input: buildListInput(filters) }),
  )
  const statsQuery = useQuery(orpc.devices.stats.queryOptions({ input: {} }))
  const customersQuery = useQuery(
    orpc.customers.list.queryOptions({ input: {} }),
  )
  const syncInfoQuery = useQuery(
    orpc.devices.syncInfo.queryOptions({ input: {} }),
  )

  /**
   * Serving from the snapshot is not only about `navigator.onLine`: a server
   * that cannot be reached looks exactly the same from here, and a failed list
   * query is the more reliable of the two signals.
   */
  const degraded = !offlineBook.online || listQuery.isError

  // Keep the stored address book current — but only from an unfiltered list,
  // which is the whole book. Writing a filtered result would shrink the
  // snapshot to whatever the user last searched for.
  //
  // And only while the connection holds. React Query keeps the last successful
  // data after a failed refetch, so this effect can run again offline — with
  // hour-old devices and a fresh `Date.now()`, which would quietly reset the
  // age the notice is showing to "just now".
  const unfiltered = !hasActiveFilters(filters)
  useEffect(() => {
    if (listQuery.data && unfiltered && !degraded) {
      offlineBook.remember(listQuery.data)
    }
  }, [listQuery.data, unfiltered, degraded, offlineBook.remember])

  const devices = useMemo<DisplayDevice[]>(() => {
    const known: DisplayDevice[] =
      degraded && offlineBook.snapshot
        ? filterDevices(staleDevices(offlineBook.snapshot), filters)
        : (listQuery.data ?? [])
    // Newest first, and queued devices ahead of the rest: they are the ones
    // the user just typed and the ones they will look for.
    return [
      ...filterDevices(queuedDevices(offlineBook.queue), filters),
      ...known,
    ]
  }, [
    degraded,
    offlineBook.snapshot,
    offlineBook.queue,
    listQuery.data,
    filters,
  ])

  const stats = statsQuery.data
  const customerNames = customersQuery.data?.map((c) => c.name) ?? []
  const osNames = mergeOsOptions(stats?.operatingSystems.map((o) => o.name))
  const grouped = useMemo(
    () => groupByCustomer(devices, m.unassigned()),
    [devices],
  )

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.devices.key() })
    void queryClient.invalidateQueries({ queryKey: orpc.customers.key() })
  }
  const onError = (error: { message: string }) => toast(error.message)

  const createMut = useMutation(
    orpc.devices.create.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.toast_added())
        setFormOpen(false)
      },
      onError,
    }),
  )
  const updateMut = useMutation(
    orpc.devices.update.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.toast_updated())
        setFormOpen(false)
      },
      onError,
    }),
  )
  const removeMut = useMutation(
    orpc.devices.remove.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.toast_deleted())
      },
      onError,
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
      onError,
    }),
  )
  const syncMut = useMutation(
    orpc.devices.syncNow.mutationOptions({
      onSuccess: (r) => {
        invalidate()
        void queryClient.invalidateQueries({
          queryKey: orpc.devices.syncInfo.key(),
        })
        if (r.enabled) toast(m.toast_synced({ count: r.updated }))
      },
      onError,
    }),
  )

  const actions = {
    toggleFavorite(device: Device) {
      const favorite = !device.isFavorite
      favoriteMut.mutate({ id: device.id, favorite })
      // Keep the open drawer's star in sync — it holds its own snapshot.
      setDetail((d) =>
        d && d.id === device.id ? { ...d, isFavorite: favorite } : d,
      )
    },
    openAdd() {
      setEditing(null)
      setFormOpen(true)
    },
    openEdit(device: Device) {
      setDetail(null)
      setEditing(device)
      setFormOpen(true)
    },
    submitForm(input: DeviceInput) {
      if (editing) {
        updateMut.mutate({ id: editing.id, data: input })
        return
      }
      // Offline the form does not fail and it does not ask twice: the device
      // is taken, appears in the list immediately as not yet transferred, and
      // goes out by itself when there is a connection again.
      if (degraded) {
        offlineBook.enqueue(input)
        toast(m.toast_queued())
        setFormOpen(false)
        return
      }
      createMut.mutate(input)
    },
    confirmDelete(device: Device) {
      removeMut.mutate({ id: device.id })
      setPendingDelete(null)
      setDetail(null)
    },
    async connect(device: Device) {
      try {
        const { uri } = await client.devices.connect({ id: device.id })
        // The server stamped lastSeen — refetch so every view shows it.
        invalidate()
        window.location.href = uri
        toast(m.toast_connecting({ alias: device.alias }))
      } catch {
        toast(m.toast_connect_failed())
      }
    },
    async reveal(device: Device): Promise<string> {
      const { password } = await client.devices.revealPassword({
        id: device.id,
      })
      return password
    },
    copyId(device: Device) {
      try {
        void navigator.clipboard.writeText(formatRustdeskId(device.rustdeskId))
      } catch {
        /* clipboard unavailable */
      }
      toast(m.toast_id_copied())
    },
    async exportDevices() {
      try {
        // Same filter as the view it was triggered from, resolved server-side
        // so the audit entry records what actually left the server.
        const exported = await client.devices.exportDevices(
          buildListInput(filters),
        )
        const blob = new Blob([serializeDevices(exported.devices)], {
          type: 'application/json',
        })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = EXPORT_FILENAME
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
        toast(m.toast_exported({ count: exported.devices.length }))
      } catch {
        toast(m.toast_export_failed())
      }
    },
    importFile(file: File) {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          importMut.mutate({
            devices: parseDeviceImport(String(reader.result)),
          })
        } catch {
          toast(m.toast_invalid_format())
        }
      }
      reader.readAsText(file)
    },
    toggleTheme() {
      const next: Theme = theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      setTheme(next)
    },
    toggleTag(name: string) {
      patch({ tags: toggleTagIn(filters.tags, name) })
    },
    clearFilters() {
      setFilters(EMPTY_FILTERS)
    },
    async signOut() {
      await authClient.signOut()
      // Nothing user-specific is ever cached (see #/lib/sw-core), but a
      // sign-out is the moment to make that true of the device as well, not
      // just of the rules — so whatever the worker filled goes with it.
      await clearRuntimeCache()
      // And with it the address book this session stored and anything it
      // still had waiting. A queue outliving its session would be a stack of
      // one user's devices sitting in the next user's browser.
      await offlineBook.wipe()
      await router.navigate({ to: '/login' })
    },
    async adoptConflict(entryId: string) {
      try {
        await offlineBook.adopt(entryId)
        invalidate()
        toast(m.toast_adopted())
      } catch (error) {
        onError(error as { message: string })
      }
    },
    discardEntry(entryId: string) {
      offlineBook.discard(entryId)
      toast(m.toast_discarded())
    },
    retryEntry(entryId: string) {
      void offlineBook.retry(entryId)
    },
  }

  /**
   * The devices that entries collide with, so the decision dialog can name
   * them. Read from what is already on screen rather than fetched: the list
   * holds the whole address book, and a conflict is by definition with a
   * device that is in it.
   */
  const conflictNames = useMemo(() => {
    const names: Record<string, string | undefined> = {}
    for (const device of devices) names[device.id] = device.alias
    return names
  }, [devices])

  return {
    filters,
    patch,
    view,
    setView,
    theme,
    devices,
    grouped,
    stats,
    customerNames,
    osNames,
    // A failed list query settles fast, so without the second half of this an
    // offline start would paint "no devices" for as long as it takes to read
    // the store — an empty address book, briefly, for a user who has one.
    isLoading: listQuery.isLoading || (degraded && !offlineBook.ready),
    syncEnabled: syncInfoQuery.data?.enabled ?? false,
    syncPending: syncMut.isPending,
    syncNow: () => syncMut.mutate({}),
    formBusy: createMut.isPending || updateMut.isPending,
    hasActiveFilters: hasActiveFilters(filters),
    editing,
    formOpen,
    setFormOpen,
    detail,
    setDetail,
    pendingDelete,
    setPendingDelete,
    actions,
    offline: degraded,
    cachedAt: offlineBook.snapshot?.fetchedAt,
    queue: offlineBook.queue,
    pendingCount: offlineBook.pendingCount,
    stuckCount: stuckEntries(offlineBook.queue).length,
    conflictNames,
    queueOpen,
    setQueueOpen,
  }
}

export type AddressBookState = ReturnType<typeof useAddressBook>
