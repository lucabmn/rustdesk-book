import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { AuthLayout, FormError } from '#/components/auth-layout'
import { Button, Field, Input } from '#/components/ui'
import { authClient } from '#/lib/auth-client'
import { fetchSession } from '#/lib/auth-server'
import { client, orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'

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
        setError(signInError.message ?? m.auth_signin_error())
        return
      }
      await router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : m.auth_generic_error())
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={needsBootstrap ? m.auth_admin_title() : m.auth_signin_title()}
      subtitle={
        needsBootstrap ? m.auth_admin_subtitle() : m.auth_signin_subtitle()
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {needsBootstrap && (
          <Field label={m.common_name()} htmlFor="name">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </Field>
        )}

        <Field label={m.common_email()} htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>

        <Field
          label={m.common_password()}
          htmlFor="password"
          hint={needsBootstrap ? m.auth_password_hint() : undefined}
        >
          <Input
            id="password"
            type="password"
            className="font-mono"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
            required
            minLength={needsBootstrap ? 10 : undefined}
          />
        </Field>

        {error && <FormError>{error}</FormError>}

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={busy}
        >
          {needsBootstrap ? m.auth_create_and_signin() : m.auth_signin_title()}
        </Button>
      </form>
    </AuthLayout>
  )
}
