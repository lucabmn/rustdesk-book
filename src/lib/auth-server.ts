import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
}

/** Server-side session lookup used by route guards. Returns null when signed out. */
export const fetchSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ user: SessionUser } | null> => {
    const session = await auth.api.getSession({
      headers: new Headers(getRequestHeaders() as HeadersInit),
    })
    if (!session) return null
    const u = session.user as {
      id: string
      name: string
      email: string
      role?: string
    }
    return {
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role ?? 'member',
      },
    }
  },
)
