import { relations } from 'drizzle-orm'

import { user } from './auth'
import { customers } from './customers'
import { devices } from './devices'

export const devicesRelations = relations(devices, ({ one }) => ({
  creator: one(user, {
    fields: [devices.createdBy],
    references: [user.id],
  }),
  customer: one(customers, {
    fields: [devices.customerId],
    references: [customers.id],
  }),
}))
