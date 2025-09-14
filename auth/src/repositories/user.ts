/**
 * @fileoverview User repository for data access
 */

import bcrypt from 'bcrypt'
import { nanoid } from 'nanoid'
import { createLogger, generateId } from '@curupira/shared'
import type {
  User,
  RegisterData,
  LoginCredentials,
  AuthProvider,
  OAuthProfile,
  UserRole,
  CurupiraUserId
} from '../types.js'

const logger = createLogger({ name: 'user-repository' })

/**
 * In-memory user repository (replace with real database in production)
 */
export class UserRepository {
  private users = new Map<CurupiraUserId, User>()
  private emailIndex = new Map<string, CurupiraUserId>()
  private providerIndex = new Map<string, CurupiraUserId>()

  constructor(private readonly bcryptRounds: number = 12) {
    this.seedDefaultUsers()
  }

  /**
   * Find user by ID
   */
  async findById(id: CurupiraUserId): Promise<User | null> {
    return this.users.get(id) || null
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email.toLowerCase())
    return userId ? this.users.get(userId) || null : null
  }

  /**
   * Find user by provider ID
   */
  async findByProvider(provider: AuthProvider, providerId: string): Promise<User | null> {
    const key = `${provider}:${providerId}`
    const userId = this.providerIndex.get(key)
    return userId ? this.users.get(userId) || null : null
  }

  /**
   * Create new user from registration
   */
  async createUser(data: RegisterData): Promise<User> {
    const userId = generateId() as CurupiraUserId
    const hashedPassword = await bcrypt.hash(data.password, this.bcryptRounds)
    const now = Date.now()

    const user: User = {
      id: userId,
      email: data.email.toLowerCase(),
      name: data.name,
      role: 'developer' as UserRole,
      provider: 'local',
      providerId: hashedPassword, // Store hashed password as provider ID for local users
      active: true,
      createdAt: now,
      updatedAt: now,
      metadata: {}
    }

    this.users.set(userId, user)
    this.emailIndex.set(user.email, userId)
    this.providerIndex.set(`${user.provider}:${user.email}`, userId)

    logger.info({ userId, email: user.email }, 'User created')
    return user
  }

  /**
   * Create user from OAuth profile
   */
  async createOAuthUser(profile: OAuthProfile): Promise<User> {
    const userId = generateId() as CurupiraUserId
    const now = Date.now()

    const user: User = {
      id: userId,
      email: profile.email.toLowerCase(),
      name: profile.name,
      avatar: profile.avatar,
      role: 'developer' as UserRole,
      provider: profile.provider,
      providerId: profile.id,
      active: true,
      createdAt: now,
      updatedAt: now,
      metadata: {}
    }

    this.users.set(userId, user)
    this.emailIndex.set(user.email, userId)
    this.providerIndex.set(`${user.provider}:${user.providerId}`, userId)

    logger.info({ userId, email: user.email, provider: user.provider }, 'OAuth user created')
    return user
  }

  /**
   * Validate login credentials
   */
  async validateCredentials(credentials: LoginCredentials): Promise<User | null> {
    const user = await this.findByEmail(credentials.email)
    if (!user || user.provider !== 'local' || !user.active) {
      return null
    }

    // For local users, providerId contains the hashed password
    const isValid = await bcrypt.compare(credentials.password, user.providerId)
    if (!isValid) {
      return null
    }

    // Update last login
    user.lastLoginAt = Date.now()
    user.updatedAt = Date.now()

    return user
  }

  /**
   * Update user
   */
  async updateUser(userId: CurupiraUserId, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(userId)
    if (!user) {
      return null
    }

    const updatedUser = {
      ...user,
      ...updates,
      id: userId, // Preserve ID
      updatedAt: Date.now()
    }

    // Update indexes if email changed
    if (updates.email && updates.email !== user.email) {
      this.emailIndex.delete(user.email)
      this.emailIndex.set(updates.email.toLowerCase(), userId)
    }

    this.users.set(userId, updatedUser)
    return updatedUser
  }

  /**
   * Set user role
   */
  async setUserRole(userId: CurupiraUserId, role: UserRole): Promise<User | null> {
    return this.updateUser(userId, { role })
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: CurupiraUserId): Promise<boolean> {
    const user = await this.updateUser(userId, { active: false })
    return user !== null
  }

  /**
   * List all users (admin only)
   */
  async listUsers(limit = 50, offset = 0): Promise<{ users: User[], total: number }> {
    const allUsers = Array.from(this.users.values())
    const users = allUsers.slice(offset, offset + limit)
    
    return {
      users,
      total: allUsers.length
    }
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<{
    total: number
    active: number
    byRole: Record<UserRole, number>
    byProvider: Record<AuthProvider, number>
  }> {
    const users = Array.from(this.users.values())
    
    const stats = {
      total: users.length,
      active: users.filter(u => u.active).length,
      byRole: {
        admin: 0,
        developer: 0,
        readonly: 0
      } as Record<UserRole, number>,
      byProvider: {
        local: 0,
        google: 0,
        github: 0
      } as Record<AuthProvider, number>
    }

    for (const user of users) {
      stats.byRole[user.role]++
      stats.byProvider[user.provider]++
    }

    return stats
  }

  /**
   * Seed default users for development
   */
  private seedDefaultUsers(): void {
    const adminUserId = generateId() as CurupiraUserId
    const now = Date.now()

    // Create default admin user
    const adminUser: User = {
      id: adminUserId,
      email: 'admin@curupira.local',
      name: 'Admin User',
      role: 'admin',
      provider: 'local',
      providerId: '$2b$12$dummy.hash.for.admin.user', // bcrypt hash for 'admin123'
      active: true,
      createdAt: now,
      updatedAt: now,
      metadata: { seeded: true }
    }

    this.users.set(adminUserId, adminUser)
    this.emailIndex.set(adminUser.email, adminUserId)
    this.providerIndex.set(`${adminUser.provider}:${adminUser.email}`, adminUserId)

    // Hash the actual password for admin
    bcrypt.hash('admin123', this.bcryptRounds).then(hash => {
      adminUser.providerId = hash
    }).catch(error => {
      logger.error({ error }, 'Failed to hash admin password')
    })

    logger.info('Default admin user seeded: admin@curupira.local / admin123')
  }
}