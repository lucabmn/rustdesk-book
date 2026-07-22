import { createFileRoute, redirect } from '@tanstack/react-router'

import { fetchSession } from '#/lib/auth-server'
import { AddressBook } from '#/components/address-book/address-book'
import { ToastProvider } from '#/components/address-book/toast'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) throw redirect({ to: '/login' })
    return { user: session.user }
  },
  loader: ({ context }) => ({ user: context.user }),
  component: Home,
})

function Home() {
  const { user } = Route.useLoaderData()
  return (
    <ToastProvider>
      <AddressBook user={user} />
    </ToastProvider>
  )
}
