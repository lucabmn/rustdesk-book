/**
 * Client metadata of the incoming request, as stored on audit entries.
 *
 * The client IP is only taken from proxy headers when `TRUST_PROXY_HEADERS`
 * is enabled — otherwise a client could forge its own address by sending
 * `X-Forwarded-For`. Audit entries therefore record no IP until a proxy is
 * trusted; the user agent is always recorded.
 *
 * `enrollment-http.ts` shares {@link clientIpFrom} for its rate-limit key
 * and only differs in the fallback: it buckets untrusted callers together
 * under `'global'`, an audit entry stores `null`.
 */
export interface RequestContext {
  ipAddress: string | null
  userAgent: string | null
}

/** Client address from the proxy headers, or null when they aren't trusted. */
export function clientIpFrom(headers: Headers): string | null {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return null
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || null
}

export function requestContextFrom(headers: Headers): RequestContext {
  return {
    ipAddress: clientIpFrom(headers),
    userAgent: headers.get('user-agent') || null,
  }
}
