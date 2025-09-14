/**
 * @fileoverview Security utilities
 * 
 * This file provides general security utilities for input validation,
 * sanitization, and cryptographic operations.
 */

import crypto from 'crypto'
import { z } from 'zod'

/**
 * Generate secure random token
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Generate secure random ID
 */
export function generateSecureId(): string {
  return crypto.randomUUID()
}

/**
 * Hash password using scrypt
 */
export async function hashPassword(password: string, salt?: string): Promise<{
  hash: string
  salt: string
}> {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex')
  
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, actualSalt, 64, (err, derivedKey) => {
      if (err) reject(err)
      else resolve({
        hash: derivedKey.toString('hex'),
        salt: actualSalt
      })
    })
  })
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
): Promise<boolean> {
  const result = await hashPassword(password, salt)
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(result.hash, 'hex')
  )
}

/**
 * Sanitize user input for logging
 */
export function sanitizeForLogging(input: unknown): unknown {
  if (typeof input === 'string') {
    // Remove potential sensitive patterns
    return input
      .replace(/password["\s]*[:=]["\s]*["']?[^"',}\s]+/gi, 'password=***')
      .replace(/token["\s]*[:=]["\s]*["']?[^"',}\s]+/gi, 'token=***')
      .replace(/api[_-]?key["\s]*[:=]["\s]*["']?[^"',}\s]+/gi, 'api_key=***')
      .replace(/secret["\s]*[:=]["\s]*["']?[^"',}\s]+/gi, 'secret=***')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: any = Array.isArray(input) ? [] : {}
    
    for (const [key, value] of Object.entries(input)) {
      // Skip sensitive keys entirely
      if (/password|token|secret|key|auth/i.test(key)) {
        sanitized[key] = '***'
      } else {
        sanitized[key] = sanitizeForLogging(value)
      }
    }
    
    return sanitized
  }

  return input
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    
    // Only allow http(s) and ws(s) protocols
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
      return null
    }
    
    // Prevent localhost/private network access in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsed.hostname.toLowerCase()
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        return null
      }
    }
    
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Input validation schemas
 */
export const SecuritySchemas = {
  // Email validation
  email: z.string().email().max(255),
  
  // Password validation (min 8 chars, requires upper, lower, number)
  password: z.string()
    .min(8)
    .max(128)
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
  
  // Username validation
  username: z.string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore, and hyphen'),
  
  // URL validation
  url: z.string().url().max(2048),
  
  // Session ID validation
  sessionId: z.string().uuid(),
  
  // Token validation
  token: z.string().regex(/^[a-zA-Z0-9_-]+$/).min(32).max(512)
}

/**
 * Constant-time string comparison
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(a),
    Buffer.from(b)
  )
}

/**
 * Create HMAC signature
 */
export function createHmac(
  data: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): string {
  return crypto
    .createHmac(algorithm, secret)
    .update(data)
    .digest('hex')
}

/**
 * Verify HMAC signature
 */
export function verifyHmac(
  data: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
  const expected = createHmac(data, secret, algorithm)
  return secureCompare(signature, expected)
}