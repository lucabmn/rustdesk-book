import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { and, eq, gt, isNull } from 'drizzle-orm'

import { db } from '#/db'
import { account, invitation, session, user, verification } from '#/db/schema'

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

          const [invite] = await db
            .select()
            .from(invitation)
            .where(
              and(
                eq(invitation.email, email),
                isNull(invitation.acceptedAt),
                gt(invitation.expiresAt, new Date()),
              ),
            )
            .limit(1)

          if (!invite) {
            throw new APIError('FORBIDDEN', {
              message:
                'Registration is invite-only. Ask an administrator for an invitation.',
            })
          }

          return { data: { ...newUser, email, role: invite.role } }
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
