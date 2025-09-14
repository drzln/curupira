/**
 * @fileoverview Apollo Client DevTools integration
 */

import { EventEmitter } from 'events'
import { createLogger, type Logger } from '@curupira/shared'

/**
 * Apollo Client instance interface
 */
export interface ApolloClientInstance {
  id: string
  version: string
  cache: {
    size: number
    data: Record<string, any>
    optimistic: any[]
    watches: number
  }
  queries: ApolloQuery[]
  mutations: ApolloMutation[]
  subscriptions: ApolloSubscription[]
  config: {
    uri?: string
    credentials?: string
    headers?: Record<string, string>
    errorPolicy?: string
    fetchPolicy?: string
  }
}

/**
 * Apollo query interface
 */
export interface ApolloQuery {
  id: string
  operationName: string
  query: string
  variables?: Record<string, any>
  status: 'loading' | 'error' | 'ready' | 'polling'
  data?: any
  error?: {
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
    extensions?: Record<string, any>
  }
  networkStatus: number
  loading: boolean
  partial: boolean
  stale: boolean
  timestamp: number
}

/**
 * Apollo mutation interface
 */
export interface ApolloMutation {
  id: string
  operationName: string
  mutation: string
  variables?: Record<string, any>
  status: 'loading' | 'error' | 'ready'
  data?: any
  error?: {
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
    extensions?: Record<string, any>
  }
  loading: boolean
  timestamp: number
}

/**
 * Apollo subscription interface
 */
export interface ApolloSubscription {
  id: string
  operationName: string
  subscription: string
  variables?: Record<string, any>
  status: 'loading' | 'error' | 'ready'
  data?: any
  error?: {
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
    extensions?: Record<string, any>
  }
  timestamp: number
}

/**
 * Apollo cache operation interface
 */
export interface ApolloCacheOperation {
  id: string
  clientId: string
  type: 'read' | 'write' | 'evict' | 'restore' | 'reset'
  dataId?: string
  fieldName?: string
  variables?: Record<string, any>
  data?: any
  result?: any
  timestamp: number
}

/**
 * Apollo DevTools events
 */
export interface ApolloDevToolsEvents {
  'client.register': (client: ApolloClientInstance) => void
  'client.unregister': (clientId: string) => void
  'client.update': (client: ApolloClientInstance) => void
  'query.start': (query: ApolloQuery) => void
  'query.result': (query: ApolloQuery) => void
  'query.error': (query: ApolloQuery) => void
  'mutation.start': (mutation: ApolloMutation) => void
  'mutation.result': (mutation: ApolloMutation) => void
  'mutation.error': (mutation: ApolloMutation) => void
  'subscription.start': (subscription: ApolloSubscription) => void
  'subscription.data': (subscription: ApolloSubscription) => void
  'subscription.error': (subscription: ApolloSubscription) => void
  'cache.operation': (operation: ApolloCacheOperation) => void
  'cache.update': (clientId: string, cacheData: Record<string, any>) => void
  'error': (error: Error) => void
}

/**
 * Apollo DevTools configuration
 */
export interface ApolloDevToolsConfig {
  enableCacheInspection?: boolean
  enableQueryTracking?: boolean
  enableMutationTracking?: boolean
  enableSubscriptionTracking?: boolean
  maxHistorySize?: number
  filterOperations?: (operation: any) => boolean
  sanitizeVariables?: (variables: any) => any
  sanitizeData?: (data: any) => any
  debugMode?: boolean
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ApolloDevToolsConfig = {
  enableCacheInspection: true,
  enableQueryTracking: true,
  enableMutationTracking: true,
  enableSubscriptionTracking: true,
  maxHistorySize: 100,
  filterOperations: () => true,
  sanitizeVariables: (variables) => variables,
  sanitizeData: (data) => data,
  debugMode: false,
}

/**
 * Apollo Client DevTools integration
 */
export class ApolloDevTools extends EventEmitter<ApolloDevToolsEvents> {
  private readonly logger: Logger
  private readonly config: ApolloDevToolsConfig
  private readonly clients = new Map<string, ApolloClientInstance>()
  private readonly clientInstances = new Map<string, any>()
  private readonly operationHistory: (ApolloQuery | ApolloMutation | ApolloSubscription)[] = []
  private readonly cacheOperations: ApolloCacheOperation[] = []
  private isConnected = false
  private operationId = 0

  constructor(config: ApolloDevToolsConfig = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = createLogger({ 
      level: this.config.debugMode ? 'debug' : 'info' 
    })
  }

  /**
   * Connect to Apollo Client
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    try {
      // Check for Apollo Client DevTools hook
      this.setupApolloHooks()
      
      // Discover existing clients
      await this.discoverExistingClients()
      
      this.isConnected = true
      this.logger.info('Apollo DevTools connected')
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to Apollo DevTools')
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Disconnect from Apollo Client
   */
  disconnect(): void {
    if (!this.isConnected) {
      return
    }

    this.cleanupHooks()
    this.clients.clear()
    this.clientInstances.clear()
    this.operationHistory.length = 0
    this.cacheOperations.length = 0
    this.isConnected = false
    
    this.logger.info('Apollo DevTools disconnected')
  }

  /**
   * Register Apollo Client instance
   */
  registerClient(client: any, config: any = {}): void {
    const clientId = this.generateClientId()
    
    const apolloClient: ApolloClientInstance = {
      id: clientId,
      version: client.version || 'unknown',
      cache: this.extractCacheInfo(client.cache),
      queries: [],
      mutations: [],
      subscriptions: [],
      config: {
        uri: config.uri,
        credentials: config.credentials,
        headers: config.headers,
        errorPolicy: config.errorPolicy,
        fetchPolicy: config.fetchPolicy
      }
    }

    this.clients.set(clientId, apolloClient)
    this.clientInstances.set(clientId, client)

    // Hook into client operations
    this.hookClientOperations(client, clientId)
    
    // Hook into cache operations if enabled
    if (this.config.enableCacheInspection) {
      this.hookCacheOperations(client.cache, clientId)
    }

    this.emit('client.register', apolloClient)
    this.logger.debug({ clientId }, 'Apollo Client registered')
  }

  /**
   * Get all registered clients
   */
  getClients(): ApolloClientInstance[] {
    return Array.from(this.clients.values())
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): ApolloClientInstance | undefined {
    return this.clients.get(clientId)
  }

  /**
   * Get client cache data
   */
  getClientCache(clientId: string): Record<string, any> {
    const client = this.clientInstances.get(clientId)
    if (!client || !client.cache) {
      throw new Error(`Client not found: ${clientId}`)
    }

    return this.extractCacheData(client.cache)
  }

  /**
   * Write to client cache
   */
  writeToCache(clientId: string, options: any): void {
    const client = this.clientInstances.get(clientId)
    if (!client || !client.cache) {
      throw new Error(`Client not found: ${clientId}`)
    }

    client.cache.writeQuery(options)
    this.updateClientCache(clientId)
  }

  /**
   * Read from client cache
   */
  readFromCache(clientId: string, options: any): any {
    const client = this.clientInstances.get(clientId)
    if (!client || !client.cache) {
      throw new Error(`Client not found: ${clientId}`)
    }

    return client.cache.readQuery(options)
  }

  /**
   * Evict from cache
   */
  evictFromCache(clientId: string, options: any): void {
    const client = this.clientInstances.get(clientId)
    if (!client || !client.cache) {
      throw new Error(`Client not found: ${clientId}`)
    }

    client.cache.evict(options)
    this.updateClientCache(clientId)
  }

  /**
   * Reset client cache
   */
  resetCache(clientId: string): void {
    const client = this.clientInstances.get(clientId)
    if (!client || !client.cache) {
      throw new Error(`Client not found: ${clientId}`)
    }

    client.cache.reset()
    this.updateClientCache(clientId)
  }

  /**
   * Get operation history
   */
  getOperationHistory(clientId?: string): (ApolloQuery | ApolloMutation | ApolloSubscription)[] {
    if (clientId) {
      return this.operationHistory.filter((op: any) => op.clientId === clientId)
    }
    return [...this.operationHistory]
  }

  /**
   * Get cache operations
   */
  getCacheOperations(clientId?: string): ApolloCacheOperation[] {
    if (clientId) {
      return this.cacheOperations.filter(op => op.clientId === clientId)
    }
    return [...this.cacheOperations]
  }

  /**
   * Setup Apollo hooks
   */
  private setupApolloHooks(): void {
    // Hook into Apollo Client constructor
    this.hookApolloClientConstructor()
    
    // Hook into global Apollo instances
    this.hookGlobalApolloInstances()

    this.logger.debug('Apollo hooks setup complete')
  }

  /**
   * Hook Apollo Client constructor
   */
  private hookApolloClientConstructor(): void {
    const apolloClient = (globalThis as any).ApolloClient
    if (!apolloClient) return

    const originalConstructor = apolloClient
    const self = this

    function HookedApolloClient(...args: any[]) {
      const instance = new originalConstructor(...args)
      self.registerClient(instance, args[0] || {})
      return instance
    }

    // Copy static properties
    Object.setPrototypeOf(HookedApolloClient, originalConstructor)
    Object.defineProperty(HookedApolloClient, 'name', { value: 'ApolloClient' })

    // Replace global constructor
    ;(globalThis as any).ApolloClient = HookedApolloClient
  }

  /**
   * Hook global Apollo instances
   */
  private hookGlobalApolloInstances(): void {
    const possibleLocations = [
      (globalThis as any).__APOLLO_CLIENT__,
      (globalThis as any).apolloClient,
      (globalThis as any).client
    ]

    for (const client of possibleLocations) {
      if (client && typeof client.query === 'function') {
        this.registerClient(client)
      }
    }
  }

  /**
   * Hook client operations
   */
  private hookClientOperations(client: any, clientId: string): void {
    // Hook query method
    if (client.query) {
      const originalQuery = client.query.bind(client)
      client.query = async (options: any) => {
        const queryId = this.generateOperationId()
        const query = this.createQueryObject(queryId, clientId, options)
        
        if (this.config.enableQueryTracking) {
          this.recordOperation(query)
          this.emit('query.start', query)
        }

        try {
          const result = await originalQuery(options)
          
          if (this.config.enableQueryTracking) {
            query.status = 'ready'
            query.data = this.config.sanitizeData!(result.data)
            query.loading = false
            query.networkStatus = result.networkStatus || 7
            
            this.emit('query.result', query)
          }
          
          return result
        } catch (error) {
          if (this.config.enableQueryTracking) {
            query.status = 'error'
            query.error = this.sanitizeError(error)
            query.loading = false
            
            this.emit('query.error', query)
          }
          
          throw error
        }
      }
    }

    // Hook mutate method
    if (client.mutate) {
      const originalMutate = client.mutate.bind(client)
      client.mutate = async (options: any) => {
        const mutationId = this.generateOperationId()
        const mutation = this.createMutationObject(mutationId, clientId, options)
        
        if (this.config.enableMutationTracking) {
          this.recordOperation(mutation)
          this.emit('mutation.start', mutation)
        }

        try {
          const result = await originalMutate(options)
          
          if (this.config.enableMutationTracking) {
            mutation.status = 'ready'
            mutation.data = this.config.sanitizeData!(result.data)
            mutation.loading = false
            
            this.emit('mutation.result', mutation)
          }
          
          return result
        } catch (error) {
          if (this.config.enableMutationTracking) {
            mutation.status = 'error'
            mutation.error = this.sanitizeError(error)
            mutation.loading = false
            
            this.emit('mutation.error', mutation)
          }
          
          throw error
        }
      }
    }

    // Hook subscribe method
    if (client.subscribe) {
      const originalSubscribe = client.subscribe.bind(client)
      client.subscribe = (options: any) => {
        const subscriptionId = this.generateOperationId()
        const subscription = this.createSubscriptionObject(subscriptionId, clientId, options)
        
        if (this.config.enableSubscriptionTracking) {
          this.recordOperation(subscription)
          this.emit('subscription.start', subscription)
        }

        const observable = originalSubscribe(options)
        
        if (this.config.enableSubscriptionTracking) {
          // Hook into observable
          const originalSubscribe = observable.subscribe.bind(observable)
          observable.subscribe = (observer: any) => {
            const wrappedObserver = {
              ...observer,
              next: (data: any) => {
                subscription.status = 'ready'
                subscription.data = this.config.sanitizeData!(data)
                this.emit('subscription.data', subscription)
                
                if (observer.next) observer.next(data)
              },
              error: (error: any) => {
                subscription.status = 'error'
                subscription.error = this.sanitizeError(error)
                this.emit('subscription.error', subscription)
                
                if (observer.error) observer.error(error)
              }
            }
            
            return originalSubscribe(wrappedObserver)
          }
        }
        
        return observable
      }
    }
  }

  /**
   * Hook cache operations
   */
  private hookCacheOperations(cache: any, clientId: string): void {
    if (!cache) return

    // Hook cache read operations
    if (cache.read) {
      const originalRead = cache.read.bind(cache)
      cache.read = (options: any) => {
        const result = originalRead(options)
        
        this.recordCacheOperation({
          id: this.generateOperationId(),
          clientId,
          type: 'read',
          dataId: options.dataId,
          variables: options.variables,
          result,
          timestamp: Date.now()
        })
        
        return result
      }
    }

    // Hook cache write operations
    if (cache.write) {
      const originalWrite = cache.write.bind(cache)
      cache.write = (options: any) => {
        const result = originalWrite(options)
        
        this.recordCacheOperation({
          id: this.generateOperationId(),
          clientId,
          type: 'write',
          dataId: options.dataId,
          data: options.data,
          timestamp: Date.now()
        })
        
        this.updateClientCache(clientId)
        return result
      }
    }

    // Hook cache evict operations
    if (cache.evict) {
      const originalEvict = cache.evict.bind(cache)
      cache.evict = (options: any) => {
        const result = originalEvict(options)
        
        this.recordCacheOperation({
          id: this.generateOperationId(),
          clientId,
          type: 'evict',
          dataId: options.id,
          fieldName: options.fieldName,
          timestamp: Date.now()
        })
        
        this.updateClientCache(clientId)
        return result
      }
    }
  }

  /**
   * Extract cache information
   */
  private extractCacheInfo(cache: any): ApolloClientInstance['cache'] {
    if (!cache) {
      return { size: 0, data: {}, optimistic: [], watches: 0 }
    }

    return {
      size: this.calculateCacheSize(cache),
      data: this.extractCacheData(cache),
      optimistic: cache.optimisticData ? Object.keys(cache.optimisticData) : [],
      watches: cache.watches ? cache.watches.size || 0 : 0
    }
  }

  /**
   * Extract cache data
   */
  private extractCacheData(cache: any): Record<string, any> {
    if (!cache || !cache.data) {
      return {}
    }

    try {
      return this.config.sanitizeData!(cache.data)
    } catch {
      return { error: 'Failed to extract cache data' }
    }
  }

  /**
   * Calculate cache size
   */
  private calculateCacheSize(cache: any): number {
    if (!cache || !cache.data) return 0
    
    try {
      return JSON.stringify(cache.data).length
    } catch {
      return 0
    }
  }

  /**
   * Create query object
   */
  private createQueryObject(id: string, clientId: string, options: any): ApolloQuery {
    return {
      id,
      operationName: options.operationName || 'UnnamedQuery',
      query: this.operationToString(options.query),
      variables: this.config.sanitizeVariables!(options.variables),
      status: 'loading',
      networkStatus: 1,
      loading: true,
      partial: false,
      stale: false,
      timestamp: Date.now()
    }
  }

  /**
   * Create mutation object
   */
  private createMutationObject(id: string, clientId: string, options: any): ApolloMutation {
    return {
      id,
      operationName: options.operationName || 'UnnamedMutation',
      mutation: this.operationToString(options.mutation),
      variables: this.config.sanitizeVariables!(options.variables),
      status: 'loading',
      loading: true,
      timestamp: Date.now()
    }
  }

  /**
   * Create subscription object
   */
  private createSubscriptionObject(id: string, clientId: string, options: any): ApolloSubscription {
    return {
      id,
      operationName: options.operationName || 'UnnamedSubscription',
      subscription: this.operationToString(options.query),
      variables: this.config.sanitizeVariables!(options.variables),
      status: 'loading',
      timestamp: Date.now()
    }
  }

  /**
   * Convert operation to string
   */
  private operationToString(operation: any): string {
    if (typeof operation === 'string') {
      return operation
    }
    
    if (operation && operation.loc && operation.loc.source) {
      return operation.loc.source.body
    }
    
    return operation?.toString() || 'Unknown operation'
  }

  /**
   * Sanitize error object
   */
  private sanitizeError(error: any): ApolloQuery['error'] {
    return {
      message: error.message || 'Unknown error',
      locations: error.locations,
      path: error.path,
      extensions: error.extensions
    }
  }

  /**
   * Record operation in history
   */
  private recordOperation(operation: ApolloQuery | ApolloMutation | ApolloSubscription): void {
    if (!this.config.filterOperations!(operation)) {
      return
    }

    this.operationHistory.push(operation)
    
    // Limit history size
    if (this.operationHistory.length > this.config.maxHistorySize!) {
      this.operationHistory.shift()
    }
  }

  /**
   * Record cache operation
   */
  private recordCacheOperation(operation: ApolloCacheOperation): void {
    this.cacheOperations.push(operation)
    
    // Limit history size
    if (this.cacheOperations.length > this.config.maxHistorySize!) {
      this.cacheOperations.shift()
    }
    
    this.emit('cache.operation', operation)
  }

  /**
   * Update client cache information
   */
  private updateClientCache(clientId: string): void {
    const client = this.clients.get(clientId)
    const clientInstance = this.clientInstances.get(clientId)
    
    if (client && clientInstance && clientInstance.cache) {
      client.cache = this.extractCacheInfo(clientInstance.cache)
      this.emit('cache.update', clientId, client.cache.data)
    }
  }

  /**
   * Discover existing Apollo clients
   */
  private async discoverExistingClients(): Promise<void> {
    // Check common locations where Apollo clients might be stored
    const possibleLocations = [
      (globalThis as any).__APOLLO_CLIENT__,
      (globalThis as any).apolloClient,
      (globalThis as any).client,
      (globalThis as any).apolloClients
    ]

    for (const location of possibleLocations) {
      if (location) {
        if (typeof location.query === 'function') {
          // Single client
          this.registerClient(location)
        } else if (Array.isArray(location)) {
          // Array of clients
          for (const client of location) {
            if (typeof client.query === 'function') {
              this.registerClient(client)
            }
          }
        } else if (typeof location === 'object') {
          // Object with clients
          for (const [key, client] of Object.entries(location)) {
            if (client && typeof (client as any).query === 'function') {
              this.registerClient(client, { name: key })
            }
          }
        }
      }
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `apollo_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${++this.operationId}`
  }

  /**
   * Cleanup hooks
   */
  private cleanupHooks(): void {
    // This would restore original methods in a complete implementation
  }
}