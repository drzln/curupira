/**
 * @fileoverview Session repository for managing user sessions
 */

import { nanoid } from 'nanoid'
import { createLogger, generateId } from '@curupira/shared'
import type {
  AuthSession,
  User,
  CurupiraSessionId,
  CurupiraUserId
} from '../types.js'

const logger = createLogger({ name: 'session-repository' })

/**
 * In-memory session repository (replace with Redis in production)
 */
export class SessionRepository {
  private sessions = new Map<CurupiraSessionId, AuthSession>()
  private userSessions = new Map<CurupiraUserId, Set<CurupiraSessionId>>()

  constructor(
    private readonly maxSessionsPerUser = 10,
    private readonly sessionTtl = 24 * 60 * 60 * 1000 // 24 hours
  ) {
    this.startCleanupTimer()
  }

  /**
   * Create new session
   */
  async createSession(
    user: User,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthSession> {
    const sessionId = generateId() as CurupiraSessionId
    const now = Date.now()

    const session: AuthSession = {
      id: sessionId,
      userId: user.id,
      token: '', // Will be set by JWT provider
      refreshToken: nanoid(64),
      expiresAt: now + this.sessionTtl,
      createdAt: now,
      lastAccessAt: now,
      userAgent,
      ipAddress,
      active: true,
      metadata: {}
    }

    // Cleanup old sessions if user has too many
    await this.cleanupUserSessions(user.id)

    // Store session
    this.sessions.set(sessionId, session)
    
    // Update user session index
    if (!this.userSessions.has(user.id)) {
      this.userSessions.set(user.id, new Set())
    }
    this.userSessions.get(user.id)!.add(sessionId)

    logger.debug({ sessionId, userId: user.id }, 'Session created')
    return session
  }

  /**
   * Find session by ID
   */
  async findById(sessionId: CurupiraSessionId): Promise<AuthSession | null> {
    const session = this.sessions.get(sessionId)
    
    if (!session) {
      return null
    }

    // Check if session is expired
    if (!session.active || session.expiresAt < Date.now()) {
      await this.deleteSession(sessionId)
      return null
    }

    return session
  }

  /**
   * Find session by refresh token
   */
  async findByRefreshToken(refreshToken: string): Promise<AuthSession | null> {
    for (const session of this.sessions.values()) {
      if (session.refreshToken === refreshToken && session.active) {
        // Check if session is expired
        if (session.expiresAt < Date.now()) {
          await this.deleteSession(session.id)
          return null
        }
        return session
      }
    }
    return null
  }

  /**
   * Update session token
   */
  async updateToken(sessionId: CurupiraSessionId, token: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    session.token = token
    session.lastAccessAt = Date.now()
    return true
  }

  /**
   * Update last access time
   */
  async updateLastAccess(sessionId: CurupiraSessionId): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    session.lastAccessAt = Date.now()
    return true
  }

  /**
   * Refresh session (extend expiration)
   */
  async refreshSession(sessionId: CurupiraSessionId): Promise<AuthSession | null> {
    const session = this.sessions.get(sessionId)
    if (!session || !session.active) {
      return null
    }

    // Generate new refresh token
    session.refreshToken = nanoid(64)
    session.expiresAt = Date.now() + this.sessionTtl
    session.lastAccessAt = Date.now()

    logger.debug({ sessionId }, 'Session refreshed')
    return session
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: CurupiraSessionId): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    // Remove from user session index
    const userSessions = this.userSessions.get(session.userId)
    if (userSessions) {
      userSessions.delete(sessionId)
      if (userSessions.size === 0) {
        this.userSessions.delete(session.userId)
      }
    }

    // Remove session
    this.sessions.delete(sessionId)
    
    logger.debug({ sessionId, userId: session.userId }, 'Session deleted')
    return true
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: CurupiraUserId): Promise<number> {
    const userSessions = this.userSessions.get(userId)
    if (!userSessions) {
      return 0
    }

    let deletedCount = 0
    for (const sessionId of userSessions) {
      if (await this.deleteSession(sessionId)) {
        deletedCount++
      }
    }

    logger.debug({ userId, deletedCount }, 'User sessions deleted')
    return deletedCount
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: CurupiraUserId): Promise<AuthSession[]> {
    const userSessions = this.userSessions.get(userId)
    if (!userSessions) {
      return []
    }

    const sessions: AuthSession[] = []
    for (const sessionId of userSessions) {
      const session = await this.findById(sessionId)
      if (session) {
        sessions.push(session)
      }
    }

    return sessions.sort((a, b) => b.lastAccessAt - a.lastAccessAt)
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    total: number
    active: number
    expired: number
    byUser: number
  }> {
    const now = Date.now()
    const sessions = Array.from(this.sessions.values())
    
    return {
      total: sessions.length,
      active: sessions.filter(s => s.active && s.expiresAt > now).length,
      expired: sessions.filter(s => s.expiresAt <= now).length,
      byUser: this.userSessions.size
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now()
    const expiredSessions: CurupiraSessionId[] = []

    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now) {
        expiredSessions.push(sessionId)
      }
    }

    let deletedCount = 0
    for (const sessionId of expiredSessions) {
      if (await this.deleteSession(sessionId)) {
        deletedCount++
      }
    }

    if (deletedCount > 0) {
      logger.debug({ deletedCount }, 'Expired sessions cleaned up')
    }

    return deletedCount
  }

  /**
   * Cleanup old sessions for a user (keep only recent ones)
   */
  private async cleanupUserSessions(userId: CurupiraUserId): Promise<void> {
    const userSessions = await this.getUserSessions(userId)
    
    if (userSessions.length <= this.maxSessionsPerUser) {
      return
    }

    // Sort by last access (most recent first)
    const sortedSessions = userSessions.sort((a, b) => b.lastAccessAt - a.lastAccessAt)
    
    // Delete oldest sessions
    const sessionsToDelete = sortedSessions.slice(this.maxSessionsPerUser)
    for (const session of sessionsToDelete) {
      await this.deleteSession(session.id)
    }

    logger.debug(
      { userId, deleted: sessionsToDelete.length, remaining: this.maxSessionsPerUser },
      'User sessions cleaned up'
    )
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    const cleanupInterval = 60 * 60 * 1000 // 1 hour
    
    setInterval(async () => {
      try {
        await this.cleanupExpiredSessions()
      } catch (error) {
        logger.error({ error }, 'Session cleanup failed')
      }
    }, cleanupInterval)

    logger.debug({ cleanupInterval }, 'Session cleanup timer started')
  }
}