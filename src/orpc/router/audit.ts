import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { adminProcedure, authed } from '#/orpc/context'
import { auditLog, devices, user } from '#/db/schema'

/** Recent audit entries (reveal/connect), most recent first. Admin only. */
export const list = adminProcedure.handler(async ({ context }) => {
  const rows = await context.db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      createdAt: auditLog.createdAt,
      deviceAlias: devices.alias,
      deviceRustdeskId: devices.rustdeskId,
      userName: user.name,
      userEmail: user.email,
    })
    .from(auditLog)
    .leftJoin(devices, eq(auditLog.deviceId, devices.id))
    .leftJoin(user, eq(auditLog.userId, user.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(200)

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    createdAt: r.createdAt.toISOString(),
    deviceAlias: r.deviceAlias,
    deviceRustdeskId: r.deviceRustdeskId,
    userName: r.userName,
    userEmail: r.userEmail,
  }))
})

/**
 * Connection/reveal history for a single device, most recent first. Visible to
 * any authenticated user (they can already see the device). Read-only view over
 * the existing audit_log — no separate history table.
 */
export const listForDevice = authed
  .input(z.object({ deviceId: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        createdAt: auditLog.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.userId, user.id))
      .where(eq(auditLog.deviceId, input.deviceId))
      .orderBy(desc(auditLog.createdAt))
      .limit(50)

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      createdAt: r.createdAt.toISOString(),
      userName: r.userName,
      userEmail: r.userEmail,
    }))
  })
