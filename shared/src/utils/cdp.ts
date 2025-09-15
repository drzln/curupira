/**
 * @fileoverview CDP-specific utility functions
 * 
 * This file contains utility functions for working with Chrome DevTools Protocol
 */

import type { Runtime, DOM } from '../types/cdp.js'
import type { JsonValue } from '../types/index.js'

/**
 * Convert a Runtime.RemoteObject to a plain JavaScript value
 */
export function remoteObjectToValue(obj: Runtime.RemoteObject): unknown {
  if (obj.unserializableValue) {
    switch (obj.unserializableValue) {
      case 'Infinity':
        return Infinity
      case '-Infinity':
        return -Infinity
      case 'NaN':
        return NaN
      case '-0':
        return -0
      default:
        return undefined
    }
  }

  if ('value' in obj) {
    return obj.value
  }

  if (obj.type === 'undefined') {
    return undefined
  }

  if (obj.subtype === 'null') {
    return null
  }

  // For objects that need to be evaluated
  return obj.description || `[${obj.type}]`
}

/**
 * Convert a JavaScript value to CDP evaluation parameters
 */
export function valueToCallArgument(value: unknown): Runtime.CallArgument {
  if (value === undefined) {
    return { unserializableValue: 'undefined' }
  }

  if (value === null) {
    return { value: null }
  }

  if (typeof value === 'number') {
    if (value === Infinity) {
      return { unserializableValue: 'Infinity' }
    }
    if (value === -Infinity) {
      return { unserializableValue: '-Infinity' }
    }
    if (Object.is(value, NaN)) {
      return { unserializableValue: 'NaN' }
    }
    if (Object.is(value, -0)) {
      return { unserializableValue: '-0' }
    }
  }

  if (typeof value === 'bigint') {
    return { unserializableValue: `${value}n` }
  }

  return { value: value as JsonValue }
}

/**
 * Build a CSS selector path for a DOM node
 */
export function buildSelector(node: DOM.Node, nodes: Map<number, DOM.Node>): string {
  const parts: string[] = []
  let current: DOM.Node | undefined = node

  while (current && current.nodeName !== '#document') {
    let selector = current.nodeName.toLowerCase()

    // Add ID if present
    const id = getNodeAttribute(current, 'id')
    if (id) {
      selector += `#${id}`
      parts.unshift(selector)
      break // ID should be unique
    }

    // Add classes
    const classes = getNodeAttribute(current, 'class')
    if (classes) {
      const classList = classes.split(/\s+/).filter(Boolean)
      if (classList.length > 0) {
        selector += '.' + classList.join('.')
      }
    }

    // Add nth-child if needed
    if (current.parentId) {
      const parent = nodes.get(current.parentId)
      if (parent && parent.children) {
        const siblings = parent.children.filter(child => child.nodeName === current!.nodeName)
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1
          selector += `:nth-child(${index})`
        }
      }
    }

    parts.unshift(selector)
    current = current.parentId ? nodes.get(current.parentId) : undefined
  }

  return parts.join(' > ')
}

/**
 * Get attribute value from a DOM node
 */
export function getNodeAttribute(node: DOM.Node, name: string): string | undefined {
  if (!node.attributes) return undefined

  for (let i = 0; i < node.attributes.length; i += 2) {
    if (node.attributes[i] === name) {
      return node.attributes[i + 1]
    }
  }

  return undefined
}

/**
 * Extract stack trace as string from Runtime.StackTrace
 */
export function formatStackTrace(stackTrace: Runtime.StackTrace | undefined): string {
  if (!stackTrace) return ''

  const frames: string[] = []
  let current: Runtime.StackTrace | undefined = stackTrace

  while (current) {
    if (current.description) {
      frames.push(current.description)
    }

    for (const frame of current.callFrames) {
      const location = `${frame.url}:${frame.lineNumber}:${frame.columnNumber}`
      const fnName = frame.functionName || '<anonymous>'
      frames.push(`    at ${fnName} (${location})`)
    }

    current = current.parent
  }

  return frames.join('\n')
}

/**
 * Parse CDP URL to extract useful information
 */
export interface ParsedCDPUrl {
  protocol: string
  host: string
  port: number
  path: string
  sessionId?: string
}

export function parseCDPUrl(url: string): ParsedCDPUrl | null {
  const match = url.match(/^(wss?):\/\/([^:/]+):(\d+)(\/.*)?$/)
  if (!match) return null

  const [, protocol, host, portStr, path = ''] = match
  const port = parseInt(portStr, 10)

  // Extract session ID from path if present
  const sessionMatch = path.match(/\/session\/([^/]+)/)
  const sessionId = sessionMatch ? sessionMatch[1] : undefined

  return {
    protocol,
    host,
    port,
    path,
    sessionId
  }
}

/**
 * Create evaluation expression for safe property access
 */
export function createSafeEvalExpression(expression: string, errorValue: unknown = undefined): string {
  return `
    (() => {
      try {
        return ${expression};
      } catch (e) {
        return ${JSON.stringify(errorValue)};
      }
    })()
  `
}

/**
 * Check if a URL is debuggable (not chrome:// or about://)
 */
export function isDebuggableUrl(url: string): boolean {
  return !url.startsWith('chrome://') &&
         !url.startsWith('chrome-extension://') &&
         !url.startsWith('about:') &&
         !url.startsWith('devtools://') &&
         !url.startsWith('chrome-devtools://')
}

/**
 * Runtime.CallArgument type
 */
export interface CallArgument {
  value?: JsonValue
  unserializableValue?: string
  objectId?: string
}

/**
 * Create a function declaration for Runtime.callFunctionOn
 */
export function createFunctionDeclaration(fn: Function): string {
  return fn.toString()
}

/**
 * Escape string for use in CDP evaluation
 */
export function escapeEvalString(str: string): string {
  return JSON.stringify(str)
}

/**
 * Wait for a condition with timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError!
}
