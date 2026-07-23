import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { authClient } from '#/lib/auth-client'
import { client, orpc } from '#/orpc/client'
import { fetchSession } from '#/lib/auth-server'
import { BrandMark } from '#/components/brand-mark'
import { LanguageSwitcher } from '#/components/language-switcher'
import { m } from '#/paraglide/messages'

const searchSchema = z.object({ token: z.string().optional() })

export const Route = createFileRoute('/register')({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const session = await fetchSession()
    if (session) throw redirect({ to: '/' })
  },
  component: RegisterPage,
})

function RegisterPage() {
  const router = useRouter()
  const { token } = Route.useSearch()

  const inviteQuery = useQuery(
    orpc.account.getInvite.queryOptions({
      input: { token: token ?? '' },
      enabled: Boolean(token),
      retry: false,
    }),
  )

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    setBusy(true)
    try {
      const { email } = await client.account.acceptInvite({
        token,
        name,
        password,
      })
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      })
      if (signInError) {
        setError(signInError.message ?? m.auth_signin_error())
        return
      }
      await router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : m.auth_register_error())
    } finally {
      setBusy(false)
    }
  }

  const invalidInvite = !token || inviteQuery.isError

  return (
    <div className="tv-auth-wrap">
      <div className="tv-auth-card">
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <BrandMark />
            <LanguageSwitcher />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{m.auth_register_title()}</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 2 }}>
              {inviteQuery.data
                ? m.auth_register_invite_for({ email: inviteQuery.data.email })
                : m.auth_register_need_invite()}
            </div>
          </div>
        </header>

        {invalidInvite ? (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--s-err)',
              background: 'var(--s-err-bg)',
              padding: '10px 12px',
              borderRadius: 6,
            }}
          >
            {m.auth_register_invalid_invite()}
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div className="tv-field">
              <label className="tv-label" htmlFor="name">
                {m.common_name()}
              </label>
              <input
                id="name"
                className="tv-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="tv-field">
              <label className="tv-label" htmlFor="password">
                {m.common_password()}
              </label>
              <input
                id="password"
                type="password"
                className="tv-input mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={10}
              />
              <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                {m.auth_password_hint()}
              </span>
            </div>

            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--s-err)',
                  background: 'var(--s-err-bg)',
                  padding: '8px 10px',
                  borderRadius: 6,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="tv-btn tv-btn--default tv-btn--lg tv-btn--block"
              disabled={busy || inviteQuery.isLoading}
            >
              {m.auth_create_and_signin()}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
