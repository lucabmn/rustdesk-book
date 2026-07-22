import { ORPCError } from '@orpc/server'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { publicProcedure } from '#/orpc/context'
import { auth } from '#/lib/auth'
import { invitation, user } from '#/db/schema'

const CredentialsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(256),
})

async function createAccount(
  headers: Headers,
  input: z.infer<typeof CredentialsSchema>,
) {
  // The registration policy (first-user / valid-invite) is enforced in the
  // better-auth `user.create.before` hook. We deliberately do NOT sign the user
  // in here — the client signs in afterwards so cookies are set correctly.
  await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
    headers,
  })
}

/** Whether the instance still needs its first (admin) account. */
export const status = publicProcedure
  .output(z.object({ needsBootstrap: z.boolean() }))
  .handler(async ({ context }) => {
    const [first] = await context.db
      .select({ id: user.id })
      .from(user)
      .limit(1)
    return { needsBootstrap: !first }
  })

/** Create the first admin account. Only works while zero users exist. */
export const bootstrap = publicProcedure
  .input(CredentialsSchema)
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    const [first] = await context.db
      .select({ id: user.id })
      .from(user)
      .limit(1)
    if (first) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Es existiert bereits ein Konto. Registrierung ist nur per Einladung möglich.',
      })
    }
    await createAccount(context.headers, input)
    return { ok: true }
  })

/** Validate an invite token and return the bound email for the register form. */
export const getInvite = publicProcedure
  .input(z.object({ token: z.string().min(1) }))
  .output(z.object({ email: z.string() }))
  .handler(async ({ input, context }) => {
    const [invite] = await context.db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.token, input.token),
          isNull(invitation.acceptedAt),
          gt(invitation.expiresAt, new Date()),
        ),
      )
      .limit(1)
    if (!invite) {
      throw new ORPCError('NOT_FOUND', {
        message: 'Einladung ist ungültig oder abgelaufen.',
      })
    }
    return { email: invite.email }
  })

/** Accept an invitation and create the invited account. */
export const acceptInvite = publicProcedure
  .input(
    z.object({
      token: z.string().min(1),
      name: z.string().trim().min(1).max(120),
      password: z.string().min(10).max(256),
    }),
  )
  .output(z.object({ email: z.string() }))
  .handler(async ({ input, context }) => {
    const [invite] = await context.db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.token, input.token),
          isNull(invitation.acceptedAt),
          gt(invitation.expiresAt, new Date()),
        ),
      )
      .limit(1)
    if (!invite) {
      throw new ORPCError('NOT_FOUND', {
        message: 'Einladung ist ungültig oder abgelaufen.',
      })
    }
    await createAccount(context.headers, {
      name: input.name,
      email: invite.email,
      password: input.password,
    })
    return { email: invite.email }
  })
