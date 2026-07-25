/**
 * Registration and lockout policy, kept free of better-auth wiring so it can
 * be reasoned about — and tested — on its own. `auth.ts` binds these functions
 * into the corresponding database hooks.
 */
import { and, eq, isNull } from 'drizzle-orm'

import type { db as Database } from '#/db'
import { invitation, user } from '#/db/schema'
import { invitedRegistration } from '#/lib/registration-context'

export class RegistrationDenied extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistrationDenied'
  }
}

export class AccountBanned extends Error {
  constructor(message = 'Dieses Konto wurde gesperrt.') {
    super(message)
    this.name = 'AccountBanned'
  }
}

/** True while the instance has no user at all — the bootstrap window. */
export async function isFirstUser(db: typeof Database): Promise<boolean> {
  const [first] = await db.select({ id: user.id }).from(user).limit(1)
  return !first
}

/**
 * Decide the role a sign-up may take, or refuse it.
 *
 * - the very first account ever created becomes the admin (bootstrap),
 * - any later sign-up must run inside {@link invitedRegistration}, which
 *   `acceptInvite` only enters after validating the invite TOKEN. Knowing an
 *   invited email address is therefore not enough to register.
 */
export async function resolveSignUpRole(
  db: typeof Database,
  email: string,
): Promise<string> {
  const normalized = email.toLowerCase()
  if (await isFirstUser(db)) return 'admin'

  const invited = invitedRegistration.getStore()
  if (invited && invited.email === normalized) return invited.role

  throw new RegistrationDenied(
    'Registration is invite-only. Ask an administrator for an invitation.',
  )
}

/** Mark every pending invitation for this address as consumed. */
export async function consumeInvitations(
  db: typeof Database,
  email: string,
): Promise<void> {
  await db
    .update(invitation)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        eq(invitation.email, email.toLowerCase()),
        isNull(invitation.acceptedAt),
      ),
    )
}

/**
 * Refuse to open a session for a banned account. Combined with revoking
 * existing sessions at ban time this makes the lockout airtight: a banned user
 * can neither stay signed in nor sign back in.
 */
export async function assertNotBanned(
  db: typeof Database,
  userId: string,
): Promise<void> {
  const [target] = await db
    .select({ banned: user.banned })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  if (target?.banned) throw new AccountBanned()
}
