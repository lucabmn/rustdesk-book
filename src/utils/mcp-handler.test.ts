import { describe, it, expect, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import z from 'zod'
import { handleMcpRequest } from '#/utils/mcp-handler'

function mk(delay: number) {
  const s = new McpServer({ name: 't', version: '1' })
  s.registerTool(
    'slow',
    { inputSchema: { a: z.string().optional() } },
    async () => {
      await new Promise((r) => setTimeout(r, delay))
      return { content: [{ type: 'text' as const, text: 'ok' }] }
    },
  )
  return s
}
const call = (body: unknown) =>
  new Request('http://x/mcp', { method: 'POST', body: JSON.stringify(body) })

describe('handleMcpRequest', () => {
  it('waits for slow tools', async () => {
    const res = await handleMcpRequest(
      call({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'slow', arguments: {} },
      }),
      mk(300),
    )
    const json = await res.json()
    expect(json.id).toBe(7)
    expect(json.result.content[0].text).toBe('ok')
  })
  it('202 for notifications', async () => {
    const res = await handleMcpRequest(
      call({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      mk(0),
    )
    expect(res.status).toBe(202)
  })

  it('answers a malformed body with a JSON-RPC internal error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await handleMcpRequest(
      new Request('http://x/mcp', { method: 'POST', body: 'not json' }),
      mk(0),
    )
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error.code).toBe(-32603)
    expect(json.id).toBeNull()
    vi.restoreAllMocks()
  })

  it('gives up with a 504 when the tool never answers', async () => {
    const server = new McpServer({ name: 't', version: '1' })
    // Never settles, so the handler can only end in its timeout branch.
    server.registerTool('hang', {}, () => new Promise(() => {}))

    const res = await handleMcpRequest(
      call({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 'hang', arguments: {} },
      }),
      server,
      { timeoutMs: 20 },
    )

    expect(res.status).toBe(504)
    expect((await res.json()).error.message).toBe('MCP request timed out')
  })
})
