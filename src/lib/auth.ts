import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { db } from '#/db'
import { account, session, user, verification } from '#/db/schema'
import {
  assertNotBanned,
  consumeInvitations,
  resolveSignUpRole,
} from '#/lib/auth-policy'
import { attemptedEmailFrom, recordAuthEvent } from '#/lib/auth-audit'
import { recordAuditEvent } from '#/lib/audit-service'

/** Surface a policy error as better-auth's FORBIDDEN, keeping its message. */
function forbidden(error: unknown, fallback: string): never {
  throw new APIError('FORBIDDEN', {
    message: error instanceof Error ? error.message : fallback,
  })
}

type AuthHookContext = {
  path: string
  headers?: Headers | null
  body?: unknown
  context: {
    session?: { user?: { id: string; name?: string; email?: string } } | null
    newSession?: { user?: { id: string; name?: string; email?: string } } | null
  }
}

/**
 * Translate a better-auth endpoint call into an audit entry. Auditing must
 * never break authentication itself, so a failure here is logged and swallowed.
 */
async function auditAuthRequest(ctx: AuthHookContext, failed: boolean) {
  const headers = ctx.headers ?? new Headers()
  try {
    const sessionUser =
      ctx.context.newSession?.user ??
      ctx.context.session?.user ??
      (await auth.api.getSession({ headers }).catch(() => null))?.user
    await recordAuthEvent(db, {
      path: ctx.path,
      headers,
      user: sessionUser ?? null,
      attemptedEmail: attemptedEmailFrom(ctx.body),
      failed,
    })
  } catch (error) {
    console.error('Failed to record auth audit event:', error)
  }
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
  hooks: {
    // Sign-out is audited BEFORE the endpoint runs, while the session it is
    // about still resolves; everything else after, so the entry only exists
    // once the endpoint actually did something.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-out') return
      await auditAuthRequest(ctx, false)
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-out') return
      await auditAuthRequest(ctx, ctx.context.returned instanceof APIError)
    }),
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
        after: async (createdUser, ctx) => {
          await consumeInvitations(db, createdUser.email)
          // Self-registration: the new account is both actor and target.
          await recordAuditEvent(db, {
            action: 'user_created',
            actor: {
              id: createdUser.id,
              name: createdUser.name,
              email: createdUser.email,
            },
            target: {
              type: 'user',
              id: createdUser.id,
              label: createdUser.email,
            },
            headers: ctx?.headers ?? new Headers(),
            metadata: { role: (createdUser as { role?: string }).role ?? null },
          })
        },
      },
    },
  },
  plugins: [tanstackStartCookies()],
})

export type Session = typeof auth.$Infer.Session
