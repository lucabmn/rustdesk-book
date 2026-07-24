import { describe, expect, it } from 'vitest'

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

  it('distinguishes the audited actions', () => {
    expect(auditActionLabel('connect')).not.toBe(
      auditActionLabel('reveal_password'),
    )
    expect(auditActionLabel('unknown')).toBe(
      auditActionLabel('reveal_password'),
    )
  })
})
