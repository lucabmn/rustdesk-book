import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { db } from '#/db'
import { account, session, user, verification } from '#/db/schema'
import {
  assertNotBanned,
  consumeInvitations,
  resolveSignUpRole,
} from '#/lib/auth-policy'

/** Surface a policy error as better-auth's FORBIDDEN, keeping its message. */
function forbidden(error: unknown, fallback: string): never {
  throw new APIError('FORBIDDEN', {
    message: error instanceof Error ? error.message : fallback,
  })
}

/**
 * better-auth wiring only. The registration and lockout rules themselves live
 * in `auth-policy.ts`; the hooks below just translate them into better-auth's
 * contract. `role` is server-assigned and never accepted from client input.
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
      banned: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false,
      },
      banReason: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (newSession) => {
          try {
            await assertNotBanned(db, newSession.userId)
          } catch (error) {
            forbidden(error, 'Dieses Konto wurde gesperrt.')
          }
        },
      },
    },
    user: {
      create: {
        before: async (newUser) => {
          const email = newUser.email.toLowerCase()
          try {
            const role = await resolveSignUpRole(db, email)
            return { data: { ...newUser, email, role } }
          } catch (error) {
            forbidden(error, 'Registration is invite-only.')
          }
        },
        after: async (createdUser) => {
          await consumeInvitations(db, createdUser.email)
        },
      },
    },
  },
  plugins: [tanstackStartCookies()],
})

export type Session = typeof auth.$Infer.Session
