/**
 * Mutable session used by the mocked `#/lib/auth` module (see `setup.ts`).
 * Tests call {@link signIn} / {@link signOut} to drive the auth middleware
 * without standing up better-auth or a real cookie flow.
 */
export interface TestUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  banned?: boolean
}

let current: TestUser | null = null

/** Sign-up calls recorded by the mocked better-auth instance. */
export interface SignUpCall {
  name: string
  email: string
  password: string
  /** Snapshot of the invited-registration async context at call time. */
  invited: { email: string; role: string } | undefined
}

export const signUpCalls: SignUpCall[] = []

export function resetSignUpCalls(): void {
  signUpCalls.length = 0
}

export function signIn(user: Partial<TestUser> = {}): TestUser {
  current = {
    id: user.id ?? 'user-1',
    name: user.name ?? 'Test User',
    email: user.email ?? 'test@example.com',
    role: user.role ?? 'admin',
    banned: user.banned ?? false,
  }
  return current
}

export function signOut(): void {
  current = null
}

export function currentUser(): TestUser | null {
  return current
}
