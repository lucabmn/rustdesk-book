import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '#/db'
import { account, invitation, session, user, verification } from '#/db/schema'
import { invitedRegistration } from '#/lib/registration-context'

/**
 * Registration policy: invite-only, with a bootstrap exception for the very
 * first account. The public sign-up route stays reachable, but this hook
 * rejects any sign-up that is neither the first user nor backed by a valid,
 * unexpired invitation for that email address. `role` is server-assigned and
 * never accepted from client input.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  // Only accept auth requests from the configured public origin. Secure cookies
  // are derived automatically from an https BETTER_AUTH_URL.
  trustedOrigins: process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : [],
  // Throttle credential endpoints (active in production). Memory-backed, which
  // is sufficient for a single-container deployment.
  rateLimit: {
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 5 },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'member',
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const email = newUser.email.toLowerCase()

          const [firstUser] = await db
            .select({ id: user.id })
            .from(user)
            .limit(1)

          // Bootstrap: the first account ever created becomes the admin.
          if (!firstUser) {
            return { data: { ...newUser, email, role: 'admin' } }
          }

          // Otherwise the sign-up must originate from acceptInvite, which only
          // enters this context after validating the invite TOKEN. The public
          // sign-up route never sets it, so a known email alone is rejected.
          const invited = invitedRegistration.getStore()
          if (invited && invited.email === email) {
            return { data: { ...newUser, email, role: invited.role } }
          }

          throw new APIError('FORBIDDEN', {
            message:
              'Registration is invite-only. Ask an administrator for an invitation.',
          })
        },
        after: async (createdUser) => {
          // Consume any pending invitations for this email.
          await db
            .update(invitation)
            .set({ acceptedAt: new Date() })
            .where(
              and(
                eq(invitation.email, createdUser.email.toLowerCase()),
                isNull(invitation.acceptedAt),
              ),
            )
        },
      },
    },
  },
  plugins: [tanstackStartCookies()],
})

export type Session = typeof auth.$Infer.Session
