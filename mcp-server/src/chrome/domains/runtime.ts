/**
 * Runtime domain wrapper for Chrome DevTools Protocol
 * 
 * Provides typed access to Runtime domain methods with proper error handling
 */

import type { ChromeClient } from '../client.js'
import type { Runtime, CDPSession } from '@curupira/shared/types/cdp.js'
import { remoteObjectToValue, valueToCallArgument } from '@curupira/shared/utils'
import { logger } from '../../config/logger.js'

export class RuntimeDomain {
  constructor(
    private client: ChromeClient,
    private sessionId: string
  ) {}

  /**
   * Enable the Runtime domain
   */
  async enable(): Promise<void> {
    await this.client.send('Runtime.enable', {}, this.sessionId)
  }

  /**
   * Disable the Runtime domain
   */
  async disable(): Promise<void> {
    await this.client.send('Runtime.disable', {}, this.sessionId)
  }

  /**
   * Evaluate expression in the global scope
   */
  async evaluate<T = unknown>(
    expression: string,
    options: {
      awaitPromise?: boolean
      returnByValue?: boolean
      generatePreview?: boolean
      silent?: boolean
      contextId?: number
      timeout?: number
    } = {}
  ): Promise<{ value?: T; error?: Error }> {
    try {
      const result = await this.client.send<{
        result: Runtime.RemoteObject
        exceptionDetails?: Runtime.ExceptionDetails
      }>('Runtime.evaluate', {
        expression,
        awaitPromise: options.awaitPromise ?? true,
        returnByValue: options.returnByValue ?? true,
        generatePreview: options.generatePreview ?? false,
        silent: options.silent ?? false,
        contextId: options.contextId,
        timeout: options.timeout
      }, this.sessionId)

      if (result.exceptionDetails) {
        return {
          error: new Error(
            result.exceptionDetails.text || 
            result.exceptionDetails.exception?.description ||
            'Evaluation failed'
          )
        }
      }

      return {
        value: remoteObjectToValue(result.result) as T
      }
    } catch (error) {
      logger.error('Runtime.evaluate failed', { expression, error })
      return { error: error as Error }
    }
  }

  /**
   * Call a function with given declaration
   */
  async callFunctionOn<T = unknown>(
    objectId: string,
    functionDeclaration: string,
    args: unknown[] = [],
    options: {
      returnByValue?: boolean
      generatePreview?: boolean
      awaitPromise?: boolean
    } = {}
  ): Promise<{ value?: T; error?: Error }> {
    try {
      const result = await this.client.send<{
        result: Runtime.RemoteObject
        exceptionDetails?: Runtime.ExceptionDetails
      }>('Runtime.callFunctionOn', {
        objectId,
        functionDeclaration,
        arguments: args.map(valueToCallArgument),
        returnByValue: options.returnByValue ?? true,
        generatePreview: options.generatePreview ?? false,
        awaitPromise: options.awaitPromise ?? true
      }, this.sessionId)

      if (result.exceptionDetails) {
        return {
          error: new Error(
            result.exceptionDetails.text || 
            'Function call failed'
          )
        }
      }

      return {
        value: remoteObjectToValue(result.result) as T
      }
    } catch (error) {
      logger.error('Runtime.callFunctionOn failed', { objectId, error })
      return { error: error as Error }
    }
  }

  /**
   * Get properties of an object
   */
  async getProperties(
    objectId: string,
    options: {
      ownProperties?: boolean
      accessorPropertiesOnly?: boolean
      generatePreview?: boolean
    } = {}
  ): Promise<Runtime.PropertyDescriptor[]> {
    try {
      const result = await this.client.send<{
        result: Runtime.PropertyDescriptor[]
        internalProperties?: Runtime.InternalPropertyDescriptor[]
        privateProperties?: Runtime.PrivatePropertyDescriptor[]
      }>('Runtime.getProperties', {
        objectId,
        ownProperties: options.ownProperties ?? true,
        accessorPropertiesOnly: options.accessorPropertiesOnly ?? false,
        generatePreview: options.generatePreview ?? true
      }, this.sessionId)

      return result.result
    } catch (error) {
      logger.error('Runtime.getProperties failed', { objectId, error })
      return []
    }
  }

  /**
   * Release an object
   */
  async releaseObject(objectId: string): Promise<void> {
    try {
      await this.client.send('Runtime.releaseObject', { objectId }, this.sessionId)
    } catch (error) {
      logger.error('Runtime.releaseObject failed', { objectId, error })
    }
  }

  /**
   * Release a group of objects
   */
  async releaseObjectGroup(objectGroup: string): Promise<void> {
    try {
      await this.client.send('Runtime.releaseObjectGroup', { objectGroup }, this.sessionId)
    } catch (error) {
      logger.error('Runtime.releaseObjectGroup failed', { objectGroup, error })
    }
  }

  /**
   * Get execution contexts
   */
  async getExecutionContexts(): Promise<Runtime.ExecutionContextDescription[]> {
    try {
      // Enable Runtime to get contexts
      await this.enable()
      
      // Get current contexts via evaluate
      const result = await this.evaluate<Runtime.ExecutionContextDescription[]>(
        `Array.from(window.__CDP_CONTEXTS__ || [])`
      )
      
      return result.value || []
    } catch (error) {
      logger.error('Failed to get execution contexts', error)
      return []
    }
  }

  /**
   * Compile script without executing
   */
  async compileScript(
    expression: string,
    sourceURL: string,
    persistScript = false
  ): Promise<{ scriptId?: string; error?: Runtime.ExceptionDetails }> {
    try {
      const result = await this.client.send<{
        scriptId?: string
        exceptionDetails?: Runtime.ExceptionDetails
      }>('Runtime.compileScript', {
        expression,
        sourceURL,
        persistScript
      }, this.sessionId)

      return {
        scriptId: result.scriptId,
        error: result.exceptionDetails
      }
    } catch (error) {
      logger.error('Runtime.compileScript failed', { sourceURL, error })
      return {}
    }
  }

  /**
   * Run previously compiled script
   */
  async runScript(
    scriptId: string,
    options: {
      executionContextId?: number
      objectGroup?: string
      silent?: boolean
      awaitPromise?: boolean
    } = {}
  ): Promise<{ value?: unknown; error?: Error }> {
    try {
      const result = await this.client.send<{
        result: Runtime.RemoteObject
        exceptionDetails?: Runtime.ExceptionDetails
      }>('Runtime.runScript', {
        scriptId,
        ...options
      }, this.sessionId)

      if (result.exceptionDetails) {
        return {
          error: new Error(result.exceptionDetails.text || 'Script execution failed')
        }
      }

      return {
        value: remoteObjectToValue(result.result)
      }
    } catch (error) {
      logger.error('Runtime.runScript failed', { scriptId, error })
      return { error: error as Error }
    }
  }

  /**
   * Set up console API event listener
   */
  onConsoleAPICalled(
    handler: (params: Runtime.ConsoleAPICalledEvent) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Runtime.consoleAPICalled', handler)
  }

  /**
   * Set up exception thrown event listener
   */
  onExceptionThrown(
    handler: (params: Runtime.ExceptionThrownEvent) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Runtime.exceptionThrown', handler)
  }

  /**
   * Set up execution context created event listener
   */
  onExecutionContextCreated(
    handler: (params: { context: Runtime.ExecutionContextDescription }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Runtime.executionContextCreated', handler)
  }

  /**
   * Set up execution context destroyed event listener
   */
  onExecutionContextDestroyed(
    handler: (params: { executionContextId: number }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Runtime.executionContextDestroyed', handler)
  }
}