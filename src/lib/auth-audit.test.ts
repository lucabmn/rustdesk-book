import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  attemptedEmailFrom,
  authAuditAction,
  recordAuthEvent,
} from './auth-audit'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { auditEntries } from '#/test/audit'

let db: TestDb

beforeEach(async () => {
  db = await createTestDb()
})

afterEach(async () => {
  delete process.env.TRUST_PROXY_HEADERS
  await db.$close()
})

describe('authAuditAction', () => {
  it('maps the audited endpoints', () => {
    expect(authAuditAction('/sign-in/email', false)).toBe('login')
    expect(authAuditAction('/sign-in/email', true)).toBe('login_failed')
    expect(authAuditAction('/sign-out', false)).toBe('logout')
    expect(authAuditAction('/change-password', false)).toBe('password_changed')
  })

  it('records nothing for endpoints that changed nothing', () => {
    // A failed password change did not happen — an entry would claim it did.
    // (Sign-out is audited before the endpoint runs, while the session it is
    // about still resolves, so its failed branch is not reached in practice.)
    expect(authAuditAction('/sign-out', true)).toBeNull()
    expect(authAuditAction('/change-password', true)).toBeNull()
    expect(authAuditAction('/get-session', false)).toBeNull()
  })
})

describe('attemptedEmailFrom', () => {
  it('takes only the email, normalized', () => {
    expect(
      attemptedEmailFrom({ email: '  Foo@Example.COM ', password: 'x' }),
    ).toBe('foo@example.com')
    expect(attemptedEmailFrom({ password: 'x' })).toBeNull()
    expect(attemptedEmailFrom(undefined)).toBeNull()
  })
})

describe('recordAuthEvent', () => {
  it('records a successful login against the signed-in user', async () => {
    const user = await createUser(db, {
      id: 'user-1',
      email: 'one@example.com',
    })
    await recordAuthEvent(db as never, {
      path: '/sign-in/email',
      headers: new Headers(),
      user,
      failed: false,
    })
    const [entry] = await auditEntries(db)
    expect(entry).toMatchObject({
      action: 'login',
      userId: 'user-1',
      targetType: 'user',
      targetId: 'user-1',
      targetLabel: 'one@example.com',
    })
  })

  it('records a failed login without a session, with email and IP', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true'
    await recordAuthEvent(db as never, {
      path: '/sign-in/email',
      headers: new Headers({ 'x-forwarded-for': '9.9.9.9' }),
      user: null,
      attemptedEmail: 'intruder@example.com',
      failed: true,
    })
    const [entry] = await auditEntries(db)
    expect(entry).toMatchObject({
      action: 'login_failed',
      userId: null,
      actorEmail: 'intruder@example.com',
      ipAddress: '9.9.9.9',
    })
  })

  it('writes no entry for an endpoint that is not audited', async () => {
    await recordAuthEvent(db as never, {
      path: '/get-session',
      headers: new Headers(),
      failed: false,
    })
    expect(await auditEntries(db)).toHaveLength(0)
  })
})
