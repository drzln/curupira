/**
 * Command whitelisting module
 * 
 * Controls which CDP commands and MCP tools are allowed
 */

import { logger } from '../config/logger.js'

export interface WhitelistConfig {
  enabled: boolean
  allowedCDPDomains?: string[]
  allowedCDPMethods?: string[]
  blockedCDPMethods?: string[]
  allowedTools?: string[]
  blockedTools?: string[]
  allowedResourcePatterns?: string[]
  maxExecutionTime?: number
}

export class CommandWhitelist {
  private config: WhitelistConfig
  private allowedMethodsSet: Set<string>
  private blockedMethodsSet: Set<string>
  private allowedToolsSet: Set<string>
  private blockedToolsSet: Set<string>

  constructor(config: WhitelistConfig) {
    this.config = config
    
    // Pre-compute sets for performance
    this.allowedMethodsSet = new Set(config.allowedCDPMethods || [])
    this.blockedMethodsSet = new Set(config.blockedCDPMethods || [])
    this.allowedToolsSet = new Set(config.allowedTools || [])
    this.blockedToolsSet = new Set(config.blockedTools || [])

    // Default dangerous CDP methods to block
    if (this.config.enabled && this.blockedMethodsSet.size === 0) {
      this.addDefaultBlockedMethods()
    }
  }

  /**
   * Add default dangerous methods
   */
  private addDefaultBlockedMethods() {
    const dangerous = [
      // File system access
      'FileSystem.requestFileContent',
      'FileSystem.deleteEntry',
      'FileSystem.requestDirectoryContent',
      
      // Process/OS access
      'SystemInfo.getProcessInfo',
      
      // Browser automation that could be abused
      'Browser.setDownloadBehavior',
      'Browser.grantPermissions',
      
      // Potential data exfiltration
      'Network.setRequestInterception',
      'Fetch.enable',
      
      // Debugging protocol manipulation
      'Target.setAutoAttach',
      'Target.exposeDevToolsProtocol',
    ]

    dangerous.forEach(method => this.blockedMethodsSet.add(method))
  }

  /**
   * Check if CDP method is allowed
   */
  isCDPMethodAllowed(method: string): boolean {
    if (!this.config.enabled) {
      return true
    }

    // Check blocked list first
    if (this.blockedMethodsSet.has(method)) {
      logger.warn({ method }, 'Blocked CDP method')
      return false
    }

    // If allowed list is empty, allow all non-blocked
    if (this.allowedMethodsSet.size === 0) {
      return true
    }

    // Check allowed list
    if (this.allowedMethodsSet.has(method)) {
      return true
    }

    // Check domain-level allowlist
    if (this.config.allowedCDPDomains) {
      const domain = method.split('.')[0]
      if (this.config.allowedCDPDomains.includes(domain)) {
        return true
      }
    }

    logger.warn({ method }, 'CDP method not in allowlist')
    return false
  }

  /**
   * Check if tool is allowed
   */
  isToolAllowed(toolName: string): boolean {
    if (!this.config.enabled) {
      return true
    }

    // Check blocked list first
    if (this.blockedToolsSet.has(toolName)) {
      logger.warn({ toolName }, 'Blocked tool')
      return false
    }

    // If allowed list is empty, allow all non-blocked
    if (this.allowedToolsSet.size === 0) {
      return true
    }

    // Check allowed list
    if (this.allowedToolsSet.has(toolName)) {
      return true
    }

    // Check category-level allowlist
    const category = toolName.split('/')[0]
    if (this.allowedToolsSet.has(`${category}/*`)) {
      return true
    }

    logger.warn({ toolName }, 'Tool not in allowlist')
    return false
  }

  /**
   * Check if resource URI is allowed
   */
  isResourceAllowed(uri: string): boolean {
    if (!this.config.enabled) {
      return true
    }

    if (!this.config.allowedResourcePatterns || this.config.allowedResourcePatterns.length === 0) {
      return true
    }

    // Check patterns
    for (const pattern of this.config.allowedResourcePatterns) {
      const regex = new RegExp(pattern)
      if (regex.test(uri)) {
        return true
      }
    }

    logger.warn({ uri }, 'Resource URI not allowed')
    return false
  }

  /**
   * Sanitize CDP parameters
   */
  sanitizeCDPParams(method: string, params: any): any {
    if (!this.config.enabled) {
      return params
    }

    // Remove potentially dangerous parameters
    const sanitized = { ...params }

    // Runtime.evaluate - prevent arbitrary code execution
    if (method === 'Runtime.evaluate' && sanitized.expression) {
      // Check for dangerous patterns
      const dangerous = [
        /require\s*\(/,
        /import\s*\(/,
        /eval\s*\(/,
        /Function\s*\(/,
        /\.constructor\s*\(/,
        /process\./,
        /child_process/,
        /fs\./,
        /__dirname/,
        /__filename/,
      ]

      for (const pattern of dangerous) {
        if (pattern.test(sanitized.expression)) {
          logger.warn({ expression: sanitized.expression }, 'Dangerous expression blocked')
          throw new Error('Expression contains blocked patterns')
        }
      }
    }

    // Network.setExtraHTTPHeaders - prevent header injection
    if (method === 'Network.setExtraHTTPHeaders' && sanitized.headers) {
      const blocked = ['Authorization', 'Cookie', 'X-Forwarded-For']
      for (const header of blocked) {
        delete sanitized.headers[header]
      }
    }

    return sanitized
  }

  /**
   * Get safe defaults for production
   */
  static getProductionDefaults(): WhitelistConfig {
    return {
      enabled: true,
      allowedCDPDomains: [
        'Runtime',
        'DOM',
        'Page',
        'Network',
        'Performance',
        'Console',
      ],
      blockedCDPMethods: [
        'Runtime.terminateExecution',
        'Page.captureScreenshot',
        'Page.printToPDF',
        'Network.setCookie',
        'Network.deleteCookies',
        'Network.clearBrowserCookies',
      ],
      allowedTools: [
        'dom/querySelector',
        'dom/getAttribute',
        'dom/highlight',
        'runtime/evaluate',
        'runtime/getGlobal',
        'runtime/consoleLog',
        'performance/captureMetrics',
        'performance/analyzeLongTasks',
      ],
      blockedTools: [
        'network/setCookie',
        'network/deleteCookies',
        'network/clearData',
        'runtime/setGlobal',
      ],
      allowedResourcePatterns: [
        '^browser://',
        '^react://',
        '^xstate://',
        '^zustand://',
        '^network://requests$',
        '^network://performance$',
      ],
      maxExecutionTime: 5000, // 5 seconds
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      enabled: this.config.enabled,
      allowedMethods: this.allowedMethodsSet.size,
      blockedMethods: this.blockedMethodsSet.size,
      allowedTools: this.allowedToolsSet.size,
      blockedTools: this.blockedToolsSet.size,
      resourcePatterns: this.config.allowedResourcePatterns?.length || 0,
    }
  }
}