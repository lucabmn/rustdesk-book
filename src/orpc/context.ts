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
  if ((session.user as { banned?: boolean }).banned) {
    throw new ORPCError('FORBIDDEN', { message: 'Dieses Konto wurde gesperrt.' })
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

/** Rejects the call with FORBIDDEN unless the user has the admin role. */
export const adminProcedure = authed.use(async ({ context, next }) => {
  if ((context.user as { role?: string }).role !== 'admin') {
    throw new ORPCError('FORBIDDEN', {
      message: 'Administratorrechte erforderlich.',
    })
  }
  return next({})
})

/** Base procedure for public endpoints (bootstrap, invite acceptance). */
export const publicProcedure = base
