import { describe, expect, it } from 'vitest'

import {
  EnrollmentClaimSchema,
  EnrollmentFinalizeSchema,
  enrollmentTokenPrefix,
  generateEnrollmentToken,
  hashEnrollmentToken,
} from './enrollment'

describe('enrollment tokens', () => {
  it('generates opaque high-entropy tokens and stores only a digest', () => {
    const first = generateEnrollmentToken()
    const second = generateEnrollmentToken()

    expect(first).toMatch(/^rdb_[A-Za-z0-9_-]{43}$/)
    expect(second).not.toBe(first)
    expect(hashEnrollmentToken(first)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashEnrollmentToken(first)).not.toContain(first)
    expect(enrollmentTokenPrefix(first)).toBe(`${first.slice(0, 12)}…`)
  })

  it('accepts the payload emitted by deployment scripts', () => {
    const result = EnrollmentClaimSchema.parse({
      rustdeskId: '123456789',
      alias: 'WORKSTATION-01',
      hostname: 'WORKSTATION-01',
      os: 'Windows 11 Pro',
      rustdeskVersion: '1.4.9',
    })

    expect(result.rustdeskId).toBe('123456789')
  })

  it('rejects malformed IDs and weak passwords', () => {
    const base = { rustdeskId: '123456789', alias: 'PC' }
    expect(() => EnrollmentClaimSchema.parse({ ...base, rustdeskId: 'abc' })).toThrow()
    expect(() => EnrollmentFinalizeSchema.parse({ password: 'short' })).toThrow()
  })
})
