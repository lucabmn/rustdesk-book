import { describe, it, expect } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import z from 'zod'
import { handleMcpRequest } from '#/utils/mcp-handler'

function mk(delay: number) {
  const s = new McpServer({ name: 't', version: '1' })
  s.registerTool('slow', { inputSchema: { a: z.string().optional() } }, async () => {
    await new Promise((r) => setTimeout(r, delay))
    return { content: [{ type: 'text' as const, text: 'ok' }] }
  })
  return s
}
const call = (body: unknown) =>
  new Request('http://x/mcp', { method: 'POST', body: JSON.stringify(body) })

describe('handleMcpRequest', () => {
  it('waits for slow tools', async () => {
    const res = await handleMcpRequest(
      call({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'slow', arguments: {} } }),
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
})
