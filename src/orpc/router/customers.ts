import { ORPCError } from '@orpc/server'
import { asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { adminProcedure, authed } from '#/orpc/context'
import { customers, devices } from '#/db/schema'

const NameSchema = z.string().trim().min(1).max(160)
const OptText = z.string().trim().max(2000).optional()

/** Assert a customer with the given name does not already exist (excluding id). */
async function assertNameFree(
  db: typeof import('#/db').db,
  name: string,
  exceptId?: string,
) {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.name, name))
    .limit(1)
  if (row && row.id !== exceptId) {
    throw new ORPCError('CONFLICT', {
      message: 'Ein Kunde mit diesem Namen existiert bereits.',
    })
  }
}

/** All customers with their device counts, alphabetical. */
export const list = authed
  .output(
    z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        contact: z.string().nullable(),
        notes: z.string().nullable(),
        count: z.number(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const rows = await context.db
      .select({
        id: customers.id,
        name: customers.name,
        contact: customers.contact,
        notes: customers.notes,
        count: sql<number>`count(${devices.id})`.mapWith(Number),
      })
      .from(customers)
      .leftJoin(devices, eq(devices.customerId, customers.id))
      .groupBy(customers.id)
      .orderBy(asc(customers.name))
    return rows
  })

export const create = adminProcedure
  .input(z.object({ name: NameSchema, contact: OptText, notes: OptText }))
  .output(z.object({ id: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    await assertNameFree(context.db, input.name)
    const [row] = await context.db
      .insert(customers)
      .values({
        name: input.name,
        contact: input.contact || null,
        notes: input.notes || null,
      })
      .returning({ id: customers.id })
    return row
  })

export const update = adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      name: NameSchema,
      contact: OptText,
      notes: OptText,
    }),
  )
  .handler(async ({ input, context }) => {
    await assertNameFree(context.db, input.name, input.id)
    const [row] = await context.db
      .update(customers)
      .set({
        name: input.name,
        contact: input.contact || null,
        notes: input.notes || null,
      })
      .where(eq(customers.id, input.id))
      .returning({ id: customers.id })
    if (!row)
      throw new ORPCError('NOT_FOUND', { message: 'Kunde nicht gefunden.' })
    return { ok: true }
  })

/**
 * Delete a customer. Devices keep existing but become unassigned
 * (devices.customerId → null via the FK's ON DELETE SET NULL).
 */
export const remove = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    await context.db.delete(customers).where(eq(customers.id, input.id))
    return { ok: true }
  })
