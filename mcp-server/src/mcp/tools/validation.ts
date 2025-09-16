/**
 * Type-Safe Argument Validation Utilities - Phase 1: Type System Foundation
 * Level 2: MCP Core validation utilities
 */

import { validateArgs, assertArgs, ToolValidationError, type JSONSchema, type ValidationFunction } from './types.js'

/**
 * Re-export validation functions from types.ts for easy access
 */
export { validateArgs, assertArgs, ToolValidationError, type JSONSchema, type ValidationFunction }

/**
 * Common JSON schemas for argument validation
 */
export const CommonSchemas = {
  sessionId: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    additionalProperties: true
  } as JSONSchema,

  evaluate: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'JavaScript expression to evaluate' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['expression'],
    additionalProperties: false
  } as JSONSchema,

  navigate: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
      waitUntil: { 
        type: 'string', 
        enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
        description: 'Wait condition (optional)'
      }
    },
    required: ['url'],
    additionalProperties: false
  } as JSONSchema,

  screenshot: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
      fullPage: { type: 'boolean', description: 'Capture full page (optional)' },
      selector: { type: 'string', description: 'CSS selector to capture (optional)' }
    },
    additionalProperties: false
  } as JSONSchema,

  domSelector: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['selector'],
    additionalProperties: false
  } as JSONSchema,

  apolloQuery: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'GraphQL query (optional)' },
      variables: { type: 'object', description: 'Query variables (optional)' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    additionalProperties: false
  } as JSONSchema
} as const

/**
 * Validation helper that provides better error messages
 */
export function validateToolArgs<T>(
  args: Record<string, unknown>, 
  schema: JSONSchema, 
  toolName: string
): T {
  try {
    return assertArgs<T>(args, schema)
  } catch (error) {
    if (error instanceof ToolValidationError) {
      throw new ToolValidationError(
        `Invalid arguments for tool '${toolName}': ${error.message}`,
        { toolName, originalError: error.details }
      )
    }
    throw error
  }
}

/**
 * Creates a typed validator for a specific tool
 */
export function createToolValidator<T>(toolName: string, schema: JSONSchema) {
  return (args: Record<string, unknown>): T => {
    return validateToolArgs<T>(args, schema, toolName)
  }
}

/**
 * Type-safe argument validation with runtime checking
 * Replaces unsafe manual casting throughout the codebase
 */
export function validateAndCast<T>(
  args: Record<string, unknown>, 
  schema: JSONSchema,
  toolName: string
): T {
  try {
    return assertArgs<T>(args, schema)
  } catch (error) {
    if (error instanceof ToolValidationError) {
      throw new ToolValidationError(
        `Invalid arguments for tool '${toolName}': ${error.message}`,
        { toolName, originalError: error.details, providedArgs: args }
      )
    }
    throw error
  }
}

/**
 * Schema definitions for all argument types - eliminates unsafe casting
 */
export const ArgSchemas = {
  evaluate: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'JavaScript expression to evaluate' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['expression'],
    additionalProperties: false
  } as JSONSchema,

  navigate: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
      waitUntil: { 
        type: 'string', 
        enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
        description: 'Wait condition (optional)'
      }
    },
    required: ['url'],
    additionalProperties: false
  } as JSONSchema,

  screenshot: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
      fullPage: { type: 'boolean', description: 'Capture full page (optional)' },
      selector: { type: 'string', description: 'CSS selector to capture (optional)' }
    },
    additionalProperties: false
  } as JSONSchema,

  setCookie: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
      name: { type: 'string', description: 'Cookie name' },
      value: { type: 'string', description: 'Cookie value' },
      domain: { type: 'string', description: 'Cookie domain (optional)' },
      path: { type: 'string', description: 'Cookie path (optional)' },
      secure: { type: 'boolean', description: 'Secure cookie (optional)' },
      httpOnly: { type: 'boolean', description: 'HTTP only cookie (optional)' },
      sameSite: { 
        type: 'string',
        enum: ['Strict', 'Lax', 'None'],
        description: 'SameSite attribute (optional)'
      }
    },
    required: ['name', 'value'],
    additionalProperties: false
  } as JSONSchema,

  domSelector: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['selector'],
    additionalProperties: false
  } as JSONSchema,

  apolloQuery: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'GraphQL query (optional)' },
      variables: { type: 'object', description: 'Query variables (optional)' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    additionalProperties: false
  } as JSONSchema,

  consoleExecute: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Console expression to execute' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['expression'],
    additionalProperties: false
  } as JSONSchema,

  baseToolArgs: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    additionalProperties: true
  } as JSONSchema,

  getCookies: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
      urls: { 
        type: 'array', 
        items: { type: 'string' },
        description: 'URLs to get cookies for (optional)' 
      }
    },
    additionalProperties: false
  } as JSONSchema,

  // Debugger schemas
  setBreakpoint: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL where to set breakpoint' },
      lineNumber: { type: 'number', description: 'Line number to set breakpoint' },
      columnNumber: { type: 'number', description: 'Column number (optional)' },
      condition: { type: 'string', description: 'Conditional breakpoint expression (optional)' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['url', 'lineNumber'],
    additionalProperties: false
  } as JSONSchema,

  removeBreakpoint: {
    type: 'object',
    properties: {
      breakpointId: { type: 'string', description: 'Breakpoint ID to remove' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['breakpointId'],
    additionalProperties: false
  } as JSONSchema,

  evaluateOnCallFrame: {
    type: 'object',
    properties: {
      callFrameId: { type: 'string', description: 'Call frame ID' },
      expression: { type: 'string', description: 'Expression to evaluate' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['callFrameId', 'expression'],
    additionalProperties: false
  } as JSONSchema,

  getScopeVariables: {
    type: 'object',
    properties: {
      callFrameId: { type: 'string', description: 'Call frame ID' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['callFrameId'],
    additionalProperties: false
  } as JSONSchema,

  // DOM Tool Schemas
  domNodeArgs: {
    type: 'object',
    properties: {
      nodeId: { type: 'number', description: 'DOM node ID' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['nodeId'],
    additionalProperties: false
  } as JSONSchema,

  domAttributeArgs: {
    type: 'object',
    properties: {
      nodeId: { type: 'number', description: 'DOM node ID' },
      name: { type: 'string', description: 'Attribute name' },
      value: { type: 'string', description: 'Attribute value (optional for removal)' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['nodeId', 'name'],
    additionalProperties: false
  } as JSONSchema,

  domHtmlArgs: {
    type: 'object',
    properties: {
      nodeId: { type: 'number', description: 'DOM node ID' },
      outerHTML: { type: 'string', description: 'Outer HTML content' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['nodeId', 'outerHTML'],
    additionalProperties: false
  } as JSONSchema,

  // Framework Tool Schemas
  reduxAction: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'Redux action type' },
      payload: { type: 'object', description: 'Action payload (optional)' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['type'],
    additionalProperties: false
  } as JSONSchema,

  xstateActor: {
    type: 'object',
    properties: {
      actorId: { type: 'string', description: 'XState actor ID' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['actorId'],
    additionalProperties: false
  } as JSONSchema,

  xstateEvent: {
    type: 'object',
    properties: {
      actorId: { type: 'string', description: 'XState actor ID' },
      event: { type: 'object', description: 'Event to send to the actor' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['actorId', 'event'],
    additionalProperties: false
  } as JSONSchema,

  // Zustand schemas
  zustandAction: {
    type: 'object',
    properties: {
      storeName: { type: 'string', description: 'Zustand store name' },
      action: { type: 'string', description: 'Action name to dispatch' },
      payload: { type: 'object', description: 'Action payload (optional)' },
      sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
    },
    required: ['storeName', 'action'],
    additionalProperties: false
  } as JSONSchema
} as const