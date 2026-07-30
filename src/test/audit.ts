import { asc } from 'drizzle-orm'

import { auditLog } from '#/db/schema'
import type { TestDb } from './db'

/** Every audit entry written so far, oldest first. */
export async function auditEntries(db: TestDb) {
  return db.select().from(auditLog).orderBy(asc(auditLog.createdAt))
}

/** Just the actions, for asserting that exactly one entry was written. */
export async function auditActions(db: TestDb): Promise<string[]> {
  return (await auditEntries(db)).map((entry) => entry.action)
}
