// Utility functions shared across Curupira

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

export function sanitizeForLogging(obj: unknown, depth = 0, maxDepth = 5): unknown {
  if (depth > maxDepth) {
    return '[Max depth reached]'
  }

  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, depth + 1, maxDepth))
  }

  const sanitized: Record<string, unknown> = {}
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'apiSecret',
    'authorization',
    'cookie',
    'session',
    'creditCard',
    'ssn',
    'jwt',
  ]

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeForLogging(value, depth + 1, maxDepth)
    }
  }

  return sanitized
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`
}

export function parseURL(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function isLocalhost(url: string): boolean {
  const parsed = parseURL(url)
  if (!parsed) return false

  const hostname = parsed.hostname
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local')
  )
}

export function createDeferred<T>() {
  let resolve: (value: T) => void
  let reject: (error: any) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

export class CircularBuffer<T> {
  private buffer: T[] = []
  private pointer = 0

  constructor(private readonly size: number) {}

  push(item: T): void {
    if (this.buffer.length < this.size) {
      this.buffer.push(item)
    } else {
      this.buffer[this.pointer] = item
      this.pointer = (this.pointer + 1) % this.size
    }
  }

  getAll(): T[] {
    if (this.buffer.length < this.size) {
      return [...this.buffer]
    }

    return [
      ...this.buffer.slice(this.pointer),
      ...this.buffer.slice(0, this.pointer),
    ]
  }

  clear(): void {
    this.buffer = []
    this.pointer = 0
  }

  get length(): number {
    return this.buffer.length
  }
}