import { z } from 'zod'

import { DEVICE_STATUSES, OS_KEYS } from '#/lib/device-meta'

export const DeviceStatusSchema = z.enum(DEVICE_STATUSES)
export const OsKeySchema = z.enum(OS_KEYS)

/** RustDesk ids are numeric strings (9–10 digits in practice). */
const RustdeskIdSchema = z
  .string()
  .trim()
  .regex(/^\d{6,12}$/, 'RustDesk-ID muss aus 6–12 Ziffern bestehen.')

/** Input accepted by create/update. `password` is optional; empty keeps/clears. */
export const DeviceInputSchema = z.object({
  rustdeskId: RustdeskIdSchema,
  alias: z.string().trim().min(1).max(120),
  customer: z.string().trim().max(160).optional().default(''),
  osKey: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(24).default([]),
  status: DeviceStatusSchema.default('offline'),
  notes: z.string().trim().max(2000).optional().default(''),
  password: z.string().max(256).optional().default(''),
})
export type DeviceInput = z.infer<typeof DeviceInputSchema>

/**
 * Public projection of a device. Note: no password field of any kind — only a
 * boolean telling the UI whether a secret is stored.
 */
export const DeviceSchema = z.object({
  id: z.string().uuid(),
  rustdeskId: z.string(),
  alias: z.string(),
  customer: z.string().nullable(),
  osKey: z.string().nullable(),
  tags: z.array(z.string()),
  status: DeviceStatusSchema,
  lastSeen: z.string().nullable(),
  hasPassword: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Device = z.infer<typeof DeviceSchema>

export const DeviceListFilterSchema = z.object({
  search: z.string().trim().optional(),
  status: DeviceStatusSchema.optional(),
  osKey: z.string().optional(),
  customer: z.string().optional(),
  tags: z.array(z.string()).optional(),
})
