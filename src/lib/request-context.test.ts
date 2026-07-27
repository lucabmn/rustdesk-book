import { afterEach, describe, expect, it } from 'vitest'

import { requestContextFrom } from './request-context'

afterEach(() => {
  delete process.env.TRUST_PROXY_HEADERS
})

const trustProxy = () => {
  process.env.TRUST_PROXY_HEADERS = 'true'
}

describe('requestContextFrom', () => {
  it('ignores proxy headers unless they are trusted', () => {
    const ctx = requestContextFrom(
      new Headers({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' }),
    )
    expect(ctx.ipAddress).toBeNull()
  })

  it('takes the first entry of a trusted x-forwarded-for', () => {
    trustProxy()
    const ctx = requestContextFrom(
      new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 9.9.9.9' }),
    )
    expect(ctx.ipAddress).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    trustProxy()
    expect(
      requestContextFrom(new Headers({ 'x-real-ip': '5.6.7.8' })).ipAddress,
    ).toBe('5.6.7.8')
  })

  it('is null when no address header is present', () => {
    trustProxy()
    expect(requestContextFrom(new Headers()).ipAddress).toBeNull()
  })

  it('reads the user agent and reports a missing one as null', () => {
    expect(
      requestContextFrom(new Headers({ 'user-agent': 'curl/8' })).userAgent,
    ).toBe('curl/8')
    expect(requestContextFrom(new Headers()).userAgent).toBeNull()
  })
})
