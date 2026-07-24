import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

const REQUEST_TIMEOUT_MS = 30_000

export async function handleMcpRequest(
  request: Request,
  server: McpServer,
): Promise<Response> {
  try {
    const jsonRpcRequest = (await request.json()) as JSONRPCMessage

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()

    // Notifications carry no id and get no reply — acknowledge and stop.
    const requestId = 'id' in jsonRpcRequest ? jsonRpcRequest.id : undefined
    if (requestId === undefined) {
      return new Response(null, { status: 202 })
    }

    // Wait for the reply that matches this request id rather than a fixed
    // timer: a slow tool (DB query) would otherwise return a null body.
    let settle: (message: JSONRPCMessage | null) => void
    const replied = new Promise<JSONRPCMessage | null>((resolve) => {
      settle = resolve
    })

    clientTransport.onmessage = (message: JSONRPCMessage) => {
      if ('id' in message && message.id === requestId) settle(message)
    }

    await server.connect(serverTransport)

    await clientTransport.start()
    await serverTransport.start()

    await clientTransport.send(jsonRpcRequest)

    const timeout = setTimeout(() => settle(null), REQUEST_TIMEOUT_MS)
    const responseData = await replied.finally(() => clearTimeout(timeout))

    await clientTransport.close()
    await serverTransport.close()

    if (!responseData) {
      return Response.json(
        {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'MCP request timed out' },
          id: requestId,
        },
        { status: 504 },
      )
    }

    return Response.json(responseData, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('MCP handler error:', error)

    // Return a JSON-RPC error response
    return Response.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error),
        },
        id: null,
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
