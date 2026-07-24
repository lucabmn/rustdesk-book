import { describe, expect, it } from 'vitest'

import { normalizePeer } from './rustdesk-sync'

describe('normalizePeer', () => {
  it('accepts the canonical shape and marks online', () => {
    const p = normalizePeer({ id: '482910375', online: true })
    expect(p).not.toBeNull()
    expect(p!.rustdeskId).toBe('482910375')
    expect(p!.status).toBe('online')
    expect(p!.lastSeen).toBeInstanceOf(Date) // online → synthesized lastSeen
  })

  it('tolerates alternative field names', () => {
    const p = normalizePeer({ rustdesk_id: '100000001', is_online: 0 })
    expect(p!.rustdeskId).toBe('100000001')
    expect(p!.status).toBe('offline')
    expect(p!.lastSeen).toBeNull()
  })

  it('parses epoch seconds and milliseconds for last_online', () => {
    const secs = normalizePeer({ id: '100000002', online: false, last_online: 1_700_000_000 })
    const ms = normalizePeer({ id: '100000003', online: false, last_online: 1_700_000_000_000 })
    expect(secs!.lastSeen!.getTime()).toBe(1_700_000_000_000)
    expect(ms!.lastSeen!.getTime()).toBe(1_700_000_000_000)
  })

  it('rejects rows without a valid RustDesk id', () => {
    expect(normalizePeer({ id: 'abc', online: true })).toBeNull()
    expect(normalizePeer({ online: true })).toBeNull()
    expect(normalizePeer(null)).toBeNull()
    expect(normalizePeer('nope')).toBeNull()
  })

  it("treats 'online' string and 1 as online", () => {
    expect(normalizePeer({ id: '100000004', status: 'online' })!.status).toBe('online')
    expect(normalizePeer({ id: '100000005', online: 1 })!.status).toBe('online')
  })
})
