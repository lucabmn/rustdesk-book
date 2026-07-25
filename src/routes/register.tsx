import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { AuthLayout, FormError } from '#/components/auth-layout'
import { Button, Field, Input } from '#/components/ui'
import { authClient } from '#/lib/auth-client'
import { fetchSession } from '#/lib/auth-server'
import { client, orpc } from '#/orpc/client'
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
    <AuthLayout
      title={m.auth_register_title()}
      subtitle={
        inviteQuery.data
          ? m.auth_register_invite_for({ email: inviteQuery.data.email })
          : m.auth_register_need_invite()
      }
    >
      {invalidInvite ? (
        <FormError>{m.auth_register_invalid_invite()}</FormError>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={m.common_name()} htmlFor="name">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </Field>

          <Field
            label={m.common_password()}
            htmlFor="password"
            hint={m.auth_password_hint()}
          >
            <Input
              id="password"
              type="password"
              className="font-mono"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={10}
            />
          </Field>

          {error && <FormError>{error}</FormError>}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            disabled={busy || inviteQuery.isLoading}
          >
            {m.auth_create_and_signin()}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
