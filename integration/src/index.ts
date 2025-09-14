/**
 * @fileoverview Integration layer exports
 * 
 * This module provides high-level integration components for
 * WebSocket management, Chrome DevTools Protocol, message routing,
 * and storage abstraction.
 */

// WebSocket Manager
export * from './websocket/index.js'

// Chrome DevTools Protocol
export * from './cdp/index.js'

// Message routing
export * from './messages/index.js'

// Storage abstraction
export * from './storage/index.js'