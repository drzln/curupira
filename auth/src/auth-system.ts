/**
 * @fileoverview Main authentication system factory
 */

import { createLogger } from '@curupira/shared'
import { JwtProvider } from './providers/jwt.js'
import { AuthMiddleware } from './middleware/auth.js'
import { UserRepository } from './repositories/user.js'
import { SessionRepository } from './repositories/session.js'
import type { AuthConfig } from './types.js'

const logger = createLogger({ name: 'auth-system' })

/**
 * Authentication system
 */
export interface AuthSystem {
  jwtProvider: JwtProvider
  userRepository: UserRepository
  sessionRepository: SessionRepository
  middleware: AuthMiddleware
}

/**
 * Default authentication configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  jwt: {
    secret: process.env.CURUPIRA_JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
    issuer: 'curupira-mcp-server',
    audience: 'curupira-client'
  },
  providers: {
    google: process.env.GOOGLE_CLIENT_ID ? {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
    } : undefined,
    github: process.env.GITHUB_CLIENT_ID ? {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/github/callback'
    } : undefined
  },
  session: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxSessions: 10,
    redis: process.env.REDIS_URL ? {
      url: process.env.REDIS_URL,
      keyPrefix: 'curupira:session:'
    } : undefined
  },
  security: {
    bcryptRounds: 12,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // requests per window
    },
    allowedOrigins: [
      'http://localhost:3000',
      'https://localhost:3000',
      'chrome-extension://*'
    ],
    requireEmailVerification: false
  }
}

/**
 * Create authentication system
 */
export function createAuthSystem(config: Partial<AuthConfig> = {}): AuthSystem {
  const fullConfig: AuthConfig = {
    ...DEFAULT_AUTH_CONFIG,
    ...config,
    jwt: { ...DEFAULT_AUTH_CONFIG.jwt, ...config.jwt },
    providers: { ...DEFAULT_AUTH_CONFIG.providers, ...config.providers },
    session: { ...DEFAULT_AUTH_CONFIG.session, ...config.session },
    security: { ...DEFAULT_AUTH_CONFIG.security, ...config.security }
  }

  logger.info('Creating authentication system')

  // Create repositories
  const userRepository = new UserRepository(fullConfig.security.bcryptRounds)
  const sessionRepository = new SessionRepository(
    fullConfig.session.maxSessions,
    fullConfig.session.maxAge
  )

  // Create providers
  const jwtProvider = new JwtProvider(fullConfig.jwt)

  // Create middleware
  const middleware = new AuthMiddleware(fullConfig, userRepository, sessionRepository)

  logger.info('Authentication system created successfully')

  return {
    jwtProvider,
    userRepository,
    sessionRepository,
    middleware
  }
}