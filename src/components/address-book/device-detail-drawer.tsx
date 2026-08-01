import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Pencil, Power, Trash2 } from 'lucide-react'

import {
  Badge,
  Button,
  Divider,
  Drawer,
  Meta,
  MetaList,
  Section,
  StatusBadge,
} from '#/components/ui'
import { formatRustdeskId, osLabel } from '#/lib/device-meta'
import { formatLastSeen } from '#/lib/format'
import { type DisplayDevice, displayStatus } from '#/lib/offline-cache'
import { orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'
import { DeviceHistoryList } from './device-history-list'
import { DevicePasswordField } from './device-password-field'
import { FavoriteButton, PendingBadge } from './device-bits'
import { GroupMembership } from './group-membership'

interface Props {
  device: DisplayDevice | null
  onOpenChange: (open: boolean) => void
  onConnect: (device: DisplayDevice) => void
  onEdit: (device: DisplayDevice) => void
  onDelete: (device: DisplayDevice) => void
  onCopyId: (device: DisplayDevice) => void
  onToggleFavorite: (device: DisplayDevice) => void
  reveal: (device: DisplayDevice) => Promise<string>
  /** No connection: everything that is a server round trip steps aside. */
  offline?: boolean
}

/** Everything known about one device, without leaving the list behind it. */
export function DeviceDetailDrawer({
  device,
  onOpenChange,
  onConnect,
  onEdit,
  onDelete,
  onCopyId,
  onToggleFavorite,
  reveal,
  offline,
}: Props) {
  const [password, setPassword] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)

  // A device the server has never seen has no history and no groups, and
  // asking for either would be a request for a row that does not exist.
  const serverKnowsIt = device !== null && !device.pending && !offline

  const historyQuery = useQuery(
    orpc.audit.listForDevice.queryOptions({
      input: { deviceId: device?.id ?? '' },
      enabled: serverKnowsIt,
    }),
  )
  const history = historyQuery.data ?? []

  // Forget any revealed secret when the drawer target changes or closes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the device id only — a new object identity for the same device must not re-hide a revealed secret
  useEffect(() => {
    setPassword(null)
    setRevealing(false)
  }, [device?.id])

  async function toggleReveal() {
    if (!device) return
    if (password !== null) {
      setPassword(null)
      return
    }
    setRevealing(true)
    try {
      setPassword(await reveal(device))
    } finally {
      setRevealing(false)
    }
  }

  // Nothing selected: unmount entirely rather than keep a closed drawer around,
  // so no stale device data survives in the tree.
  if (!device) return null

  return (
    <Drawer
      open
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <span className="truncate">{device.alias}</span>
          {device.pending ? (
            <PendingBadge />
          ) : (
            <StatusBadge status={displayStatus(device)} />
          )}
        </span>
      }
      subtitle={
        <span className="tnum font-mono">
          {formatRustdeskId(device.rustdeskId)}
        </span>
      }
      actions={
        serverKnowsIt ? (
          <FavoriteButton
            active={device.isFavorite}
            onToggle={() => onToggleFavorite(device)}
          />
        ) : null
      }
      // Editing and deleting are server writes. Offline they are not offered
      // at all rather than offered and refused — issue #37 leaves them out
      // deliberately, and a disabled pair of buttons would suggest otherwise.
      footer={
        serverKnowsIt ? (
          <>
            <Button className="flex-1" onClick={() => onEdit(device)}>
              <Pencil />
              {m.common_edit()}
            </Button>
            <Button variant="danger" onClick={() => onDelete(device)}>
              <Trash2 />
              {m.common_delete()}
            </Button>
          </>
        ) : null
      }
    >
      {serverKnowsIt && (
        <div className="px-4 py-3.5">
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            onClick={() => onConnect(device)}
          >
            <Power />
            {m.drawer_open_session()}
          </Button>
        </div>
      )}

      <div className="px-4 pb-1">
        <MetaList>
          <Meta label={m.th_customer()}>{device.customer || '—'}</Meta>
          <Meta label={m.drawer_os()}>{osLabel(device.osKey)}</Meta>
          <Meta label={m.drawer_last_seen()}>
            {formatLastSeen(device.lastSeen)}
          </Meta>
          <Meta label={m.th_id()}>
            <button
              type="button"
              onClick={() => onCopyId(device)}
              title={m.drawer_copy()}
              aria-label={m.drawer_copy()}
              className="tnum inline-flex items-center gap-1.5 rounded font-mono text-text hover:text-accent"
            >
              {formatRustdeskId(device.rustdeskId)}
              <Copy className="size-3 text-faint" />
            </button>
          </Meta>
        </MetaList>
      </div>

      <Divider className="my-2" />

      <DevicePasswordField
        hasPassword={device.hasPassword}
        password={password}
        revealing={revealing}
        onToggleReveal={toggleReveal}
        offline={offline}
      />

      {device.tags.length > 0 && (
        <Section title={m.th_tags()}>
          <div className="flex flex-wrap gap-1">
            {device.tags.map((t) => (
              <Badge key={t} tone="accent">
                {t}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {device.notes && (
        <Section title={m.form_notes_label()}>
          <p className="whitespace-pre-wrap text-muted text-xs leading-relaxed">
            {device.notes}
          </p>
        </Section>
      )}

      {serverKnowsIt && (
        <>
          <Section title={m.drawer_groups()}>
            <GroupMembership deviceId={device.id} />
          </Section>

          <DeviceHistoryList history={history} />
        </>
      )}
    </Drawer>
  )
}
