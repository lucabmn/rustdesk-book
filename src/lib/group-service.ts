/**
 * Group query helpers used by the oRPC device list. Kept out of the router
 * module so it stays a pure namespace of procedures.
 */
import { and, eq } from 'drizzle-orm'

import type { db as Database } from '#/db'
import { deviceGroupMembers, deviceGroups } from '#/db/schema'

/**
 * Device ids in one of the given user's groups. Returns an empty set if the
 * group does not exist or is not owned by the user — so a foreign group id can
 * never widen another user's view.
 */
export async function groupMemberIds(
  db: typeof Database,
  userId: string,
  groupId: string,
): Promise<Set<string>> {
  const owned = await db
    .select({ id: deviceGroups.id })
    .from(deviceGroups)
    .where(and(eq(deviceGroups.id, groupId), eq(deviceGroups.userId, userId)))
    .limit(1)
  if (!owned.length) return new Set()
  const rows = await db
    .select({ deviceId: deviceGroupMembers.deviceId })
    .from(deviceGroupMembers)
    .where(eq(deviceGroupMembers.groupId, groupId))
  return new Set(rows.map((r) => r.deviceId))
}
