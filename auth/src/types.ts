/**
 * @fileoverview Authentication types and interfaces
 */

import type { 
  CurupiraUserId,
  CurupiraSessionId,
  CurupiraApiKey,
  TimeStamp 
} from '@curupira/shared'

/**
 * User role for permissions
 */
export type UserRole = 'admin' | 'developer' | 'readonly'

/**
 * Authentication provider
 */
export type AuthProvider = 'local' | 'google' | 'github'

/**
 * User account
 */
export interface User {
  id: CurupiraUserId
  email: string
  name: string
  avatar?: string
  role: UserRole
  provider: AuthProvider
  providerId: string
  active: boolean
  createdAt: TimeStamp
  updatedAt: TimeStamp
  lastLoginAt?: TimeStamp
  metadata: Record<string, any>
}

/**
 * Authentication session
 */
export interface AuthSession {
  id: CurupiraSessionId
  userId: CurupiraUserId
  token: string
  refreshToken: string
  expiresAt: TimeStamp
  createdAt: TimeStamp
  lastAccessAt: TimeStamp
  userAgent?: string
  ipAddress?: string
  active: boolean
  metadata: Record<string, any>
}

/**
 * API key for service authentication
 */
export interface ApiKey {
  id: CurupiraApiKey
  name: string
  userId: CurupiraUserId
  key: string
  scopes: string[]
  expiresAt?: TimeStamp
  active: boolean
  createdAt: TimeStamp
  lastUsedAt?: TimeStamp
  requestCount: number
  metadata: Record<string, any>
}

/**
 * JWT token payload
 */
export interface JwtPayload {
  sub: CurupiraUserId
  sessionId: CurupiraSessionId
  email: string
  name: string
  role: UserRole
  scopes: string[]
  iat: number
  exp: number
  iss: string
  aud: string
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  jwt: {
    secret: string
    expiresIn: string
    refreshExpiresIn: string
    issuer: string
    audience: string
  }
  providers: {
    google?: {
      clientId: string
      clientSecret: string
      callbackUrl: string
    }
    github?: {
      clientId: string
      clientSecret: string
      callbackUrl: string
    }
  }
  session: {
    maxAge: number
    maxSessions: number
    redis?: {
      url: string
      keyPrefix: string
    }
  }
  security: {
    bcryptRounds: number
    rateLimit: {
      windowMs: number
      max: number
    }
    allowedOrigins: string[]
    requireEmailVerification: boolean
  }
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string
  password: string
  name: string
  acceptTerms: boolean
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string
}

/**
 * Password reset data
 */
export interface PasswordResetData {
  token: string
  password: string
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean
  user?: User
  session?: AuthSession
  token?: string
  refreshToken?: string
  error?: string
}

/**
 * OAuth profile
 */
export interface OAuthProfile {
  id: string
  email: string
  name: string
  avatar?: string
  provider: AuthProvider
}

/**
 * Permission definition
 */
export interface Permission {
  resource: string
  action: string
  conditions?: Record<string, any>
}

/**
 * Authorization context
 */
export interface AuthContext {
  user: User
  session: AuthSession
  permissions: Permission[]
  scopes: string[]
}

/**
 * Middleware context
 */
export interface AuthMiddlewareContext {
  user?: User
  session?: AuthSession
  authenticated: boolean
  permissions: string[]
}