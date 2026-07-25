import { mock } from 'bun:test'

import { invitedRegistration } from '#/lib/registration-context'
import { normalizeTestEnv } from './env'
import { currentUser, signUpCalls } from './session'

/**
 * Preload for `bun test` (wired up in bunfig.toml). Bun does not read
 * vitest.config.ts, so the environment and the better-auth mock that the
 * vitest setup provides are established here instead. Keep this in sync with
 * `setup.ts`.
 */

normalizeTestEnv()

mock.module('#/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => {
        const user = currentUser()
        if (!user) return null
        return { user, session: { id: 'session-1', userId: user.id } }
      },
      signUpEmail: async ({
        body,
      }: {
        body: { name: string; email: string; password: string }
      }) => {
        signUpCalls.push({ ...body, invited: invitedRegistration.getStore() })
        return { user: { id: `user-${signUpCalls.length}` } }
      },
    },
  },
}))
