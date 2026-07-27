/**
 * Client metadata of the incoming request, as stored on audit entries.
 *
 * The client IP is only taken from proxy headers when `TRUST_PROXY_HEADERS`
 * is enabled — otherwise a client could forge its own address by sending
 * `X-Forwarded-For`. (`enrollment-http.ts` derives its rate-limit key the
 * same way; that is a separate, unauthenticated path and stays independent.)
 */
export interface RequestContext {
  ipAddress: string | null
  userAgent: string | null
}

export function requestContextFrom(headers: Headers): RequestContext {
  const trustProxy = process.env.TRUST_PROXY_HEADERS === 'true'
  const forwarded = trustProxy
    ? headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    : null
  const ipAddress =
    forwarded || (trustProxy ? headers.get('x-real-ip')?.trim() : null) || null
  return { ipAddress, userAgent: headers.get('user-agent') || null }
}
