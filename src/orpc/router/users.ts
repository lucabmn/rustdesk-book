import { ORPCError } from '@orpc/server'
import { count, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { adminProcedure } from '#/orpc/context'
import { recordAuditEvent } from '#/lib/audit-service'
import { devices, session, user } from '#/db/schema'

type AuditingContext = {
  headers: Headers
  user: { id: string; name: string; email: string }
}

/** Actor + target snapshot for an audit event about a single user. */
function userAuditEvent(
  context: AuditingContext,
  target: { id: string; email: string },
  deleted = false,
) {
  return {
    actor: {
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
    },
    target: {
      type: 'user' as const,
      id: target.id,
      label: target.email,
      deleted,
    },
    headers: context.headers,
  }
}

const RoleSchema = z.enum(['admin', 'member'])

/** Public projection of a user row for the admin overview. */
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: RoleSchema,
  banned: z.boolean(),
  banReason: z.string().nullable(),
  emailVerified: z.boolean(),
  deviceCount: z.number().int(),
  createdAt: z.string(),
})

/** Count of remaining admins — used to prevent locking out the last one. */
async function adminCount(db: typeof import('#/db').db): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(user)
    .where(eq(user.role, 'admin'))
  return row?.n ?? 0
}

/** All users with their owned-device counts, newest first. Admin only. */
export const list = adminProcedure
  .output(z.array(UserSchema))
  .handler(async ({ context }) => {
    const rows = await context.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        deviceCount: sql<number>`cast(count(${devices.id}) as int)`,
      })
      .from(user)
      .leftJoin(devices, eq(devices.createdBy, user.id))
      .groupBy(user.id)
      .orderBy(desc(user.createdAt))

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role === 'admin' ? ('admin' as const) : ('member' as const),
      banned: r.banned,
      banReason: r.banReason,
      emailVerified: r.emailVerified,
      deviceCount: Number(r.deviceCount),
      createdAt: r.createdAt.toISOString(),
    }))
  })

/**
 * Edit a user's name and/or role. Email and password are intentionally NOT
 * editable here — those are owned by better-auth's own flows. Prevents demoting
 * the last remaining admin and self-demotion (both would strand the instance).
 */
export const update = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1).max(120),
      role: RoleSchema,
    }),
  )
  .handler(async ({ input, context }) => {
    const [target] = await context.db
      .select({ role: user.role, email: user.email })
      .from(user)
      .where(eq(user.id, input.id))
      .limit(1)
    if (!target) {
      throw new ORPCError('NOT_FOUND', { message: 'Benutzer nicht gefunden.' })
    }

    const demotingAdmin = target.role === 'admin' && input.role !== 'admin'
    if (demotingAdmin) {
      if (input.id === context.user.id) {
        throw new ORPCError('FORBIDDEN', {
          message:
            'Du kannst dir nicht selbst die Administratorrechte entziehen.',
        })
      }
      if ((await adminCount(context.db)) <= 1) {
        throw new ORPCError('FORBIDDEN', {
          message: 'Der letzte Administrator kann nicht herabgestuft werden.',
        })
      }
    }

    await context.db
      .update(user)
      .set({ name: input.name, role: input.role, updatedAt: new Date() })
      .where(eq(user.id, input.id))
    if (target.role !== input.role) {
      await recordAuditEvent(context.db, {
        action: 'user_role_changed',
        ...userAuditEvent(context, { id: input.id, email: target.email }),
        metadata: { fields: ['role'], from: target.role, to: input.role },
      })
    }
    return { ok: true }
  })

/**
 * Ban a user: flag the account and revoke every active session so the lockout
 * takes effect immediately. Sign-in is blocked separately by the auth hook.
 */
export const ban = adminProcedure
  .input(
    z.object({
      id: z.string().min(1),
      reason: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.id === context.user.id) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Du kannst dich nicht selbst sperren.',
      })
    }
    const [target] = await context.db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, input.id))
      .limit(1)
    if (!target) {
      throw new ORPCError('NOT_FOUND', { message: 'Benutzer nicht gefunden.' })
    }

    await context.db
      .update(user)
      .set({
        banned: true,
        banReason: input.reason || null,
        bannedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, input.id))
    // Revoke existing sessions so the ban is effective right away.
    await context.db.delete(session).where(eq(session.userId, input.id))
    await recordAuditEvent(context.db, {
      action: 'user_banned',
      ...userAuditEvent(context, target),
      metadata: { fields: ['banned'], withReason: Boolean(input.reason) },
    })
    return { ok: true }
  })

/** Lift a ban. */
export const unban = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const [row] = await context.db
      .update(user)
      .set({
        banned: false,
        banReason: null,
        bannedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, input.id))
      .returning({ id: user.id, email: user.email })
    if (!row) {
      throw new ORPCError('NOT_FOUND', { message: 'Benutzer nicht gefunden.' })
    }
    await recordAuditEvent(context.db, {
      action: 'user_unbanned',
      ...userAuditEvent(context, row),
      metadata: { fields: ['banned'] },
    })
    return { ok: true }
  })

/**
 * Delete a user. Cascades remove their sessions/accounts; owned devices, audit
 * entries and invitations keep their rows with a null reference. Guards against
 * deleting yourself or the last administrator.
 */
export const remove = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    if (input.id === context.user.id) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Du kannst dein eigenes Konto nicht löschen.',
      })
    }
    const [target] = await context.db
      .select({ role: user.role, email: user.email })
      .from(user)
      .where(eq(user.id, input.id))
      .limit(1)
    if (!target) {
      throw new ORPCError('NOT_FOUND', { message: 'Benutzer nicht gefunden.' })
    }
    if (target.role === 'admin' && (await adminCount(context.db)) <= 1) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Der letzte Administrator kann nicht gelöscht werden.',
      })
    }

    await context.db.delete(user).where(eq(user.id, input.id))
    await recordAuditEvent(context.db, {
      action: 'user_deleted',
      ...userAuditEvent(context, { id: input.id, email: target.email }, true),
      metadata: { role: target.role },
    })
    return { ok: true }
  })
