import { describe, expect, it } from 'vitest'

import { formatLastSeen } from '#/lib/format'

describe('formatLastSeen', () => {
  it('formats an ISO timestamp as a local date and time', () => {
    const formatted = formatLastSeen('2026-01-02T10:30:00Z')
    expect(formatted).toMatch(/2026/)
    expect(formatted).not.toBe('')
  })

  it('reports "never" for a missing or unparseable value', () => {
    const never = formatLastSeen(null)
    expect(never).toBeTruthy()
    expect(formatLastSeen('not-a-date')).toBe(never)
  })
})
