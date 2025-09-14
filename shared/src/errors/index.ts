/**
 * Error System
 * 
 * Comprehensive error handling system for Curupira MCP debugging tool.
 * 
 * # Architecture
 * 
 * This module provides:
 * - Structured error types with categories and severity levels
 * - Factory functions for creating specific error types
 * - Error handling utilities including retry logic and circuit breakers
 * - Type-safe error metadata and context
 * 
 * # Dependencies
 * 
 * - `../types` for branded types and interfaces
 * - `../config` for configuration types
 * - `../telemetry` for telemetry integration
 * 
 * @module errors
 */

// Core error types and interfaces
export * from './types.js'

// Base error class and utilities
export * from './base.js'

// Error factory functions organized by category
export * from './factories.js'

// Error handling utilities and strategies
export * from './handlers.js'