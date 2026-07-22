import { createFileRoute } from '@tanstack/react-router'

/** Liveness probe for container healthchecks and load balancers. */
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => Response.json({ status: 'ok' }),
    },
  },
})
