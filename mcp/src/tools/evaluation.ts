/**
 * @fileoverview Evaluation tool implementation
 */

import type {
  ToolHandler,
  ToolMetadata,
  ToolContext,
  ToolResult,
  EvaluationInput
} from './types.js'
import type { CdpClient } from '@curupira/integration'

/**
 * Evaluation tool
 */
export class EvaluationTool implements ToolHandler<EvaluationInput, any> {
  readonly metadata: ToolMetadata = {
    name: 'evaluate',
    description: 'Evaluate JavaScript expression in the browser',
    category: 'evaluation',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string' },
        awaitPromise: { type: 'boolean' },
        returnByValue: { type: 'boolean' },
        includeCommandLineAPI: { type: 'boolean' }
      },
      required: ['expression']
    }
  }

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  async execute(
    input: EvaluationInput,
    context: ToolContext
  ): Promise<ToolResult<any>> {
    try {
      const session = context.sessionId 
        ? this.cdpClient.getSession(context.sessionId as any)
        : undefined

      let result: any

      if (session) {
        result = await session.evaluate(input.expression, {
          awaitPromise: input.awaitPromise,
          returnByValue: input.returnByValue,
          includeCommandLineAPI: input.includeCommandLineAPI
        })
      } else {
        const response = await this.cdpClient.send<any>({
          method: 'Runtime.evaluate',
          params: {
            expression: input.expression,
            awaitPromise: input.awaitPromise,
            returnByValue: input.returnByValue,
            includeCommandLineAPI: input.includeCommandLineAPI
          }
        })

        if (response.error) {
          throw new Error(response.error.message)
        }

        if (response.result?.exceptionDetails) {
          throw new Error(response.result.exceptionDetails.text)
        }

        result = response.result?.result?.value
      }

      return {
        success: true,
        data: result
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  validate(input: unknown): input is EvaluationInput {
    return typeof input === 'object' && 
           input !== null && 
           'expression' in input && 
           typeof (input as any).expression === 'string'
  }
}