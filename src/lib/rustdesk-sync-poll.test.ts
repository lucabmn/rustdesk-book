import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { devices } from '#/db/schema'
import * as sync from '#/lib/rustdesk-sync'
import { createTestDb, type TestDb } from '#/test/db'

let db: TestDb

const realFetch = globalThis.fetch
const realConsoleError = console.error

/** Swap `fetch` for a stub that answers with the given peers payload. */
function mockPeers(body: unknown, ok = true) {
  const calls: Array<[string, RequestInit]> = []
  const fetchMock = async (url: string, init: RequestInit) => {
    calls.push([url, init])
    return ok
      ? new Response(JSON.stringify(body), {
          headers: { 'content-type': 'application/json' },
        })
      : new Response('nope', { status: 503 })
  }
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return { calls }
}

beforeEach(async () => {
  db = await createTestDb()
  sync.resetSyncState()
  process.env.RUSTDESK_API_URL = 'https://rustdesk.example.com/'
  delete process.env.RUSTDESK_API_KEY
  delete process.env.RUSTDESK_API_PATH
  delete process.env.RUSTDESK_SYNC_TTL
  await db.insert(devices).values([
    { rustdeskId: '123456789', alias: 'One', status: 'offline' },
    { rustdeskId: '222222222', alias: 'Two', status: 'online' },
  ])
})

afterEach(async () => {
  await db.$close()
  globalThis.fetch = realFetch
  console.error = realConsoleError
  delete process.env.RUSTDESK_API_URL
  delete process.env.RUSTDESK_SYNC_TTL
})

describe('syncConfig', () => {
  it('is disabled without a server URL', async () => {
    delete process.env.RUSTDESK_API_URL
    sync.resetSyncState()
    expect(sync.syncConfig()).toBeNull()
    expect(sync.isSyncEnabled()).toBe(false)
  })

  it('normalizes the URL and applies the defaults', async () => {
    sync.resetSyncState()
    expect(sync.syncConfig()).toEqual({
      url: 'https://rustdesk.example.com',
      key: null,
      path: '/api/peers',
      ttlMs: 30_000,
    })
  })

  it('falls back to the default TTL for nonsense values', async () => {
    process.env.RUSTDESK_SYNC_TTL = 'not-a-number'
    expect(sync.syncConfig()?.ttlMs).toBe(30_000)
    process.env.RUSTDESK_SYNC_TTL = '-5'
    expect(sync.syncConfig()?.ttlMs).toBe(30_000)
    process.env.RUSTDESK_SYNC_TTL = '90'
    expect(sync.syncConfig()?.ttlMs).toBe(90_000)
  })
})

describe('maybeSyncStatuses', () => {
  it('does nothing when sync is disabled', async () => {
    delete process.env.RUSTDESK_API_URL
    sync.resetSyncState()
    const fetch = mockPeers([])
    expect(await sync.maybeSyncStatuses(db as never)).toBe(0)
    expect(fetch.calls).toHaveLength(0)
  })

  it('applies live statuses and counts only real transitions', async () => {
    sync.resetSyncState()
    mockPeers([
      { id: '123456789', online: true },
      { id: '222222222', online: true },
    ])

    expect(await sync.maybeSyncStatuses(db as never)).toBe(1)
    const rows = await db.select().from(devices)
    expect(rows.every((r) => r.status === 'online')).toBe(true)
    expect(rows.every((r) => r.lastSeen !== null)).toBe(true)
    expect(sync.lastSyncedAt()).toBeGreaterThan(0)
  })

  it('sends the API key and honours a custom path', async () => {
    process.env.RUSTDESK_API_KEY = 'secret-key'
    process.env.RUSTDESK_API_PATH = '/custom/peers'
    sync.resetSyncState()
    const fetch = mockPeers({ peers: [{ id: '123456789', online: true }] })

    await sync.maybeSyncStatuses(db as never)
    const [url, init] = fetch.calls[0]
    expect(url).toBe('https://rustdesk.example.com/custom/peers')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer secret-key',
    )
  })

  it('accepts the { data: [...] } envelope and skips unknown peers', async () => {
    sync.resetSyncState()
    mockPeers({ data: [{ id: '999999999', online: true }] })
    expect(await sync.maybeSyncStatuses(db as never)).toBe(0)
  })

  it('tolerates a non-array payload', async () => {
    sync.resetSyncState()
    mockPeers({ peers: 'nope' })
    expect(await sync.maybeSyncStatuses(db as never)).toBe(0)
  })

  it('respects the TTL and can be forced past it', async () => {
    sync.resetSyncState()
    const fetch = mockPeers([{ id: '123456789', online: true }])

    expect(await sync.maybeSyncStatuses(db as never)).toBe(1)
    expect(await sync.maybeSyncStatuses(db as never)).toBe(0)
    expect(fetch.calls).toHaveLength(1)

    await sync.maybeSyncStatuses(db as never, true)
    expect(fetch.calls).toHaveLength(2)
  })

  it('shares one in-flight poll between concurrent callers', async () => {
    sync.resetSyncState()
    const fetch = mockPeers([{ id: '123456789', online: true }])
    const [a, b] = await Promise.all([
      sync.maybeSyncStatuses(db as never),
      sync.maybeSyncStatuses(db as never),
    ])
    expect(fetch.calls).toHaveLength(1)
    expect(a).toBe(b)
  })

  it('never throws when the server is unreachable', async () => {
    sync.resetSyncState()
    console.error = () => undefined
    mockPeers(null, false)
    expect(await sync.maybeSyncStatuses(db as never)).toBe(0)
    // Failure still stamps the attempt so a dead server is not polled per request.
    expect(sync.lastSyncedAt()).toBeGreaterThan(0)
    // The manual statuses survive the failed poll.
    const rows = await db.select().from(devices)
    expect(rows.find((r) => r.rustdeskId === '222222222')?.status).toBe(
      'online',
    )
  })

  it('leaves untouched devices alone when nothing changed', async () => {
    sync.resetSyncState()
    // Same status, no fresh lastSeen → no write at all.
    mockPeers([{ id: '123456789', online: false, last_online: null }])
    expect(await sync.maybeSyncStatuses(db as never)).toBe(0)
    const rows = await db.select().from(devices)
    expect(rows.find((r) => r.rustdeskId === '123456789')?.lastSeen).toBeNull()
  })
})
