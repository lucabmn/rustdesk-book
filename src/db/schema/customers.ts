import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/* ------------------------------------------------------------------ *
 * Customers / tenants — a first-class entity. Previously a free-text
 * string on each device; now a shared table so a customer can be renamed
 * once, carry contact metadata, and never diverge through typos.
 * ------------------------------------------------------------------ */

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    contact: text('contact'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customers_name_idx').on(t.name)],
)
