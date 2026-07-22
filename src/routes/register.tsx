import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { authClient } from '#/lib/auth-client'
import { client, orpc } from '#/orpc/client'
import { fetchSession } from '#/lib/auth-server'
import { BrandMark } from '#/components/brand-mark'

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
        setError(signInError.message ?? 'Anmeldung fehlgeschlagen.')
        return
      }
      await router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const invalidInvite = !token || inviteQuery.isError

  return (
    <div className="tv-auth-wrap">
      <div className="tv-auth-card">
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BrandMark />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Konto anlegen</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 2 }}>
              {inviteQuery.data
                ? `Einladung für ${inviteQuery.data.email}`
                : 'Registrierung ist nur mit einer gültigen Einladung möglich.'}
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
            Diese Einladung ist ungültig oder abgelaufen. Bitte fordere eine neue
            Einladung an.
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div className="tv-field">
              <label className="tv-label" htmlFor="name">
                Name
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
                Passwort
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
                Mindestens 10 Zeichen.
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
              Konto erstellen & anmelden
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
