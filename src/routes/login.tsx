import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { authClient } from '#/lib/auth-client'
import { client, orpc } from '#/orpc/client'
import { fetchSession } from '#/lib/auth-server'
import { BrandMark } from '#/components/brand-mark'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (session) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const statusQuery = useQuery(orpc.account.status.queryOptions())
  const needsBootstrap = statusQuery.data?.needsBootstrap ?? false

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (needsBootstrap) {
        await client.account.bootstrap({ name, email, password })
      }
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
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tv-auth-wrap">
      <form className="tv-auth-card" onSubmit={onSubmit}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BrandMark />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {needsBootstrap ? 'Administrator einrichten' : 'Anmelden'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 2 }}>
              {needsBootstrap
                ? 'Lege das erste Konto für dieses Adressbuch an.'
                : 'Melde dich an, um auf das Adressbuch zuzugreifen.'}
            </div>
          </div>
        </header>

        {needsBootstrap && (
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
        )}

        <div className="tv-field">
          <label className="tv-label" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            className="tv-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
            autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
            required
            minLength={needsBootstrap ? 10 : undefined}
          />
          {needsBootstrap && (
            <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
              Mindestens 10 Zeichen.
            </span>
          )}
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
          disabled={busy}
        >
          {needsBootstrap ? 'Konto erstellen & anmelden' : 'Anmelden'}
        </button>
      </form>
    </div>
  )
}
