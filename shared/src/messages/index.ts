import { z } from 'zod'

// Message type definitions using Zod for runtime validation

export const BridgeMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['request', 'response', 'event']),
  source: z.enum(['extension', 'page', 'devtools', 'mcp']),
  target: z.enum(['extension', 'page', 'devtools', 'mcp']),
  method: z.string(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
  timestamp: z.number(),
})

export const MCPRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.unknown().optional(),
})

export const MCPResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
})

// Extension message types
export const ExtensionMessageType = z.enum([
  'INIT',
  'CONNECT',
  'DISCONNECT',
  'REGISTER_STORE',
  'UPDATE_STATE',
  'CONSOLE_LOG',
  'NETWORK_REQUEST',
  'DOM_UPDATE',
  'COMPONENT_RENDER',
  'ERROR',
])

export const ExtensionMessage = z.object({
  type: ExtensionMessageType,
  payload: z.unknown(),
  timestamp: z.number().default(() => Date.now()),
})

// Helper functions for creating messages
export function createBridgeMessage(
  source: 'extension' | 'page' | 'devtools' | 'mcp',
  target: 'extension' | 'page' | 'devtools' | 'mcp',
  method: string,
  params?: unknown
) {
  return {
    id: crypto.randomUUID(),
    type: 'request' as const,
    source,
    target,
    method,
    params,
    timestamp: Date.now(),
  }
}

export function createResponse(requestId: string, result?: unknown, error?: unknown) {
  return {
    id: requestId,
    type: 'response' as const,
    result,
    error,
    timestamp: Date.now(),
  }
}

export function createEvent(
  source: 'extension' | 'page' | 'devtools' | 'mcp',
  method: string,
  params: unknown
) {
  return {
    id: crypto.randomUUID(),
    type: 'event' as const,
    source,
    target: 'mcp' as const,
    method,
    params,
    timestamp: Date.now(),
  }
}