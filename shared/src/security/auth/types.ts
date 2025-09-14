/**
 * @fileoverview Authentication types
 * 
 * This file defines types for JWT authentication and authorization.
 */

import type { UserId, SessionId, RequestId } from '../../types/index.js'

/**
 * JWT token payload
 */
export interface JwtPayload {
  /** User ID */
  sub: UserId
  /** Session ID */
  sessionId: SessionId
  /** Issued at timestamp */
  iat: number
  /** Expiration timestamp */
  exp: number
  /** Token type */
  type: 'access' | 'refresh'
  /** User roles */
  roles?: string[]
  /** Additional claims */
  claims?: Record<string, unknown>
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** JWT secret key */
  secret: string
  /** Access token expiration (seconds) */
  accessTokenTTL: number
  /** Refresh token expiration (seconds) */
  refreshTokenTTL: number
  /** Token issuer */
  issuer: string
  /** Token audience */
  audience: string
  /** Algorithm to use */
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512'
  /** Enable token refresh */
  enableRefresh: boolean
  /** Maximum sessions per user */
  maxSessions?: number
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Access token */
  accessToken: string
  /** Refresh token (if enabled) */
  refreshToken?: string
  /** Token expiration */
  expiresIn: number
  /** Token type */
  tokenType: 'Bearer'
  /** User information */
  user: AuthUser
}

/**
 * Authenticated user
 */
export interface AuthUser {
  /** User ID */
  id: UserId
  /** Session ID */
  sessionId: SessionId
  /** User roles */
  roles: string[]
  /** User permissions */
  permissions: string[]
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Authentication context added to requests
 */
export interface AuthContext {
  /** Authenticated user */
  user: AuthUser
  /** Request ID */
  requestId: RequestId
  /** Authentication timestamp */
  authenticatedAt: number
  /** Token used */
  token: string
}

/**
 * Authentication errors
 */
export enum AuthErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TOO_MANY_SESSIONS = 'TOO_MANY_SESSIONS'
}

/**
 * Permission check function
 */
export type PermissionCheck = (
  user: AuthUser,
  resource: string,
  action: string
) => boolean | Promise<boolean>

/**
 * Token validation result
 */
export interface TokenValidation {
  /** Is token valid */
  valid: boolean
  /** Decoded payload if valid */
  payload?: JwtPayload
  /** Error if invalid */
  error?: AuthErrorCode
  /** Error message */
  message?: string
}