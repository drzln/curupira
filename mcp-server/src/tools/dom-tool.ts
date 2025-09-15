/**
 * DOM manipulation tool
 * 
 * Provides MCP tools for DOM inspection and manipulation
 */

import type { DOMDomain } from '../chrome/domains/dom.js'
import type { RuntimeDomain } from '../chrome/domains/runtime.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { logger } from '../config/logger.js'

// Tool parameter schemas
const querySelectorSchema = z.object({
  selector: z.string().describe('CSS selector to find elements'),
  all: z.boolean().optional().describe('Find all matching elements (default: false)')
})

const getAttributeSchema = z.object({
  selector: z.string().describe('CSS selector for element'),
  attribute: z.string().describe('Attribute name to get')
})

const setAttributeSchema = z.object({
  selector: z.string().describe('CSS selector for element'),
  attribute: z.string().describe('Attribute name to set'),
  value: z.string().describe('Attribute value')
})

const setTextContentSchema = z.object({
  selector: z.string().describe('CSS selector for element'),
  text: z.string().describe('Text content to set')
})

const clickElementSchema = z.object({
  selector: z.string().describe('CSS selector for element to click')
})

const scrollToElementSchema = z.object({
  selector: z.string().describe('CSS selector for element to scroll to'),
  behavior: z.enum(['auto', 'smooth']).optional().describe('Scroll behavior')
})

const highlightElementSchema = z.object({
  selector: z.string().describe('CSS selector for element to highlight'),
  color: z.string().optional().describe('Highlight color (default: red)'),
  duration: z.number().optional().describe('Highlight duration in ms (default: 2000)')
})

export class DOMTool {
  private readonly toolPrefix = 'dom'

  constructor(
    private dom: DOMDomain,
    private runtime: RuntimeDomain
  ) {}

  /**
   * List available DOM tools
   */
  listTools(): Tool[] {
    return [
      {
        name: `${this.toolPrefix}/querySelector`,
        description: 'Find elements using CSS selector',
        inputSchema: querySelectorSchema as any
      },
      {
        name: `${this.toolPrefix}/getAttribute`,
        description: 'Get attribute value from element',
        inputSchema: getAttributeSchema as any
      },
      {
        name: `${this.toolPrefix}/setAttribute`,
        description: 'Set attribute value on element',
        inputSchema: setAttributeSchema as any
      },
      {
        name: `${this.toolPrefix}/setTextContent`,
        description: 'Set text content of element',
        inputSchema: setTextContentSchema as any
      },
      {
        name: `${this.toolPrefix}/click`,
        description: 'Click an element',
        inputSchema: clickElementSchema as any
      },
      {
        name: `${this.toolPrefix}/scrollTo`,
        description: 'Scroll element into view',
        inputSchema: scrollToElementSchema as any
      },
      {
        name: `${this.toolPrefix}/highlight`,
        description: 'Highlight element temporarily',
        inputSchema: highlightElementSchema as any
      }
    ]
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: unknown): Promise<any> {
    const toolName = name.replace(`${this.toolPrefix}/`, '')

    try {
      switch (toolName) {
        case 'querySelector':
          return this.querySelector(querySelectorSchema.parse(args))
        
        case 'getAttribute':
          return this.getAttribute(getAttributeSchema.parse(args))
        
        case 'setAttribute':
          return this.setAttribute(setAttributeSchema.parse(args))
        
        case 'setTextContent':
          return this.setTextContent(setTextContentSchema.parse(args))
        
        case 'click':
          return this.clickElement(clickElementSchema.parse(args))
        
        case 'scrollTo':
          return this.scrollToElement(scrollToElementSchema.parse(args))
        
        case 'highlight':
          return this.highlightElement(highlightElementSchema.parse(args))
        
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (error) {
      logger.error('DOM tool execution failed', { name, args, error })
      throw error
    }
  }

  /**
   * Query selector
   */
  private async querySelector(args: z.infer<typeof querySelectorSchema>) {
    const result = await this.runtime.evaluate(`
      (() => {
        const elements = ${args.all ? 
          `Array.from(document.querySelectorAll(${JSON.stringify(args.selector)}))` :
          `document.querySelector(${JSON.stringify(args.selector)})`
        }
        
        if (!elements) return null
        
        const processElement = (el) => ({
          tagName: el.tagName.toLowerCase(),
          id: el.id || undefined,
          className: el.className || undefined,
          textContent: el.textContent?.substring(0, 100),
          attributes: Array.from(el.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value
            return acc
          }, {}),
          boundingBox: (() => {
            const rect = el.getBoundingClientRect()
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            }
          })()
        })
        
        return ${args.all} ? elements.map(processElement) : processElement(elements)
      })()
    `)

    return {
      selector: args.selector,
      found: result.value !== null,
      elements: args.all ? result.value : (result.value ? [result.value] : [])
    }
  }

  /**
   * Get attribute
   */
  private async getAttribute(args: z.infer<typeof getAttributeSchema>) {
    const result = await this.runtime.evaluate<string | null>(`
      (() => {
        const element = document.querySelector(${JSON.stringify(args.selector)})
        return element ? element.getAttribute(${JSON.stringify(args.attribute)}) : null
      })()
    `)

    return {
      selector: args.selector,
      attribute: args.attribute,
      value: result.value,
      found: result.value !== null
    }
  }

  /**
   * Set attribute
   */
  private async setAttribute(args: z.infer<typeof setAttributeSchema>) {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const element = document.querySelector(${JSON.stringify(args.selector)})
        if (!element) return false
        
        element.setAttribute(${JSON.stringify(args.attribute)}, ${JSON.stringify(args.value)})
        return true
      })()
    `)

    return {
      selector: args.selector,
      attribute: args.attribute,
      value: args.value,
      success: result.value === true
    }
  }

  /**
   * Set text content
   */
  private async setTextContent(args: z.infer<typeof setTextContentSchema>) {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const element = document.querySelector(${JSON.stringify(args.selector)})
        if (!element) return false
        
        element.textContent = ${JSON.stringify(args.text)}
        return true
      })()
    `)

    return {
      selector: args.selector,
      text: args.text,
      success: result.value === true
    }
  }

  /**
   * Click element
   */
  private async clickElement(args: z.infer<typeof clickElementSchema>) {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const element = document.querySelector(${JSON.stringify(args.selector)})
        if (!element) return false
        
        // Dispatch mouse events for proper click simulation
        const mousedown = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        const mouseup = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        const click = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        
        element.dispatchEvent(mousedown)
        element.dispatchEvent(mouseup)
        element.dispatchEvent(click)
        
        // Also try native click for form elements
        if (typeof element.click === 'function') {
          element.click()
        }
        
        return true
      })()
    `)

    return {
      selector: args.selector,
      clicked: result.value === true
    }
  }

  /**
   * Scroll to element
   */
  private async scrollToElement(args: z.infer<typeof scrollToElementSchema>) {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const element = document.querySelector(${JSON.stringify(args.selector)})
        if (!element) return false
        
        element.scrollIntoView({
          behavior: ${JSON.stringify(args.behavior || 'auto')},
          block: 'center',
          inline: 'center'
        })
        
        return true
      })()
    `)

    return {
      selector: args.selector,
      scrolled: result.value === true
    }
  }

  /**
   * Highlight element
   */
  private async highlightElement(args: z.infer<typeof highlightElementSchema>) {
    const color = args.color || '#ff0000'
    const duration = args.duration || 2000

    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const element = document.querySelector(${JSON.stringify(args.selector)})
        if (!element) return false
        
        // Save original styles
        const originalOutline = element.style.outline
        const originalOutlineOffset = element.style.outlineOffset
        const originalBackground = element.style.backgroundColor
        
        // Apply highlight
        element.style.outline = \`3px solid ${color}\`
        element.style.outlineOffset = '2px'
        element.style.backgroundColor = \`${color}20\` // 20% opacity
        
        // Add animation
        element.style.transition = 'all 0.3s ease-in-out'
        
        // Remove highlight after duration
        setTimeout(() => {
          element.style.outline = originalOutline
          element.style.outlineOffset = originalOutlineOffset
          element.style.backgroundColor = originalBackground
          
          // Remove transition after animation
          setTimeout(() => {
            element.style.transition = ''
          }, 300)
        }, ${duration})
        
        return true
      })()
    `)

    return {
      selector: args.selector,
      highlighted: result.value === true,
      color,
      duration
    }
  }

  /**
   * Get computed styles
   */
  async getComputedStyles(selector: string, properties?: string[]) {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        const element = document.querySelector(${JSON.stringify(selector)})
        if (!element) return null
        
        const computed = window.getComputedStyle(element)
        const properties = ${JSON.stringify(properties || [])}
        
        if (properties.length === 0) {
          // Return common properties
          return {
            display: computed.display,
            position: computed.position,
            width: computed.width,
            height: computed.height,
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize,
            fontFamily: computed.fontFamily,
            margin: computed.margin,
            padding: computed.padding,
            border: computed.border,
            opacity: computed.opacity,
            visibility: computed.visibility,
            zIndex: computed.zIndex
          }
        }
        
        // Return requested properties
        const styles = {}
        properties.forEach(prop => {
          styles[prop] = computed.getPropertyValue(prop)
        })
        return styles
      })()
    `)

    return {
      selector,
      found: result.value !== null,
      styles: result.value || {}
    }
  }
}