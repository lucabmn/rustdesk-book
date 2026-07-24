import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { user } from './auth'

/* ------------------------------------------------------------------ *
 * Invitations
 * Registration is invite-only (except the very first, bootstrap admin).
 * An invite is bound to an email address and consumed on sign-up.
 * ------------------------------------------------------------------ */

export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    role: text('role').notNull().default('member'),
    invitedBy: text('invited_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('invitation_email_idx').on(t.email)],
)
