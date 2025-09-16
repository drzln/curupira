/**
 * Chrome DevTools Protocol - Console Domain Types
 * https://chromedevtools.github.io/devtools-protocol/tot/Console/
 */

import type { Runtime } from './runtime.js'

export namespace Console {
  export interface ConsoleMessage {
    source: 'xml' | 'javascript' | 'network' | 'console-api' | 'storage' | 'appcache' | 
           'rendering' | 'security' | 'other' | 'deprecation' | 'worker'
    level: 'log' | 'warning' | 'error' | 'debug' | 'info'
    text: string
    url?: string
    line?: number
    column?: number
  }

  // Commands
  export interface ClearMessagesParams {
    // No parameters
  }

  export interface DisableParams {
    // No parameters
  }

  export interface EnableParams {
    // No parameters
  }

  // Events
  export interface MessageAddedEvent {
    message: ConsoleMessage
  }
}