/**
 * Audit rules for the authentication endpoints, kept free of better-auth
 * wiring so they can be reasoned about — and tested — on their own, the same
 * way `auth-policy.ts` is. `auth.ts` only translates better-auth's after-hook
 * context into {@link AuthEvent} and calls {@link recordAuthEvent}.
 *
 * A failed sign-in has no session and no user row, so it is recorded with a
 * null actor id and the ATTEMPTED address as the actor email — never a
 * password, and never a guessed user id.
 */
import type { AuditAction } from '#/db/schema'
import { type AuditWriter, recordAuditEvent } from '#/lib/audit-service'

export interface AuthEvent {
  /** better-auth endpoint path, e.g. `/sign-in/email`. */
  path: string
  headers: Headers
  /** The signed-in user, when the endpoint resolved one. */
  user?: { id: string; name?: string | null; email?: string | null } | null
  /** Address taken from the request body — the only clue a failed login has. */
  attemptedEmail?: string | null
  /** Whether the endpoint returned an error. */
  failed: boolean
}

/**
 * The action an auth request maps to, or null when it is not security
 * relevant. Failed calls are only recorded for sign-in: a failed sign-out or
 * password change changed nothing, and an entry would claim otherwise.
 */
export function authAuditAction(
  path: string,
  failed: boolean,
): AuditAction | null {
  if (path === '/sign-in/email') return failed ? 'login_failed' : 'login'
  if (failed) return null
  if (path === '/sign-out') return 'logout'
  if (path === '/change-password') return 'password_changed'
  return null
}

/** Record an authentication event, if the endpoint is one we audit. */
export async function recordAuthEvent(
  db: AuditWriter,
  event: AuthEvent,
): Promise<void> {
  const action = authAuditAction(event.path, event.failed)
  if (!action) return

  const email = event.user?.email ?? event.attemptedEmail ?? null
  await recordAuditEvent(db, {
    action,
    actor: {
      id: event.user?.id ?? null,
      name: event.user?.name ?? null,
      email,
    },
    target: { type: 'user', id: event.user?.id ?? null, label: email },
    headers: event.headers,
  })
}

/** The email in a sign-in body, lower-cased. Never reads the password. */
export function attemptedEmailFrom(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const email = (body as { email?: unknown }).email
  return typeof email === 'string' ? email.trim().toLowerCase() || null : null
}
