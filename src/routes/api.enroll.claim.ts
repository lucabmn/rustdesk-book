import '#/polyfill'

import { createFileRoute } from '@tanstack/react-router'

import { db } from '#/db'
import { claimEnrollment, EnrollmentClaimSchema } from '#/lib/enrollment'
import {
  bearerToken,
  enforceEnrollmentRateLimit,
  enrollmentErrorResponse,
  enrollmentJson,
  parseEnrollmentPayload,
} from '#/lib/enrollment-http'

async function post({ request }: { request: Request }) {
  try {
    enforceEnrollmentRateLimit(request)
    const token = bearerToken(request)
    const input = EnrollmentClaimSchema.parse(await parseEnrollmentPayload(request))
    const result = await claimEnrollment(db, token, input)

    if (request.headers.get('accept')?.includes('text/plain')) {
      return new Response(
        result.alreadyEnrolled
          ? 'ALREADY'
          : `${result.claimToken}\n${Math.floor(new Date(result.expiresAt).getTime() / 1000)}`,
        {
          status: 200,
          headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
        },
      )
    }
    return enrollmentJson({ ok: true, ...result })
  } catch (error) {
    return enrollmentErrorResponse(error)
  }
}

export const Route = createFileRoute('/api/enroll/claim')({
  server: { handlers: { POST: post } },
})
