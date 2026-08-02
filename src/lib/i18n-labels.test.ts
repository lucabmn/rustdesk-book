import { describe, expect, it } from 'vitest'

import { AUDIT_ACTIONS } from '#/db/schema'
import {
  auditActionLabel,
  cacheAgeLabel,
  roleLabel,
  statusLabel,
} from '#/lib/i18n-labels'

describe('label helpers', () => {
  it('gives every device status its own non-empty label', () => {
    const labels = (['online', 'away', 'offline', 'unknown'] as const).map(
      statusLabel,
    )
    expect(labels.every(Boolean)).toBe(true)
    expect(new Set(labels).size).toBe(4)
  })

  it('distinguishes admins from members', () => {
    expect(roleLabel('admin')).not.toBe(roleLabel('member'))
    // Anything that is not 'admin' reads as a member.
    expect(roleLabel('something-else')).toBe(roleLabel('member'))
  })

  it('gives every known action its own label', () => {
    const labels = AUDIT_ACTIONS.map(auditActionLabel)
    expect(labels.every(Boolean)).toBe(true)
    expect(new Set(labels).size).toBe(AUDIT_ACTIONS.length)
  })

  it('shows an unknown action as its own key', () => {
    // The action set is open: an unlabelled action shows its key instead of
    // being mislabelled as a known one.
    expect(auditActionLabel('something_new')).toBe('something_new')
  })
})

describe('cacheAgeLabel', () => {
  const AT = Date.parse('2026-01-02T12:00:00.000Z')
  const agedBy = (ms: number) => cacheAgeLabel(AT, AT + ms)

  it('names each scale of age separately', () => {
    const labels = [
      agedBy(30_000),
      agedBy(12 * 60_000),
      agedBy(5 * 3600_000),
      agedBy(3 * 24 * 3600_000),
    ]
    expect(labels.every(Boolean)).toBe(true)
    expect(new Set(labels).size).toBe(4)
    expect(labels[1]).toContain('12')
    expect(labels[3]).toContain('3')
  })

  // A clock that ran backwards (a resync, a timezone change) must not produce
  // an age from the future.
  it('never reports a negative age', () => {
    expect(agedBy(-60_000)).toBe(agedBy(0))
  })
})
