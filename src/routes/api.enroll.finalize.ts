import '#/polyfill'

import { createFileRoute } from '@tanstack/react-router'

import { db } from '#/db'
import { EnrollmentFinalizeSchema, finalizeEnrollment } from '#/lib/enrollment'
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
    const claimToken = bearerToken(request)
    const input = EnrollmentFinalizeSchema.parse(
      await parseEnrollmentPayload(request),
    )
    const result = await finalizeEnrollment(
      db,
      claimToken,
      input,
      request.headers,
    )
    return enrollmentJson({ ok: true, ...result }, result.created ? 201 : 200)
  } catch (error) {
    return enrollmentErrorResponse(error)
  }
}

export const Route = createFileRoute('/api/enroll/finalize')({
  server: { handlers: { POST: post } },
})
