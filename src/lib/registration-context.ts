import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Marks an in-flight account creation as authorized by a validated invitation.
 * `acceptInvite` runs the better-auth sign-up inside this context after it has
 * verified the invite token; the create hook only trusts an invited sign-up
 * when this store is present and its email matches. The public sign-up route
 * never enters this context, so knowing an invited email is not enough to
 * register — a valid token is required.
 */
export const invitedRegistration = new AsyncLocalStorage<{
  email: string
  role: string
}>()
