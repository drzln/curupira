/**
 * Base Tool Provider - Common functionality for all tool providers
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'

export abstract class BaseToolProvider {
  /**
   * Get session ID from arguments or use the first available session
   */
  protected async getSessionId(argSessionId?: string): Promise<SessionId> {
    if (argSessionId) {
      return argSessionId as SessionId
    }
    
    const manager = ChromeManager.getInstance()
    const client = manager.getClient()
    const sessions = client.getSessions()
    
    if (sessions.length === 0) {
      throw new Error('No active Chrome session available')
    }
    
    return sessions[0].sessionId as SessionId
  }
  
  /**
   * Execute a script in the browser context with error handling
   */
  protected async executeScript<T = unknown>(
    script: string,
    sessionId: SessionId,
    options: {
      awaitPromise?: boolean
      returnByValue?: boolean
    } = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const manager = ChromeManager.getInstance()
    const client = manager.getClient()
    
    try {
      await client.send('Runtime.enable', {}, sessionId)
      
      const result = await client.send('Runtime.evaluate', {
        expression: script,
        returnByValue: options.returnByValue ?? true,
        awaitPromise: options.awaitPromise ?? true
      }, sessionId)
      
      if (result.exceptionDetails) {
        return {
          success: false,
          error: `Script execution error: ${result.exceptionDetails.text}`,
          data: result.exceptionDetails as T
        }
      }
      
      return {
        success: true,
        data: result.result.value as T
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Script execution failed'
      }
    }
  }
  
  /**
   * Check if a specific library or global is available
   */
  protected async checkLibraryAvailable(
    libraryCheck: string,
    sessionId: SessionId,
    libraryName: string
  ): Promise<{ available: boolean; error?: string }> {
    const result = await this.executeScript<boolean>(
      `typeof ${libraryCheck} !== 'undefined'`,
      sessionId,
      { awaitPromise: false }
    )
    
    if (!result.success) {
      return { available: false, error: result.error }
    }
    
    if (!result.data) {
      return { 
        available: false, 
        error: `${libraryName} not detected. Make sure the application uses ${libraryName}.`
      }
    }
    
    return { available: true }
  }
}