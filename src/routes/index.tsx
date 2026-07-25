import { createFileRoute, redirect } from '@tanstack/react-router'

import { fetchSession } from '#/lib/auth-server'
import { loadViewMode } from '#/lib/view-mode'
import { AddressBook } from '#/components/address-book/address-book'
import { ToastProvider } from '#/components/address-book/toast'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) throw redirect({ to: '/login' })
    return { user: session.user }
  },
  // The view mode is resolved before render so the server emits the view the
  // user last chose — restoring it after hydration would show one view and
  // then swap to another.
  loader: async ({ context }) => ({
    user: context.user,
    view: await loadViewMode(),
  }),
  component: Home,
})

function Home() {
  const { user, view } = Route.useLoaderData()
  return (
    <ToastProvider>
      <AddressBook user={user} initialView={view} />
    </ToastProvider>
  )
}
