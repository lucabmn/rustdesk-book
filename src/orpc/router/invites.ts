import { randomBytes } from 'node:crypto'

import { desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { adminProcedure } from '#/orpc/context'
import { recordAuditEvent } from '#/lib/audit-service'
import { invitation } from '#/db/schema'

const INVITE_TTL_DAYS = 7

const adminOnly = adminProcedure

export const create = adminOnly
  .input(
    z.object({
      email: z.string().trim().toLowerCase().email(),
      role: z.enum(['admin', 'member']).default('member'),
    }),
  )
  .output(z.object({ token: z.string(), email: z.string() }))
  .handler(async ({ input, context }) => {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000)
    const [row] = await context.db
      .insert(invitation)
      .values({
        email: input.email,
        token,
        role: input.role,
        invitedBy: context.user.id,
        expiresAt,
      })
      .returning({ id: invitation.id })
    // The invite token is a credential: the entry names the invitee, never
    // the token value.
    await recordAuditEvent(context.db, {
      action: 'invite_created',
      actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
      },
      target: { type: 'invitation', id: row.id, label: input.email },
      headers: context.headers,
      metadata: { role: input.role, expiresAt: expiresAt.toISOString() },
    })
    return { token, email: input.email }
  })

export const list = adminOnly.handler(async ({ context }) => {
  const rows = await context.db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })
    .from(invitation)
    .where(isNull(invitation.acceptedAt))
    .orderBy(desc(invitation.createdAt))
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    token: r.token,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }))
})

export const revoke = adminOnly
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const [row] = await context.db
      .delete(invitation)
      .where(eq(invitation.id, input.id))
      .returning({ id: invitation.id, email: invitation.email })
    if (row) {
      await recordAuditEvent(context.db, {
        action: 'invite_revoked',
        actor: {
          id: context.user.id,
          name: context.user.name,
          email: context.user.email,
        },
        target: {
          type: 'invitation',
          id: row.id,
          label: row.email,
          deleted: true,
        },
        headers: context.headers,
      })
    }
    return { ok: true }
  })
