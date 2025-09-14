/**
 * @fileoverview JWT tests
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { 
  JwtManager, 
  createJwtManager, 
  parseAuthHeader, 
  hasPermission 
} from '../auth/jwt.js'
import type { AuthConfig, AuthUser } from '../auth/types.js'
import { createUserId, createSessionId } from '../../types/index.js'

describe('JWT', () => {
  let jwtManager: JwtManager
  let config: AuthConfig

  beforeEach(() => {
    config = {
      secret: 'test-secret-key-for-testing-only',
      accessTokenTTL: 300, // 5 minutes
      refreshTokenTTL: 86400, // 24 hours
      issuer: 'curupira-test',
      audience: 'curupira-client',
      algorithm: 'HS256',
      enableRefresh: true
    }
    jwtManager = createJwtManager(config)
  })

  describe('Token Creation', () => {
    test('creates valid access token', async () => {
      const userId = createUserId('user-123')
      const sessionId = createSessionId('session-456')
      const roles = ['developer']

      const result = await jwtManager.createTokens(userId, sessionId, roles)

      expect(result.accessToken).toBeDefined()
      expect(result.tokenType).toBe('Bearer')
      expect(result.expiresIn).toBe(300)
      expect(result.user.id).toBe(userId)
      expect(result.user.sessionId).toBe(sessionId)
      expect(result.user.roles).toEqual(roles)
    })

    test('creates refresh token when enabled', async () => {
      const userId = createUserId('user-123')
      const sessionId = createSessionId('session-456')

      const result = await jwtManager.createTokens(userId, sessionId)

      expect(result.refreshToken).toBeDefined()
    })

    test('does not create refresh token when disabled', async () => {
      config.enableRefresh = false
      jwtManager = createJwtManager(config)

      const userId = createUserId('user-123')
      const sessionId = createSessionId('session-456')

      const result = await jwtManager.createTokens(userId, sessionId)

      expect(result.refreshToken).toBeUndefined()
    })

    test('includes custom claims', async () => {
      const userId = createUserId('user-123')
      const sessionId = createSessionId('session-456')
      const claims = { department: 'engineering', level: 'senior' }

      const result = await jwtManager.createTokens(userId, sessionId, [], claims)

      expect(result.user.metadata).toEqual(claims)
    })
  })

  describe('Token Validation', () => {
    test('validates valid token', async () => {
      const userId = createUserId('user-123')
      const sessionId = createSessionId('session-456')
      const { accessToken } = await jwtManager.createTokens(userId, sessionId)

      const validation = await jwtManager.validateToken(accessToken)

      expect(validation.valid).toBe(true)
      expect(validation.payload).toBeDefined()
      expect(validation.payload?.sub).toBe(userId)
    })

    test('rejects invalid token', async () => {
      const validation = await jwtManager.validateToken('invalid-token')

      expect(validation.valid).toBe(false)
      expect(validation.error).toBe('INVALID_TOKEN')
    })

    test('rejects expired token', async () => {
      // Create manager with 0 second TTL
      const shortLivedManager = createJwtManager({
        ...config,
        accessTokenTTL: 0
      })

      const userId = createUserId('user-123')
      const sessionId = createSessionId('session-456')
      const { accessToken } = await shortLivedManager.createTokens(userId, sessionId)

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 100))

      const validation = await jwtManager.validateToken(accessToken)

      expect(validation.valid).toBe(false)
      expect(validation.error).toBe('TOKEN_EXPIRED')
    })
  })

  describe('Token Refresh', () => {
    test('refreshes valid refresh token', async () => {
      const userId = createUserId('user-123')
      const sessionId = createSessionId('session-456')
      const roles = ['developer']
      const { refreshToken } = await jwtManager.createTokens(userId, sessionId, roles)

      const newTokens = await jwtManager.refreshToken(refreshToken!)

      expect(newTokens.accessToken).toBeDefined()
      expect(newTokens.user.id).toBe(userId)
      expect(newTokens.user.sessionId).toBe(sessionId)
      expect(newTokens.user.roles).toEqual(roles)
    })

    test('rejects access token for refresh', async () => {
      const userId = createUserId('user-123')
      const sessionId = createSessionId('session-456')
      const { accessToken } = await jwtManager.createTokens(userId, sessionId)

      await expect(jwtManager.refreshToken(accessToken)).rejects.toThrow(
        'Token is not a refresh token'
      )
    })

    test('rejects refresh when disabled', async () => {
      config.enableRefresh = false
      jwtManager = createJwtManager(config)

      await expect(jwtManager.refreshToken('any-token')).rejects.toThrow(
        'Token refresh is not enabled'
      )
    })
  })

  describe('User Extraction', () => {
    test('extracts user from payload', async () => {
      const userId = createUserId('user-123')
      const sessionId = createSessionId('session-456')
      const roles = ['admin']
      const { accessToken } = await jwtManager.createTokens(userId, sessionId, roles)

      const validation = await jwtManager.validateToken(accessToken)
      const user = jwtManager.extractUser(validation.payload!)

      expect(user.id).toBe(userId)
      expect(user.sessionId).toBe(sessionId)
      expect(user.roles).toEqual(roles)
      expect(user.permissions).toContain('*') // Admin has all permissions
    })
  })
})

describe('Auth Utilities', () => {
  describe('parseAuthHeader', () => {
    test('parses valid Bearer token', () => {
      const token = parseAuthHeader('Bearer abc123')
      expect(token).toBe('abc123')
    })

    test('returns null for invalid format', () => {
      expect(parseAuthHeader('Basic abc123')).toBeNull()
      expect(parseAuthHeader('Bearer')).toBeNull()
      expect(parseAuthHeader('abc123')).toBeNull()
    })
  })

  describe('hasPermission', () => {
    test('grants wildcard permission', () => {
      const user: AuthUser = {
        id: createUserId('user-123'),
        sessionId: createSessionId('session-456'),
        roles: ['admin'],
        permissions: ['*']
      }

      expect(hasPermission(user, 'resource', 'action')).toBe(true)
    })

    test('grants specific permission', () => {
      const user: AuthUser = {
        id: createUserId('user-123'),
        sessionId: createSessionId('session-456'),
        roles: ['developer'],
        permissions: ['debug:read', 'debug:write']
      }

      expect(hasPermission(user, 'debug', 'read')).toBe(true)
      expect(hasPermission(user, 'debug', 'write')).toBe(true)
      expect(hasPermission(user, 'debug', 'delete')).toBe(false)
    })

    test('grants resource wildcard permission', () => {
      const user: AuthUser = {
        id: createUserId('user-123'),
        sessionId: createSessionId('session-456'),
        roles: ['developer'],
        permissions: ['tools:*']
      }

      expect(hasPermission(user, 'tools', 'read')).toBe(true)
      expect(hasPermission(user, 'tools', 'execute')).toBe(true)
      expect(hasPermission(user, 'debug', 'read')).toBe(false)
    })
  })
})