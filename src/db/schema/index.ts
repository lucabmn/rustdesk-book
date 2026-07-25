/**
 * The database schema, one module per bounded area. Every consumer imports
 * from `#/db/schema` — the split is an internal detail.
 */
export * from './auth'
export * from './invitations'
export * from './customers'
export * from './enrollment'
export * from './devices'
export * from './audit'
export * from './groups'
export * from './relations'
