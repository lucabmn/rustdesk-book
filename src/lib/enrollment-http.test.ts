import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { EnrollmentError } from '#/lib/enrollment'
import {
  bearerToken,
  enforceEnrollmentRateLimit,
  enrollmentErrorResponse,
  enrollmentJson,
  parseEnrollmentPayload,
} from '#/lib/enrollment-http'

function request(init: RequestInit & { url?: string } = {}) {
  return new Request(init.url ?? 'https://book.example.com/api/enroll', {
    method: 'POST',
    ...init,
  })
}

beforeEach(() => {
  delete process.env.TRUST_PROXY_HEADERS
})

afterEach(() => {
  delete process.env.TRUST_PROXY_HEADERS
})

describe('enrollmentJson', () => {
  it('never allows the response to be cached or sniffed', async () => {
    const res = enrollmentJson({ ok: true })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe('bearerToken', () => {
  it('extracts the token regardless of header casing', () => {
    const token = bearerToken(
      request({ headers: { authorization: 'bearer  rdb_abc  ' } }),
    )
    expect(token).toBe('rdb_abc')
  })

  it('rejects a missing or malformed authorization header', () => {
    expect(() => bearerToken(request())).toThrow(EnrollmentError)
    expect(() =>
      bearerToken(request({ headers: { authorization: 'Basic abc' } })),
    ).toThrow(/Bearer token required/)
  })
})

describe('parseEnrollmentPayload', () => {
  it('reads JSON bodies', async () => {
    const payload = await parseEnrollmentPayload(
      request({
        body: JSON.stringify({ rustdeskId: '123456789' }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(payload).toEqual({ rustdeskId: '123456789' })
  })

  it('reads form-encoded bodies', async () => {
    const payload = await parseEnrollmentPayload(
      request({
        body: 'rustdeskId=123456789&alias=PC',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      }),
    )
    expect(payload).toEqual({ rustdeskId: '123456789', alias: 'PC' })
  })

  it('rejects other content types', async () => {
    await expect(
      parseEnrollmentPayload(
        request({ body: 'x', headers: { 'content-type': 'text/plain' } }),
      ),
    ).rejects.toMatchObject({ status: 415, code: 'unsupported_media_type' })
  })

  it('rejects an oversized declared length', async () => {
    await expect(
      parseEnrollmentPayload(
        request({
          body: 'x',
          headers: {
            'content-type': 'application/json',
            'content-length': String(1024 * 1024),
          },
        }),
      ),
    ).rejects.toMatchObject({ status: 413 })
  })

  it('rejects an oversized streamed body', async () => {
    await expect(
      parseEnrollmentPayload(
        request({
          body: 'a'.repeat(17 * 1024),
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ).rejects.toMatchObject({ status: 413, code: 'payload_too_large' })
  })
})

describe('enforceEnrollmentRateLimit', () => {
  it('ignores forwarding headers unless the proxy is trusted', () => {
    // Untrusted: every caller shares the 'global' bucket, so a spoofed
    // X-Forwarded-For cannot mint a fresh quota.
    expect(() =>
      enforceEnrollmentRateLimit(
        request({ headers: { 'x-forwarded-for': '9.9.9.9' } }),
      ),
    ).not.toThrow()

    process.env.TRUST_PROXY_HEADERS = 'true'
    expect(() =>
      enforceEnrollmentRateLimit(
        request({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }),
      ),
    ).not.toThrow()
    expect(() =>
      enforceEnrollmentRateLimit(
        request({ headers: { 'x-real-ip': '4.3.2.1' } }),
      ),
    ).not.toThrow()
  })

  it('throws once a single client exceeds the window budget', () => {
    process.env.TRUST_PROXY_HEADERS = 'true'
    const ip = '203.0.113.7'
    const attempt = () =>
      enforceEnrollmentRateLimit(
        request({ headers: { 'x-forwarded-for': ip } }),
      )

    for (let i = 0; i < 300; i++) attempt()
    expect(attempt).toThrow(/Too many enrollment attempts/)
  })
})

describe('enrollmentErrorResponse', () => {
  it('maps enrollment errors onto their status and code', async () => {
    const res = enrollmentErrorResponse(
      new EnrollmentError(409, 'device_exists', 'nope'),
    )
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'device_exists', message: 'nope' })
  })

  it('maps malformed JSON to 400', async () => {
    const res = enrollmentErrorResponse(new SyntaxError('bad json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_json')
  })

  it('maps schema issues to 400 without echoing them back', async () => {
    const res = enrollmentErrorResponse({ issues: [{ path: ['password'] }] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'invalid_payload',
      message: 'Invalid enrollment payload.',
    })
  })

  it('hides unexpected failures behind a generic 500', async () => {
    const res = enrollmentErrorResponse(new Error('connection string leaked'))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('connection string leaked')
  })
})
