import { EnrollmentError } from '#/lib/enrollment'

const MAX_BODY_BYTES = 16 * 1024
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 300
const MAX_RATE_BUCKETS = 2048
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export function enrollmentJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new EnrollmentError(401, 'missing_token', 'Bearer token required.')
  return match[1].trim()
}

/** Small in-process safety net; production proxies should enforce a global limit too. */
export function enforceEnrollmentRateLimit(request: Request) {
  const trustProxy = process.env.TRUST_PROXY_HEADERS === 'true'
  const forwarded = trustProxy
    ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    : null
  const key = forwarded || (trustProxy ? request.headers.get('x-real-ip') : null) || 'global'
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldestKey = rateBuckets.keys().next().value
      if (oldestKey) rateBuckets.delete(oldestKey)
    }
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
  } else if (++bucket.count > RATE_LIMIT) {
    throw new EnrollmentError(429, 'rate_limited', 'Too many enrollment attempts.')
  }
}

async function readLimitedBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BODY_BYTES) {
    throw new EnrollmentError(413, 'payload_too_large', 'Enrollment payload is too large.')
  }
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new EnrollmentError(413, 'payload_too_large', 'Enrollment payload is too large.')
    }
    chunks.push(value)
  }

  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(combined)
}

export async function parseEnrollmentPayload(request: Request): Promise<unknown> {
  const body = await readLimitedBody(request)
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('application/json')) return JSON.parse(body)
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(body))
  }
  throw new EnrollmentError(
    415,
    'unsupported_media_type',
    'Use application/json or application/x-www-form-urlencoded.',
  )
}

export function enrollmentErrorResponse(error: unknown): Response {
  if (error instanceof EnrollmentError) {
    return enrollmentJson({ error: error.code, message: error.message }, error.status)
  }
  if (error instanceof SyntaxError) {
    return enrollmentJson({ error: 'invalid_json', message: 'Invalid JSON payload.' }, 400)
  }
  if (error && typeof error === 'object' && 'issues' in error) {
    return enrollmentJson({ error: 'invalid_payload', message: 'Invalid enrollment payload.' }, 400)
  }
  console.error('Device enrollment failed:', error)
  return enrollmentJson({ error: 'enrollment_failed' }, 500)
}
