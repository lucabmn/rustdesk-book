import { ORPCError, os } from '@orpc/server'

import { auth } from '#/lib/auth'
import { db } from '#/db'

/**
 * Every oRPC call carries the incoming request headers and the database
 * handle. Session resolution happens in the {@link requireAuth} middleware so
 * that authenticated procedures never see an unauthenticated caller.
 */
export interface ORPCContext {
  headers: Headers
  db: typeof db
}

export const base = os.$context<ORPCContext>()

/** Rejects the call with UNAUTHORIZED unless a valid session is present. */
const requireAuth = base.middleware(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers })
  if (!session) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Authentication required.' })
  }
  return next({
    context: {
      session: session.session,
      user: session.user,
    },
  })
})

/** Base procedure for anything that requires a signed-in user. */
export const authed = base.use(requireAuth)

/** Base procedure for public endpoints (bootstrap, invite acceptance). */
export const publicProcedure = base
