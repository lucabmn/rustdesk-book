import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client'
import { client, orpc } from '#/orpc/client'
import {
  buildListInput,
  EMPTY_FILTERS,
  groupByCustomer,
  hasActiveFilters,
  mergeOsOptions,
  toggleTag as toggleTagIn,
  type FilterState,
} from '#/lib/address-book-filters'
import {
  EXPORT_FILENAME,
  parseDeviceImport,
  serializeDevices,
} from '#/lib/device-transfer'
import { formatRustdeskId } from '#/lib/device-meta'
import { applyTheme, getCurrentTheme, type Theme } from '#/lib/theme'
import type { Device, DeviceInput } from '#/orpc/schema'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'

export type ViewMode = 'table' | 'grouped' | 'cards'

/**
 * All address-book state: filters, server data, mutations and the actions the
 * shell wires to its controls. Keeping it here leaves the components purely
 * about layout.
 */
export function useAddressBook() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [view, setView] = useState<ViewMode>('table')
  const [theme, setTheme] = useState<Theme>(getCurrentTheme())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Device | null>(null)
  const [detail, setDetail] = useState<Device | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Device | null>(null)

  const patch = (next: Partial<FilterState>) =>
    setFilters((current) => ({ ...current, ...next }))

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

  const devices = listQuery.data ?? []
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
      if (editing) updateMut.mutate({ id: editing.id, data: input })
      else createMut.mutate(input)
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
    exportDevices() {
      try {
        const blob = new Blob([serializeDevices(devices)], {
          type: 'application/json',
        })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = EXPORT_FILENAME
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
        toast(m.toast_exported({ count: devices.length }))
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
      await router.navigate({ to: '/login' })
    },
  }

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
    isLoading: listQuery.isLoading,
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
  }
}

export type AddressBookState = ReturnType<typeof useAddressBook>
