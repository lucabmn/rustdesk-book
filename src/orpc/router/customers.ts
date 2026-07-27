import { ORPCError } from '@orpc/server'
import { asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { adminProcedure, authed } from '#/orpc/context'
import { changedFields, recordAuditEvent } from '#/lib/audit-service'
import { customers, devices } from '#/db/schema'

type AuditingContext = {
  headers: Headers
  user: { id: string; name: string; email: string }
}

/** Actor + target snapshot for an audit event about a single customer. */
function customerAuditEvent(
  context: AuditingContext,
  row: { id: string; name: string },
  deleted = false,
) {
  return {
    actor: {
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
    },
    target: { type: 'customer' as const, id: row.id, label: row.name, deleted },
    headers: context.headers,
  }
}

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
    await recordAuditEvent(context.db, {
      action: 'customer_created',
      ...customerAuditEvent(context, { id: row.id, name: input.name }),
    })
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
    const [before] = await context.db
      .select({
        name: customers.name,
        contact: customers.contact,
        notes: customers.notes,
      })
      .from(customers)
      .where(eq(customers.id, input.id))
      .limit(1)
    const [row] = await context.db
      .update(customers)
      .set({
        name: input.name,
        contact: input.contact || null,
        notes: input.notes || null,
      })
      .where(eq(customers.id, input.id))
      .returning({
        id: customers.id,
        name: customers.name,
        contact: customers.contact,
        notes: customers.notes,
      })
    if (!row)
      throw new ORPCError('NOT_FOUND', { message: 'Kunde nicht gefunden.' })
    const fields = changedFields(before ?? {}, {
      name: row.name,
      contact: row.contact,
      notes: row.notes,
    })
    if (fields.length) {
      await recordAuditEvent(context.db, {
        action: 'customer_updated',
        ...customerAuditEvent(context, row),
        metadata: { fields },
      })
    }
    return { ok: true }
  })

/**
 * Delete a customer. Devices keep existing but become unassigned
 * (devices.customerId → null via the FK's ON DELETE SET NULL).
 */
export const remove = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const [row] = await context.db
      .delete(customers)
      .where(eq(customers.id, input.id))
      .returning({ id: customers.id, name: customers.name })
    if (row) {
      await recordAuditEvent(context.db, {
        action: 'customer_deleted',
        ...customerAuditEvent(context, row, true),
      })
    }
    return { ok: true }
  })
