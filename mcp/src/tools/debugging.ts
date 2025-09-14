/**
 * @fileoverview Debugging tool implementation
 */

import type {
  ToolHandler,
  ToolMetadata,
  ToolContext,
  ToolResult,
  BreakpointInput
} from './types.js'
import type { CdpClient } from '@curupira/integration'

/**
 * Breakpoint tool
 */
export class BreakpointTool implements ToolHandler<BreakpointInput, string> {
  readonly metadata: ToolMetadata = {
    name: 'setBreakpoint',
    description: 'Set a debugger breakpoint',
    category: 'debugging',
    inputSchema: {
      type: 'object',
      properties: {
        urlPattern: { type: 'string' },
        lineNumber: { type: 'number', minimum: 0 },
        columnNumber: { type: 'number', minimum: 0 },
        condition: { type: 'string' }
      },
      required: ['lineNumber']
    }
  }

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  async execute(
    input: BreakpointInput,
    context: ToolContext
  ): Promise<ToolResult<string>> {
    try {
      // Enable debugger
      await this.cdpClient.send({
        method: 'Debugger.enable',
        sessionId: context.sessionId as any
      })

      // Set breakpoint
      const result = await this.cdpClient.send<{
        breakpointId: string
        actualLocation: any
      }>({
        method: 'Debugger.setBreakpointByUrl',
        params: {
          urlRegex: input.urlPattern,
          lineNumber: input.lineNumber,
          columnNumber: input.columnNumber,
          condition: input.condition
        },
        sessionId: context.sessionId as any
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      return {
        success: true,
        data: result.result!.breakpointId,
        metadata: {
          location: result.result!.actualLocation
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  validate(input: unknown): input is BreakpointInput {
    return typeof input === 'object' && 
           input !== null && 
           'lineNumber' in input && 
           typeof (input as any).lineNumber === 'number'
  }
}

/**
 * Console clear tool
 */
export class ConsoleClearTool implements ToolHandler<void, void> {
  readonly metadata: ToolMetadata = {
    name: 'clearConsole',
    description: 'Clear the browser console',
    category: 'debugging'
  }

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  async execute(
    input: void,
    context: ToolContext
  ): Promise<ToolResult<void>> {
    try {
      await this.cdpClient.send({
        method: 'Runtime.evaluate',
        params: {
          expression: 'console.clear()'
        },
        sessionId: context.sessionId as any
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

/**
 * Pause tool
 */
export class PauseTool implements ToolHandler<void, void> {
  readonly metadata: ToolMetadata = {
    name: 'pause',
    description: 'Pause JavaScript execution',
    category: 'debugging'
  }

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  async execute(
    input: void,
    context: ToolContext
  ): Promise<ToolResult<void>> {
    try {
      await this.cdpClient.send({
        method: 'Debugger.pause',
        sessionId: context.sessionId as any
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

/**
 * Resume tool
 */
export class ResumeTool implements ToolHandler<void, void> {
  readonly metadata: ToolMetadata = {
    name: 'resume',
    description: 'Resume JavaScript execution',
    category: 'debugging'
  }

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  async execute(
    input: void,
    context: ToolContext
  ): Promise<ToolResult<void>> {
    try {
      await this.cdpClient.send({
        method: 'Debugger.resume',
        sessionId: context.sessionId as any
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}