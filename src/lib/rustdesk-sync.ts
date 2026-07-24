/**
 * Optional live-status sync against a self-hosted RustDesk server.
 *
 * Real online/offline status is only available when you run your own RustDesk
 * server that exposes a peers/devices API (e.g. RustDesk Server Pro). Without a
 * configured server the address book keeps its manual status field untouched.
 *
 * Configuration (all optional; sync is disabled unless RUSTDESK_API_URL is set):
 *   RUSTDESK_API_URL    Base URL of the RustDesk server API, e.g.
 *                       https://rustdesk.example.com
 *   RUSTDESK_API_KEY    Bearer token / API key, if the server requires one.
 *   RUSTDESK_API_PATH   Path of the peers endpoint (default: /api/peers).
 *   RUSTDESK_SYNC_TTL   Minimum seconds between polls (default: 30).
 *
 * NOTE: the exact JSON shape of the RustDesk peers endpoint depends on your
 * server version and is NOT verified here — the parser below is deliberately
 * defensive and accepts several common shapes. Confirm the field names against
 * your actual server and adjust {@link normalizePeer} if needed.
 */
import { inArray } from 'drizzle-orm'

import type { db as Database } from '#/db'
import { devices } from '#/db/schema'
import type { DeviceStatus } from '#/lib/device-meta'

interface SyncConfig {
  url: string
  key: string | null
  path: string
  ttlMs: number
}

interface LivePeer {
  rustdeskId: string
  status: DeviceStatus
  lastSeen: Date | null
}

/** Resolve config from the environment, or null when sync is disabled. */
export function syncConfig(): SyncConfig | null {
  const url = process.env.RUSTDESK_API_URL?.trim()
  if (!url) return null
  const ttlSec = Number(process.env.RUSTDESK_SYNC_TTL ?? '30')
  return {
    url: url.replace(/\/+$/, ''),
    key: process.env.RUSTDESK_API_KEY?.trim() || null,
    path: process.env.RUSTDESK_API_PATH?.trim() || '/api/peers',
    ttlMs: (Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec : 30) * 1000,
  }
}

export const isSyncEnabled = (): boolean => syncConfig() !== null

let lastSyncAt = 0
let inFlight: Promise<number> | null = null

export function lastSyncedAt(): number {
  return lastSyncAt
}

/** Coerce one raw peer object into our shape, tolerating field-name variance. */
export function normalizePeer(raw: unknown): LivePeer | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = String(o.id ?? o.rustdesk_id ?? o.rid ?? o.peer_id ?? '').trim()
  if (!/^\d{6,12}$/.test(id)) return null

  const onlineRaw = o.online ?? o.is_online ?? o.status
  const online =
    onlineRaw === true ||
    onlineRaw === 1 ||
    onlineRaw === 'online' ||
    onlineRaw === '1'

  const lastRaw = o.last_online ?? o.last_seen ?? o.lastOnline ?? o.updated_at
  let lastSeen: Date | null = null
  if (typeof lastRaw === 'number') {
    // Heuristic: seconds vs milliseconds since epoch.
    lastSeen = new Date(lastRaw < 1e12 ? lastRaw * 1000 : lastRaw)
  } else if (typeof lastRaw === 'string' && lastRaw) {
    const d = new Date(lastRaw)
    if (!Number.isNaN(d.getTime())) lastSeen = d
  }
  if (online && !lastSeen) lastSeen = new Date()

  return { rustdeskId: id, status: online ? 'online' : 'offline', lastSeen }
}

/** Fetch and normalize the peer list from the configured RustDesk server. */
async function fetchPeers(cfg: SyncConfig): Promise<LivePeer[]> {
  // Hard timeout: this runs inside the device-list read path (incl. SSR), so a
  // slow/unreachable server must fail fast rather than hang every list load.
  const res = await fetch(`${cfg.url}${cfg.path}`, {
    headers: cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {},
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`RustDesk API responded ${res.status}`)
  const data: unknown = await res.json()
  const arr = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>)?.peers ??
      (data as Record<string, unknown>)?.data ??
      [])
  if (!Array.isArray(arr)) return []
  return arr.map(normalizePeer).filter((p): p is LivePeer => p !== null)
}

/** Apply live statuses to the devices table. Returns the number updated. */
async function applyStatuses(
  db: typeof Database,
  peers: LivePeer[],
): Promise<number> {
  if (!peers.length) return 0
  const byId = new Map(peers.map((p) => [p.rustdeskId, p]))
  const rows = await db
    .select({
      id: devices.id,
      rustdeskId: devices.rustdeskId,
      status: devices.status,
    })
    .from(devices)
    .where(inArray(devices.rustdeskId, [...byId.keys()]))

  let updated = 0
  for (const row of rows) {
    const peer = byId.get(row.rustdeskId)
    if (!peer) continue
    const statusChanged = row.status !== peer.status
    // Nothing to write if the status is unchanged and there's no fresh lastSeen.
    if (!statusChanged && peer.lastSeen === null) continue
    // Sync is authoritative when enabled: it overwrites the manual status.
    await db
      .update(devices)
      .set({
        status: peer.status,
        ...(peer.lastSeen ? { lastSeen: peer.lastSeen } : {}),
      })
      .where(inArray(devices.id, [row.id]))
    // Only count genuine status transitions so the "N updated" toast is honest.
    if (statusChanged) updated++
  }
  return updated
}

/**
 * Poll the RustDesk server and update device statuses, respecting the TTL so
 * concurrent requests don't hammer the API. Never throws — on failure it backs
 * off (stamps the attempt) and leaves the last known statuses in place.
 * `force: true` bypasses the TTL (used by an explicit "sync now" action).
 */
export async function maybeSyncStatuses(
  db: typeof Database,
  force = false,
): Promise<number> {
  const cfg = syncConfig()
  if (!cfg) return 0
  const now = Date.now()
  if (!force && now - lastSyncAt < cfg.ttlMs) return 0
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const peers = await fetchPeers(cfg)
      return await applyStatuses(db, peers)
    } catch (err) {
      console.error('[rustdesk-sync] poll failed:', err)
      return 0
    } finally {
      lastSyncAt = Date.now()
      inFlight = null
    }
  })()
  return inFlight
}
