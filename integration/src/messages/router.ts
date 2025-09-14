/**
 * @fileoverview Message router implementation
 * 
 * This file provides the core message routing functionality,
 * handling message dispatch, transformation, and error handling.
 */

import { EventEmitter } from 'eventemitter3'
import { v4 as uuidv4 } from 'uuid'
import type {
  Message,
  MessageType,
  MessageSource,
  MessageHandler,
  MessageTransformer,
  MessageRoute,
  MessageRoutingConfig,
  MessageRouterEvents,
  MessageStatistics,
  RouteMatcher
} from './types.js'
import {
  createLogger,
  type Logger,
  type Timestamp
} from '@curupira/shared'
import { MessageQueue } from './queue.js'
import { DefaultRouteMatcher } from './handlers.js'

/**
 * Message router
 */
export class MessageRouter extends EventEmitter<MessageRouterEvents> {
  private readonly config: Required<MessageRoutingConfig>
  private readonly logger: Logger
  private readonly routes = new Map<string, MessageRoute>()
  private readonly transforms: MessageTransformer[] = []
  private readonly queue: MessageQueue
  private readonly matcher: RouteMatcher
  private readonly stats: MessageStatistics = {
    received: 0,
    routed: 0,
    transformed: 0,
    queued: 0,
    dropped: 0,
    errors: 0,
    byType: {} as Record<MessageType, number>,
    bySource: {} as Record<MessageSource, number>,
    avgProcessingTime: 0
  }
  private processingTimes: number[] = []
  private processTimer?: NodeJS.Timeout

  constructor(config: MessageRoutingConfig) {
    super()
    this.config = {
      routes: [],
      defaultHandler: undefined,
      errorHandler: undefined,
      transforms: [],
      queue: {
        enabled: false,
        maxSize: 1000,
        processInterval: 100
      },
      ...config
    }
    
    this.logger = createLogger({ level: 'info' })
    this.matcher = new DefaultRouteMatcher()
    this.queue = new MessageQueue(this.config.queue.maxSize)
    
    // Initialize routes
    this.config.routes.forEach(route => this.addRoute(route))
    
    // Initialize transforms
    this.transforms.push(...(this.config.transforms || []))
    
    // Start queue processor if enabled
    if (this.config.queue.enabled) {
      this.startQueueProcessor()
    }
  }

  /**
   * Add route
   */
  addRoute(route: MessageRoute): void {
    this.routes.set(route.id, {
      enabled: true,
      priority: 0,
      ...route
    })
    
    this.logger.debug({ route: route.name }, 'Route added')
  }

  /**
   * Remove route
   */
  removeRoute(routeId: string): void {
    this.routes.delete(routeId)
  }

  /**
   * Enable route
   */
  enableRoute(routeId: string): void {
    const route = this.routes.get(routeId)
    if (route) {
      route.enabled = true
    }
  }

  /**
   * Disable route
   */
  disableRoute(routeId: string): void {
    const route = this.routes.get(routeId)
    if (route) {
      route.enabled = false
    }
  }

  /**
   * Get routes
   */
  getRoutes(): MessageRoute[] {
    return Array.from(this.routes.values())
  }

  /**
   * Add transform
   */
  addTransform(transform: MessageTransformer): void {
    this.transforms.push(transform)
  }

  /**
   * Process message
   */
  async process(message: Message): Promise<void> {
    const startTime = Date.now()
    
    // Update stats
    this.stats.received++
    this.updateTypeStats(message.type)
    this.updateSourceStats(message.source)
    
    this.emit('message:received', message)
    
    try {
      // Apply transforms
      let transformed = await this.applyTransforms(message)
      if (!transformed) {
        this.stats.dropped++
        this.emit('message:dropped', message, 'Filtered by transform')
        return
      }
      
      // Find matching routes
      const enabledRoutes = Array.from(this.routes.values())
        .filter(route => route.enabled)
      const matchingRoutes = this.matcher.findMatches(transformed, enabledRoutes)
      
      if (matchingRoutes.length === 0) {
        // Use default handler if available
        if (this.config.defaultHandler) {
          await this.handleMessage(transformed, this.config.defaultHandler)
        } else if (this.config.queue.enabled) {
          // Queue message if no handler found
          this.queueMessage(transformed)
        } else {
          this.stats.dropped++
          this.emit('message:dropped', transformed, 'No matching route')
        }
        return
      }
      
      // Sort by priority and process
      const sortedRoutes = this.matcher.sortByPriority(matchingRoutes)
      
      for (const route of sortedRoutes) {
        try {
          await this.handleMessage(transformed, route.handler)
          this.stats.routed++
          this.emit('message:routed', transformed, route)
          
          // Stop after first successful handler unless route specifies otherwise
          break
        } catch (error) {
          this.logger.error({ error, route: route.name }, 'Route handler error')
          
          if (this.config.errorHandler) {
            this.config.errorHandler(error as Error, transformed)
          }
        }
      }
    } catch (error) {
      this.stats.errors++
      this.logger.error({ error, message }, 'Message processing error')
      this.emit('error', error as Error, message)
      
      if (this.config.errorHandler) {
        this.config.errorHandler(error as Error, message)
      }
    } finally {
      // Update processing time
      const duration = Date.now() - startTime
      this.updateProcessingTime(duration)
    }
  }

  /**
   * Process batch of messages
   */
  async processBatch(messages: Message[]): Promise<void> {
    const promises = messages.map(message => this.process(message))
    await Promise.all(promises)
  }

  /**
   * Get statistics
   */
  getStatistics(): MessageStatistics {
    return { ...this.stats }
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats.received = 0
    this.stats.routed = 0
    this.stats.transformed = 0
    this.stats.queued = 0
    this.stats.dropped = 0
    this.stats.errors = 0
    this.stats.byType = {} as Record<MessageType, number>
    this.stats.bySource = {} as Record<MessageSource, number>
    this.stats.avgProcessingTime = 0
    this.processingTimes = []
  }

  /**
   * Stop router
   */
  stop(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer)
      this.processTimer = undefined
    }
    
    this.removeAllListeners()
    this.logger.info('Message router stopped')
  }

  /**
   * Apply transforms
   */
  private async applyTransforms(message: Message): Promise<Message | null> {
    let current: Message | null = message
    
    for (const transform of this.transforms) {
      if (!current) break
      
      try {
        const transformed = await transform(current)
        
        if (transformed && transformed !== current) {
          this.stats.transformed++
          this.emit('message:transformed', current, transformed)
          current = transformed
        } else if (!transformed) {
          current = null
        }
      } catch (error) {
        this.logger.error({ error, message }, 'Transform error')
        throw error
      }
    }
    
    return current
  }

  /**
   * Handle message
   */
  private async handleMessage(
    message: Message,
    handler: MessageHandler
  ): Promise<void> {
    const result = await handler(message)
    
    // If handler returns a new message, process it
    if (result && typeof result === 'object' && 'type' in result) {
      await this.process(result as Message)
    }
  }

  /**
   * Queue message
   */
  private queueMessage(message: Message): void {
    const queued = this.queue.enqueue(message)
    
    if (queued) {
      this.stats.queued++
      this.emit('message:queued', message)
    } else {
      this.stats.dropped++
      this.emit('message:dropped', message, 'Queue full')
    }
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    this.processTimer = setInterval(() => {
      const message = this.queue.dequeue()
      
      if (message) {
        // Re-process queued message
        this.process(message.message).catch(error => {
          this.logger.error({ error, message }, 'Queue processing error')
        })
      }
    }, this.config.queue.processInterval)
  }

  /**
   * Update type statistics
   */
  private updateTypeStats(type: MessageType): void {
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1
  }

  /**
   * Update source statistics
   */
  private updateSourceStats(source: MessageSource): void {
    this.stats.bySource[source] = (this.stats.bySource[source] || 0) + 1
  }

  /**
   * Update processing time
   */
  private updateProcessingTime(duration: number): void {
    this.processingTimes.push(duration)
    
    // Keep last 1000 samples
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift()
    }
    
    // Calculate average
    const sum = this.processingTimes.reduce((a, b) => a + b, 0)
    this.stats.avgProcessingTime = sum / this.processingTimes.length
  }
}

/**
 * Create message router
 */
export function createMessageRouter(
  config: MessageRoutingConfig
): MessageRouter {
  return new MessageRouter(config)
}

/**
 * Create message
 */
export function createMessage(
  type: MessageType,
  source: MessageSource,
  payload: unknown,
  options?: Partial<Message>
): Message {
  return {
    id: uuidv4(),
    type,
    source,
    priority: 'normal',
    timestamp: Date.now() as Timestamp,
    payload,
    ...options
  }
}