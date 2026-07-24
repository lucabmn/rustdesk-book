import { describe, expect, it } from 'vitest'

import { toPublicDevice } from './device-service'
import type { devices } from '#/db/schema'

type DeviceRow = typeof devices.$inferSelect

const row: DeviceRow = {
  id: '11111111-1111-1111-1111-111111111111',
  rustdeskId: '482910375',
  alias: 'Empfang-PC',
  customerId: '99999999-9999-9999-9999-999999999999',
  osKey: 'win11',
  tags: ['Kasse'],
  status: 'online',
  lastSeen: new Date('2026-01-01T10:00:00Z'),
  passwordCipher: 'BASE64_CIPHERTEXT_VALUE',
  notes: 'Kassen-PC',
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T09:00:00Z'),
  updatedAt: new Date('2026-01-01T09:30:00Z'),
}

describe('toPublicDevice', () => {
  it('never exposes the password, only a hasPassword flag', () => {
    const pub = toPublicDevice(row)
    expect(pub).not.toHaveProperty('passwordCipher')
    expect(pub).not.toHaveProperty('password')
    expect(pub.hasPassword).toBe(true)
    // Defense in depth: the ciphertext must not appear anywhere in the projection.
    expect(JSON.stringify(pub)).not.toContain('BASE64_CIPHERTEXT_VALUE')
  })

  it('reports hasPassword=false when no secret is stored', () => {
    expect(toPublicDevice({ ...row, passwordCipher: null }).hasPassword).toBe(false)
  })

  it('serializes timestamps to ISO strings', () => {
    const pub = toPublicDevice(row)
    expect(pub.lastSeen).toBe('2026-01-01T10:00:00.000Z')
    expect(pub.createdAt).toBe('2026-01-01T09:00:00.000Z')
  })

  it('projects the resolved customer name and id', () => {
    expect(toPublicDevice(row).customer).toBe(null)
    expect(toPublicDevice(row, undefined, 'Bäckerei Krause GmbH').customer).toBe(
      'Bäckerei Krause GmbH',
    )
    expect(toPublicDevice(row).customerId).toBe(row.customerId)
  })

  it('marks isFavorite from the supplied favorite set, false by default', () => {
    expect(toPublicDevice(row).isFavorite).toBe(false)
    expect(toPublicDevice(row, new Set([row.id])).isFavorite).toBe(true)
    expect(toPublicDevice(row, new Set(['other'])).isFavorite).toBe(false)
  })
})
