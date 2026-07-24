import { vi } from 'vitest'

import { invitedRegistration } from '#/lib/registration-context'
import { currentUser, signUpCalls } from './session'

// better-auth is replaced wholesale in tests: the procedures under test only
// consume `getSession` and `signUpEmail`, and driving a real cookie/session
// flow would couple every router test to the auth implementation.
vi.mock('#/lib/auth', () => ({
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
