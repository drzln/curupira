/**
 * @fileoverview Interaction tools implementation
 */

import type {
  ToolHandler,
  ToolMetadata,
  ToolContext,
  ToolResult,
  ClickInput,
  TypeInput,
  ScreenshotInput
} from './types.js'
import type { CdpClient } from '@curupira/integration'

/**
 * Click tool
 */
export class ClickTool implements ToolHandler<ClickInput, void> {
  readonly metadata: ToolMetadata = {
    name: 'click',
    description: 'Click on an element',
    category: 'interaction',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        button: { type: 'string', enum: ['left', 'right', 'middle'] },
        clickCount: { type: 'number', minimum: 1 },
        modifiers: { 
          type: 'array', 
          items: { 
            type: 'string', 
            enum: ['Alt', 'Control', 'Meta', 'Shift'] 
          } 
        }
      },
      required: ['selector']
    }
  }

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  async execute(
    input: ClickInput,
    context: ToolContext
  ): Promise<ToolResult<void>> {
    try {
      // Get element coordinates
      const coords = await this.getElementCoordinates(input.selector, context)
      
      // Click at coordinates
      await this.cdpClient.send({
        method: 'Input.dispatchMouseEvent',
        params: {
          type: 'mousePressed',
          x: coords.x,
          y: coords.y,
          button: input.button || 'left',
          clickCount: input.clickCount || 1,
          modifiers: this.getModifierMask(input.modifiers)
        },
        sessionId: context.sessionId as any
      })

      await this.cdpClient.send({
        method: 'Input.dispatchMouseEvent',
        params: {
          type: 'mouseReleased',
          x: coords.x,
          y: coords.y,
          button: input.button || 'left',
          clickCount: input.clickCount || 1,
          modifiers: this.getModifierMask(input.modifiers)
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

  validate(input: unknown): input is ClickInput {
    return typeof input === 'object' && 
           input !== null && 
           'selector' in input && 
           typeof (input as any).selector === 'string'
  }

  private async getElementCoordinates(
    selector: string,
    context: ToolContext
  ): Promise<{ x: number; y: number }> {
    const result = await this.cdpClient.send<any>({
      method: 'Runtime.evaluate',
      params: {
        expression: `
          (() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) throw new Error('Element not found');
            const rect = el.getBoundingClientRect();
            return {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2
            };
          })()
        `,
        returnByValue: true
      },
      sessionId: context.sessionId as any
    })

    if (result.error || result.result?.exceptionDetails) {
      throw new Error('Failed to get element coordinates')
    }

    return result.result.result.value
  }

  private getModifierMask(modifiers?: string[]): number {
    if (!modifiers) return 0
    
    let mask = 0
    if (modifiers.includes('Alt')) mask |= 1
    if (modifiers.includes('Control')) mask |= 2
    if (modifiers.includes('Meta')) mask |= 4
    if (modifiers.includes('Shift')) mask |= 8
    
    return mask
  }
}

/**
 * Type tool
 */
export class TypeTool implements ToolHandler<TypeInput, void> {
  readonly metadata: ToolMetadata = {
    name: 'type',
    description: 'Type text into an element',
    category: 'interaction',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text: { type: 'string' },
        delay: { type: 'number', minimum: 0 },
        clear: { type: 'boolean' }
      },
      required: ['selector', 'text']
    }
  }

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  async execute(
    input: TypeInput,
    context: ToolContext
  ): Promise<ToolResult<void>> {
    try {
      // Focus element
      await this.cdpClient.send({
        method: 'Runtime.evaluate',
        params: {
          expression: `document.querySelector(${JSON.stringify(input.selector)}).focus()`
        },
        sessionId: context.sessionId as any
      })

      // Clear if requested
      if (input.clear) {
        await this.cdpClient.send({
          method: 'Runtime.evaluate',
          params: {
            expression: `document.querySelector(${JSON.stringify(input.selector)}).value = ''`
          },
          sessionId: context.sessionId as any
        })
      }

      // Type text
      for (const char of input.text) {
        await this.cdpClient.send({
          method: 'Input.dispatchKeyEvent',
          params: {
            type: 'char',
            text: char
          },
          sessionId: context.sessionId as any
        })

        if (input.delay) {
          await new Promise(resolve => setTimeout(resolve, input.delay))
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  validate(input: unknown): input is TypeInput {
    return typeof input === 'object' && 
           input !== null && 
           'selector' in input && 
           'text' in input &&
           typeof (input as any).selector === 'string' &&
           typeof (input as any).text === 'string'
  }
}

/**
 * Screenshot tool
 */
export class ScreenshotTool implements ToolHandler<ScreenshotInput, string> {
  readonly metadata: ToolMetadata = {
    name: 'screenshot',
    description: 'Take a screenshot',
    category: 'interaction',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['jpeg', 'png', 'webp'] },
        quality: { type: 'number', minimum: 0, maximum: 100 },
        fullPage: { type: 'boolean' },
        clip: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' }
          },
          required: ['x', 'y', 'width', 'height']
        },
        omitBackground: { type: 'boolean' }
      }
    }
  }

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  async execute(
    input: ScreenshotInput,
    context: ToolContext
  ): Promise<ToolResult<string>> {
    try {
      const session = context.sessionId 
        ? this.cdpClient.getSession(context.sessionId as any)
        : undefined

      let data: string

      if (session) {
        data = await session.screenshot(input)
      } else {
        const result = await this.cdpClient.send<{ data: string }>({
          method: 'Page.captureScreenshot',
          params: {
            format: input.format,
            quality: input.quality,
            clip: input.clip,
            captureBeyondViewport: input.fullPage
          }
        })

        if (result.error) {
          throw new Error(result.error.message)
        }

        data = result.result!.data
      }

      return {
        success: true,
        data,
        metadata: {
          format: input.format || 'png',
          size: data.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}