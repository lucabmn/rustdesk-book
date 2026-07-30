import { describe, expect, it } from 'vitest'

import { AUDIT_ACTIONS } from '#/db/schema'
import { auditActionLabel, roleLabel, statusLabel } from '#/lib/i18n-labels'

describe('label helpers', () => {
  it('gives every device status its own non-empty label', () => {
    const labels = (['online', 'away', 'offline'] as const).map(statusLabel)
    expect(labels.every(Boolean)).toBe(true)
    expect(new Set(labels).size).toBe(3)
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
