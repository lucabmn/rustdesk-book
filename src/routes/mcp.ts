import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { handleMcpRequest } from '#/utils/mcp-handler'
import { queryDevices, toPublicDevice } from '#/lib/device-service'
import { osLabel } from '#/lib/device-meta'
import { safeEqual } from '#/lib/crypto'
import { db } from '#/db'

/**
 * Read-only Model Context Protocol server over the address book. It never
 * exposes passwords — only metadata — and answers questions like
 * "do I have a device for customer X?" or "is device Y online?".
 *
 * Access requires `Authorization: Bearer <MCP_API_KEY>`. If MCP_API_KEY is not
 * configured the endpoint is disabled entirely.
 */
const server = new McpServer({ name: 'rustdesk-book', version: '1.0.0' })

/** Present a device for the LLM: labelled OS, no secrets. */
function describe(row: Awaited<ReturnType<typeof queryDevices>>[number]) {
  const d = toPublicDevice(row)
  return {
    rustdeskId: d.rustdeskId,
    alias: d.alias,
    customer: d.customer,
    os: osLabel(d.osKey),
    status: d.status,
    tags: d.tags,
    lastSeen: d.lastSeen,
    hasPassword: d.hasPassword,
    notes: d.notes,
  }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

server.registerTool(
  'search_devices',
  {
    title: 'Geräte durchsuchen',
    description:
      'Volltextsuche über RustDesk-ID, Alias, Kunde, Tags und Notizen. Nützlich für "hab ich Client xy?".',
    inputSchema: { query: z.string().describe('Suchbegriff') },
  },
  async ({ query }) => {
    const rows = await queryDevices(db, { search: query })
    return jsonResult({ count: rows.length, devices: rows.map(describe) })
  },
)

server.registerTool(
  'list_devices',
  {
    title: 'Geräte auflisten',
    description:
      'Listet Geräte, optional gefiltert nach Kunde, Betriebssystem, Status oder Tag.',
    inputSchema: {
      customer: z.string().optional(),
      os: z.string().optional().describe('OS-Key, z.B. win11, ubuntu, macos'),
      status: z.enum(['online', 'away', 'offline']).optional(),
      tag: z.string().optional(),
    },
  },
  async ({ customer, os, status, tag }) => {
    const rows = await queryDevices(db, {
      customer,
      osKey: os,
      status,
      tags: tag ? [tag] : undefined,
    })
    return jsonResult({ count: rows.length, devices: rows.map(describe) })
  },
)

server.registerTool(
  'get_device',
  {
    title: 'Gerät abrufen',
    description: 'Ruft ein einzelnes Gerät anhand seiner RustDesk-ID oder seines Alias ab.',
    inputSchema: {
      idOrAlias: z.string().describe('RustDesk-ID oder Alias des Geräts'),
    },
  },
  async ({ idOrAlias }) => {
    const needle = idOrAlias.trim().toLowerCase()
    const rows = await queryDevices(db, {})
    const match = rows.find(
      (d) =>
        d.rustdeskId === idOrAlias.trim() ||
        d.alias.toLowerCase() === needle,
    )
    if (!match) return jsonResult({ found: false })
    return jsonResult({ found: true, device: describe(match) })
  },
)

server.registerTool(
  'list_customers',
  {
    title: 'Kunden auflisten',
    description: 'Listet alle Kunden/Mandanten mit der jeweiligen Anzahl an Geräten.',
    inputSchema: {},
  },
  async () => {
    const rows = await queryDevices(db, {})
    const counts = new Map<string, number>()
    for (const d of rows) {
      const c = d.customer?.trim()
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    const customers = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    return jsonResult({ count: customers.length, customers })
  },
)

function isAuthorized(request: Request): boolean {
  const key = process.env.MCP_API_KEY
  if (!key) return false
  const header = request.headers.get('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  return token.length > 0 && safeEqual(token, key)
}

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.MCP_API_KEY) {
          return Response.json(
            { error: 'MCP endpoint is disabled (MCP_API_KEY not set).' },
            { status: 503 },
          )
        }
        if (!isAuthorized(request)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return handleMcpRequest(request, server)
      },
    },
  },
})
