/**
 * @fileoverview Branded types for type safety across Curupira
 * 
 * Branded types prevent mixing of conceptually different but structurally 
 * similar types. For example, a UserId and SessionId are both strings but 
 * should not be interchangeable.
 */

/**
 * Creates a branded type that cannot be assigned to its base type accidentally
 */
export type Branded<T, Brand extends string> = T & { __brand: Brand }

// Core domain branded types
export type SessionId = Branded<string, 'SessionId'>
export type UserId = Branded<string, 'UserId'> 
export type TabId = Branded<number, 'TabId'>
export type RequestId = Branded<string, 'RequestId'>
export type ActorId = Branded<string, 'ActorId'>
export type ComponentId = Branded<string, 'ComponentId'>
export type StoreId = Branded<string, 'StoreId'>
export type ResourceUri = Branded<string, 'ResourceUri'>
export type ToolName = Branded<string, 'ToolName'>
export type PromptName = Branded<string, 'PromptName'>

// Time-based branded types
export type Timestamp = Branded<number, 'Timestamp'>
export type Duration = Branded<number, 'Duration'>

// MCP Protocol branded types
export type JsonRpcId = Branded<string | number, 'JsonRpcId'>
export type JsonRpcMethod = Branded<string, 'JsonRpcMethod'>

/**
 * Type-safe creators for branded types
 */
export const createSessionId = (id: string): SessionId => id as SessionId
export const createUserId = (id: string): UserId => id as UserId
export const createTabId = (id: number): TabId => id as TabId
export const createRequestId = (id: string): RequestId => id as RequestId
export const createActorId = (id: string): ActorId => id as ActorId
export const createComponentId = (id: string): ComponentId => id as ComponentId
export const createStoreId = (id: string): StoreId => id as StoreId
export const createResourceUri = (uri: string): ResourceUri => uri as ResourceUri
export const createToolName = (name: string): ToolName => name as ToolName
export const createPromptName = (name: string): PromptName => name as PromptName

export const createTimestamp = (ts?: number): Timestamp => (ts ?? Date.now()) as Timestamp
export const createDuration = (ms: number): Duration => ms as Duration

export const createJsonRpcId = (id: string | number): JsonRpcId => id as JsonRpcId
export const createJsonRpcMethod = (method: string): JsonRpcMethod => method as JsonRpcMethod

/**
 * Type guards for runtime validation
 */
export const isSessionId = (value: unknown): value is SessionId => 
  typeof value === 'string' && value.length > 0

export const isUserId = (value: unknown): value is UserId =>
  typeof value === 'string' && value.length > 0

export const isTabId = (value: unknown): value is TabId =>
  typeof value === 'number' && value >= 0

export const isTimestamp = (value: unknown): value is Timestamp =>
  typeof value === 'number' && value > 0

export const isDuration = (value: unknown): value is Duration =>
  typeof value === 'number' && value >= 0

export const isJsonRpcId = (value: unknown): value is JsonRpcId =>
  (typeof value === 'string' || typeof value === 'number') && 
  value !== null && value !== undefined

/**
 * Utility functions for branded types
 */
export const unwrap = <T, B extends string>(branded: Branded<T, B>): T => 
  branded as unknown as T

export const generateId = (): RequestId => 
  createRequestId(Math.random().toString(36).substring(2, 15))

export const generateSessionId = (): SessionId =>
  createSessionId(crypto.randomUUID())