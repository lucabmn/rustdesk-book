import { call } from '@orpc/server'
import type { AnyProcedure } from '@orpc/server'

import type { TestDb } from './db'

/**
 * Invoke an oRPC procedure the way the server does — through its middleware
 * chain — with the in-memory database as context. Input validation, auth and
 * output schemas all run, so these tests exercise the real request path.
 */
export function rpc(db: TestDb, headers: HeadersInit = {}) {
  return <T>(procedure: T, input?: unknown): Promise<unknown> =>
    call(procedure as AnyProcedure, input as never, {
      context: { db, headers: new Headers(headers) },
    })
}
