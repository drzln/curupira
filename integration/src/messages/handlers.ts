/**
 * @fileoverview Message handlers and matchers
 */

import type {
  Message,
  MessageRoute,
  RouteMatcher,
  MessageSource,
  MessageType
} from './types.js'

/**
 * Default route matcher implementation
 */
export class DefaultRouteMatcher implements RouteMatcher {
  /**
   * Match route
   */
  match(message: Message, route: MessageRoute): boolean {
    // Check source filter
    if (route.source) {
      const sources = Array.isArray(route.source) ? route.source : [route.source]
      if (!sources.includes(message.source)) {
        return false
      }
    }

    // Check type filter
    if (route.type) {
      const types = Array.isArray(route.type) ? route.type : [route.type]
      if (!types.includes(message.type)) {
        return false
      }
    }

    // Check custom filter
    if (route.filter && !route.filter(message)) {
      return false
    }

    return true
  }

  /**
   * Find matching routes
   */
  findMatches(message: Message, routes: MessageRoute[]): MessageRoute[] {
    return routes.filter(route => this.match(message, route))
  }

  /**
   * Sort by priority
   */
  sortByPriority(routes: MessageRoute[]): MessageRoute[] {
    return [...routes].sort((a, b) => {
      const priorityA = a.priority || 0
      const priorityB = b.priority || 0
      return priorityB - priorityA // Higher priority first
    })
  }
}

/**
 * Create pattern-based filter
 */
export function createPatternFilter(pattern: string | RegExp) {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
  
  return (message: Message): boolean => {
    if ('method' in message.payload && typeof message.payload.method === 'string') {
      return regex.test(message.payload.method)
    }
    return false
  }
}

/**
 * Create source-based handler
 */
export function createSourceHandler(
  source: MessageSource | MessageSource[],
  handler: (message: Message) => void | Promise<void>
) {
  const sources = Array.isArray(source) ? source : [source]
  
  return {
    id: `source-${sources.join('-')}`,
    name: `Handle from ${sources.join(', ')}`,
    source,
    handler
  }
}

/**
 * Create type-based handler
 */
export function createTypeHandler(
  type: MessageType | MessageType[],
  handler: (message: Message) => void | Promise<void>
) {
  const types = Array.isArray(type) ? type : [type]
  
  return {
    id: `type-${types.join('-')}`,
    name: `Handle ${types.join(', ')}`,
    type,
    handler
  }
}

/**
 * Create composite handler
 */
export function createCompositeHandler(
  ...handlers: Array<(message: Message) => void | Promise<void>>
) {
  return async (message: Message): Promise<void> => {
    for (const handler of handlers) {
      await handler(message)
    }
  }
}

/**
 * Create logging handler
 */
export function createLoggingHandler(
  logger: { info: (data: any, msg: string) => void }
) {
  return (message: Message): void => {
    logger.info({
      id: message.id,
      type: message.type,
      source: message.source,
      target: message.target,
      sessionId: message.sessionId
    }, 'Message received')
  }
}

/**
 * Create error handler
 */
export function createErrorHandler(
  onError: (error: Error, message: Message) => void
) {
  return async (message: Message): Promise<void> => {
    try {
      // Process message
      if ('error' in message.payload) {
        onError(new Error('Message contains error'), message)
      }
    } catch (error) {
      onError(error as Error, message)
    }
  }
}