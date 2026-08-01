import { describe, expect, it } from 'vitest'

import {
  CACHEABLE_DEVICE_FIELDS,
  cacheableDevice,
  displayStatus,
  readDeviceCache,
  snapshotDevices,
  staleDevices,
} from '#/lib/offline-cache'
import type { Device } from '#/orpc/schema'

const device: Device = {
  id: '11111111-2222-4333-8444-555555555555',
  rustdeskId: '123456789',
  alias: 'Reception PC',
  customer: 'Acme',
  customerId: '99999999-2222-4333-8444-555555555555',
  osKey: 'win11',
  tags: ['office'],
  status: 'online',
  lastSeen: '2026-01-02T03:04:05.000Z',
  hasPassword: true,
  isFavorite: false,
  notes: 'front desk',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const NOW = Date.parse('2026-01-02T12:00:00.000Z')

describe('cacheableDevice', () => {
  it('keeps the fields the address book is built from', () => {
    expect(cacheableDevice(device)).toEqual(device)
  })

  // The acceptance criterion in issue #37, as a test: no secret reaches the
  // device's own storage, whatever the server one day adds to the projection.
  it('drops every field outside the allowlist', () => {
    const leaky = {
      ...device,
      password: 's3cret',
      passwordCipher: 'YmFzZTY0',
      sessionToken: 'abc',
      enrollmentToken: 'def',
    } as unknown as Device

    const cached = cacheableDevice(leaky) as Record<string, unknown>
    expect(Object.keys(cached).sort()).toEqual(
      [...CACHEABLE_DEVICE_FIELDS].sort(),
    )
    for (const key of [
      'password',
      'passwordCipher',
      'sessionToken',
      'enrollmentToken',
    ]) {
      expect(cached).not.toHaveProperty(key)
    }
  })

  it('writes nothing secret-shaped into what gets stored', () => {
    const leaky = {
      ...device,
      password: 's3cret',
      passwordCipher: 'YmFzZTY0',
      token: 'enrollment-token',
    } as unknown as Device
    const serialized = JSON.stringify(snapshotDevices('user-1', [leaky], NOW))

    expect(serialized).not.toContain('s3cret')
    expect(serialized).not.toContain('YmFzZTY0')
    expect(serialized).not.toContain('enrollment-token')
    expect(serialized).not.toContain('passwordCipher')
  })
})

describe('snapshotDevices', () => {
  it('stamps the snapshot with its owner and the time it was read', () => {
    const snapshot = snapshotDevices('user-1', [device], NOW)
    expect(snapshot.userId).toBe('user-1')
    expect(snapshot.fetchedAt).toBe(NOW)
    expect(snapshot.devices).toHaveLength(1)
  })
})

describe('readDeviceCache', () => {
  const stored = JSON.parse(
    JSON.stringify(snapshotDevices('user-1', [device], NOW)),
  ) as unknown

  it('returns the snapshot when it belongs to the current user', () => {
    expect(readDeviceCache(stored, 'user-1')?.devices).toHaveLength(1)
  })

  // The second line of defence behind the wipe on sign-out: a snapshot that
  // survived an account switch is never shown to the account that follows.
  it('refuses a snapshot written by another user', () => {
    expect(readDeviceCache(stored, 'user-2')).toBeNull()
  })

  it('returns whatever this browser stored when no user is known', () => {
    expect(readDeviceCache(stored)?.userId).toBe('user-1')
  })

  it('rejects anything that is not a snapshot', () => {
    expect(readDeviceCache(null)).toBeNull()
    expect(readDeviceCache('nonsense')).toBeNull()
    expect(readDeviceCache({ userId: 'user-1' })).toBeNull()
    expect(
      readDeviceCache({ userId: 1, fetchedAt: NOW, devices: [] }),
    ).toBeNull()
    expect(
      readDeviceCache({ userId: 'u', fetchedAt: 'soon', devices: [] }),
    ).toBeNull()
  })
})

describe('displayStatus', () => {
  it('reports a live device by its status', () => {
    expect(displayStatus({ status: 'online' })).toBe('online')
  })

  // "A cached online is never presented as current truth" — the one funnel
  // every view goes through, so the rule cannot be forgotten in a component.
  it('never presents a cached status as current', () => {
    expect(displayStatus({ status: 'online', stale: true })).toBe('unknown')
    expect(displayStatus({ status: 'offline', stale: true })).toBe('unknown')
  })

  it('reports a device that was never sent as unknown too', () => {
    expect(displayStatus({ status: 'online', pending: true })).toBe('unknown')
  })
})

describe('staleDevices', () => {
  it('marks every row of a snapshot as stale', () => {
    const snapshot = snapshotDevices('user-1', [device], NOW)
    const rows = staleDevices(snapshot)
    expect(rows).toHaveLength(1)
    expect(rows[0].stale).toBe(true)
    expect(displayStatus(rows[0])).toBe('unknown')
  })
})
