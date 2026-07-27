import { ORPCError } from '@orpc/server'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { authed } from '#/orpc/context'
import { recordAuditEvent } from '#/lib/audit-service'
import { deviceGroupMembers, deviceGroups, devices } from '#/db/schema'

const NameSchema = z.string().trim().min(1).max(80)

/** Load a group and assert it belongs to the current user. */
async function loadOwnedGroup(
  db: typeof import('#/db').db,
  userId: string,
  id: string,
) {
  const [row] = await db
    .select()
    .from(deviceGroups)
    .where(and(eq(deviceGroups.id, id), eq(deviceGroups.userId, userId)))
    .limit(1)
  if (!row)
    throw new ORPCError('NOT_FOUND', { message: 'Gruppe nicht gefunden.' })
  return row
}

/** The current user's groups with device counts, alphabetical. */
export const list = authed
  .output(
    z.array(
      z.object({ id: z.string().uuid(), name: z.string(), count: z.number() }),
    ),
  )
  .handler(async ({ context }) => {
    const rows = await context.db
      .select({
        id: deviceGroups.id,
        name: deviceGroups.name,
        count: sql<number>`count(${deviceGroupMembers.deviceId})`.mapWith(
          Number,
        ),
      })
      .from(deviceGroups)
      .leftJoin(
        deviceGroupMembers,
        eq(deviceGroupMembers.groupId, deviceGroups.id),
      )
      .where(eq(deviceGroups.userId, context.user.id))
      .groupBy(deviceGroups.id)
      .orderBy(asc(deviceGroups.name))
    return rows
  })

export const create = authed
  .input(z.object({ name: NameSchema }))
  .output(z.object({ id: z.string().uuid(), name: z.string() }))
  .handler(async ({ input, context }) => {
    const [existing] = await context.db
      .select({ id: deviceGroups.id })
      .from(deviceGroups)
      .where(
        and(
          eq(deviceGroups.userId, context.user.id),
          eq(deviceGroups.name, input.name),
        ),
      )
      .limit(1)
    if (existing) {
      throw new ORPCError('CONFLICT', { message: 'Gruppe existiert bereits.' })
    }
    const [row] = await context.db
      .insert(deviceGroups)
      .values({ userId: context.user.id, name: input.name })
      .returning({ id: deviceGroups.id, name: deviceGroups.name })
    return row
  })

export const rename = authed
  .input(z.object({ id: z.string().uuid(), name: NameSchema }))
  .handler(async ({ input, context }) => {
    await loadOwnedGroup(context.db, context.user.id, input.id)
    await context.db
      .update(deviceGroups)
      .set({ name: input.name })
      .where(eq(deviceGroups.id, input.id))
    return { ok: true }
  })

export const remove = authed
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    await loadOwnedGroup(context.db, context.user.id, input.id)
    await context.db.delete(deviceGroups).where(eq(deviceGroups.id, input.id))
    return { ok: true }
  })

/** The current user's group ids that contain the given device. */
export const forDevice = authed
  .input(z.object({ deviceId: z.string().uuid() }))
  .output(z.array(z.string().uuid()))
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .select({ groupId: deviceGroupMembers.groupId })
      .from(deviceGroupMembers)
      .innerJoin(deviceGroups, eq(deviceGroups.id, deviceGroupMembers.groupId))
      .where(
        and(
          eq(deviceGroups.userId, context.user.id),
          eq(deviceGroupMembers.deviceId, input.deviceId),
        ),
      )
    return rows.map((r) => r.groupId)
  })

/** Add or remove a device from one of the current user's groups. Idempotent. */
export const setMembership = authed
  .input(
    z.object({
      groupId: z.string().uuid(),
      deviceId: z.string().uuid(),
      member: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const group = await loadOwnedGroup(
      context.db,
      context.user.id,
      input.groupId,
    )
    let changed: { deviceId: string } | undefined
    if (input.member) {
      const [row] = await context.db
        .insert(deviceGroupMembers)
        .values({ groupId: input.groupId, deviceId: input.deviceId })
        .onConflictDoNothing()
        .returning({ deviceId: deviceGroupMembers.deviceId })
      changed = row
    } else {
      const [row] = await context.db
        .delete(deviceGroupMembers)
        .where(
          and(
            eq(deviceGroupMembers.groupId, input.groupId),
            eq(deviceGroupMembers.deviceId, input.deviceId),
          ),
        )
        .returning({ deviceId: deviceGroupMembers.deviceId })
      changed = row
    }
    // Idempotent calls that moved nothing leave no entry.
    if (changed) {
      const [device] = await context.db
        .select({ alias: devices.alias })
        .from(devices)
        .where(eq(devices.id, input.deviceId))
        .limit(1)
      await recordAuditEvent(context.db, {
        action: 'device_group_changed',
        actor: {
          id: context.user.id,
          name: context.user.name,
          email: context.user.email,
        },
        target: {
          type: 'device',
          id: input.deviceId,
          label: device?.alias ?? null,
        },
        headers: context.headers,
        metadata: { group: group.name, member: input.member },
      })
    }
    return { member: input.member }
  })
