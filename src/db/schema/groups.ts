import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { user } from './auth'
import { devices } from './devices'

/* ------------------------------------------------------------------ *
 * Favorites — per-user starred devices. A join table (not a flag on
 * `devices`) so each technician has their own favorites, private to them.
 * ------------------------------------------------------------------ */

export const deviceFavorites = pgTable(
  'device_favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.deviceId] }),
    index('device_favorites_user_idx').on(t.userId),
  ],
)

/* ------------------------------------------------------------------ *
 * Device groups — per-user, private named folders. A device can belong
 * to many of a user's groups; groups are never shared between users.
 * ------------------------------------------------------------------ */

export const deviceGroups = pgTable(
  'device_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('device_groups_user_idx').on(t.userId),
    uniqueIndex('device_groups_user_name_idx').on(t.userId, t.name),
  ],
)

export const deviceGroupMembers = pgTable(
  'device_group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => deviceGroups.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.deviceId] }),
    index('device_group_members_device_idx').on(t.deviceId),
  ],
)
