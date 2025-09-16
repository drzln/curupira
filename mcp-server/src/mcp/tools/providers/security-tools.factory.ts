/**
 * Security Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Security analysis and safety tools
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand } from '../patterns/common-handlers.js';

// Schema definitions
const scanSecuritySchema: Schema<{ 
  checks?: string[]; 
  deep?: boolean;
  sessionId?: string 
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    const defaultChecks = ['xss', 'csp', 'cookies', 'https', 'headers'];
    return {
      checks: Array.isArray(obj.checks) ? obj.checks : defaultChecks,
      deep: obj.deep === true,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: scanSecuritySchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const sanitizeDataSchema: Schema<{ 
  data: string; 
  type?: string;
  sessionId?: string 
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.data !== 'string') {
      throw new Error('data must be a string');
    }
    return {
      data: obj.data,
      type: obj.type || 'auto',
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: sanitizeDataSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class SecurityToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register security_scan tool
    this.registerTool(
      this.createTool(
        'security_scan',
        'Perform security analysis of the current page',
        scanSecuritySchema,
        async (args, context) => {
          const securityScript = `
            (function() {
              const results = {
                checks: ${JSON.stringify(args.checks)},
                deep: ${args.deep},
                issues: [],
                warnings: [],
                info: [],
                score: 100
              };
              
              // XSS vulnerability checks
              if (results.checks.includes('xss')) {
                const inputs = document.querySelectorAll('input[type="text"], textarea');
                inputs.forEach((input, i) => {
                  if (!input.hasAttribute('maxlength')) {
                    results.warnings.push({
                      type: 'xss',
                      severity: 'medium',
                      message: \`Input field \${i + 1} lacks maxlength attribute\`,
                      element: input.tagName + (input.id ? '#' + input.id : '')
                    });
                    results.score -= 5;
                  }
                });
                
                // Check for inline event handlers
                const elementsWithEvents = document.querySelectorAll('[onclick], [onload], [onerror]');
                if (elementsWithEvents.length > 0) {
                  results.issues.push({
                    type: 'xss',
                    severity: 'high',
                    message: \`Found \${elementsWithEvents.length} elements with inline event handlers\`,
                    count: elementsWithEvents.length
                  });
                  results.score -= 15;
                }
              }
              
              // Content Security Policy checks
              if (results.checks.includes('csp')) {
                const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
                const cspHeader = document.querySelector('meta[property="csp-header"]'); // Simulated
                
                if (!cspMeta && !cspHeader) {
                  results.issues.push({
                    type: 'csp',
                    severity: 'high',
                    message: 'No Content Security Policy found',
                    recommendation: 'Implement CSP headers to prevent XSS attacks'
                  });
                  results.score -= 20;
                } else {
                  results.info.push({
                    type: 'csp',
                    message: 'Content Security Policy detected',
                    content: cspMeta?.getAttribute('content') || 'Header-based CSP'
                  });
                }
              }
              
              // Cookie security checks
              if (results.checks.includes('cookies')) {
                const cookieString = document.cookie;
                if (cookieString) {
                  const cookies = cookieString.split(';').map(c => c.trim());
                  const insecureCookies = cookies.filter(cookie => 
                    !cookie.toLowerCase().includes('secure') ||
                    !cookie.toLowerCase().includes('httponly')
                  );
                  
                  if (insecureCookies.length > 0) {
                    results.warnings.push({
                      type: 'cookies',
                      severity: 'medium',
                      message: \`\${insecureCookies.length} cookies may lack security flags\`,
                      recommendation: 'Use Secure and HttpOnly flags for sensitive cookies'
                    });
                    results.score -= 10;
                  }
                  
                  results.info.push({
                    type: 'cookies',
                    message: \`Found \${cookies.length} cookies\`,
                    count: cookies.length
                  });
                }
              }
              
              // HTTPS checks
              if (results.checks.includes('https')) {
                if (window.location.protocol !== 'https:') {
                  results.issues.push({
                    type: 'https',
                    severity: 'high',
                    message: 'Page served over insecure HTTP',
                    current: window.location.protocol,
                    recommendation: 'Use HTTPS to encrypt data in transit'
                  });
                  results.score -= 25;
                } else {
                  results.info.push({
                    type: 'https',
                    message: 'Page served over secure HTTPS'
                  });
                }
                
                // Check for mixed content
                const httpResources = Array.from(document.querySelectorAll('img, script, link')).filter(el => {
                  const src = el.src || el.href;
                  return src && src.startsWith('http:');
                });
                
                if (httpResources.length > 0) {
                  results.warnings.push({
                    type: 'https',
                    severity: 'medium',
                    message: \`\${httpResources.length} resources loaded over HTTP\`,
                    count: httpResources.length,
                    recommendation: 'Ensure all resources use HTTPS'
                  });
                  results.score -= 10;
                }
              }
              
              // Security headers checks (simulated)
              if (results.checks.includes('headers')) {
                // These would normally be checked server-side
                const expectedHeaders = [
                  'X-Content-Type-Options',
                  'X-Frame-Options',
                  'X-XSS-Protection',
                  'Strict-Transport-Security'
                ];
                
                results.info.push({
                  type: 'headers',
                  message: 'Security headers should be checked server-side',
                  expectedHeaders: expectedHeaders
                });
              }
              
              // Deep scan additional checks
              if (results.deep) {
                // Check for potential data exposure
                const sensitivePatterns = [
                  /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/g, // emails
                  /\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b/g, // credit cards
                  /\\b\\d{3}[\\s-]?\\d{2}[\\s-]?\\d{4}\\b/g // SSN pattern
                ];
                
                const pageText = document.body.innerText;
                sensitivePatterns.forEach((pattern, i) => {
                  const matches = pageText.match(pattern);
                  if (matches && matches.length > 0) {
                    results.warnings.push({
                      type: 'data_exposure',
                      severity: 'medium',
                      message: \`Potential sensitive data pattern \${i + 1} found\`,
                      count: matches.length,
                      recommendation: 'Review if sensitive data should be displayed'
                    });
                    results.score -= 5;
                  }
                });
                
                // Check for debug/development artifacts
                const debugSelectors = [
                  '[data-debug]',
                  '.debug',
                  '#debug',
                  '[data-test]',
                  '.test-id'
                ];
                
                debugSelectors.forEach(selector => {
                  const elements = document.querySelectorAll(selector);
                  if (elements.length > 0) {
                    results.warnings.push({
                      type: 'debug_artifacts',
                      severity: 'low',
                      message: \`Found \${elements.length} debug/test elements with selector: \${selector}\`,
                      recommendation: 'Remove debug artifacts from production'
                    });
                    results.score -= 2;
                  }
                });
              }
              
              // Calculate final score
              results.score = Math.max(0, Math.min(100, results.score));
              results.grade = results.score >= 90 ? 'A' : 
                           results.score >= 80 ? 'B' : 
                           results.score >= 70 ? 'C' : 
                           results.score >= 60 ? 'D' : 'F';
              
              results.summary = {
                issues: results.issues.length,
                warnings: results.warnings.length,
                score: results.score,
                grade: results.grade
              };
              
              return results;
            })()
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: securityScript,
              returnByValue: true,
              generatePreview: false
            },
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const unwrapped = result.unwrap() as any;
          return {
            success: true,
            data: {
              ...unwrapped.result?.value,
              url: await this.getCurrentUrl(context),
              timestamp: new Date().toISOString()
            }
          };
        }
      )
    );

    // Register sanitize_data tool
    this.registerTool(
      this.createTool(
        'sanitize_data',
        'Sanitize data to prevent security issues',
        sanitizeDataSchema,
        async (args, context) => {
          const sanitizeScript = `
            (function() {
              const data = ${JSON.stringify(args.data)};
              const type = '${args.type}';
              
              const sanitizers = {
                html: (input) => {
                  const div = document.createElement('div');
                  div.textContent = input;
                  return div.innerHTML;
                },
                
                sql: (input) => {
                  return input.replace(/['";\\\\]/g, '\\\\$&');
                },
                
                xss: (input) => {
                  return input
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .replace(/\\//g, '&#x2F;');
                },
                
                auto: (input) => {
                  // Auto-detect and apply appropriate sanitization
                  let result = input;
                  
                  // Basic HTML escaping
                  result = result
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
                  
                  return result;
                }
              };
              
              const sanitizer = sanitizers[type] || sanitizers.auto;
              const sanitized = sanitizer(data);
              
              return {
                original: data,
                sanitized: sanitized,
                type: type,
                changed: data !== sanitized,
                length: {
                  original: data.length,
                  sanitized: sanitized.length
                }
              };
            })()
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: sanitizeScript,
              returnByValue: true
            },
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const unwrapped = result.unwrap() as any;
          return {
            success: true,
            data: {
              ...unwrapped.result?.value,
              timestamp: new Date().toISOString()
            }
          };
        }
      )
    );

    // Register check_permissions tool
    this.registerTool({
      name: 'check_permissions',
      description: 'Check browser permissions and security settings',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            return { success: true, data: { sessionId: (value as any)?.sessionId } };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const permissionsScript = `
          (function() {
            const permissions = {};
            const checks = [];
            
            // Check if Permissions API is available
            if ('permissions' in navigator) {
              checks.push('Permissions API available');
              permissions.api = 'available';
            } else {
              checks.push('Permissions API not available');
              permissions.api = 'unavailable';
            }
            
            // Check geolocation
            if ('geolocation' in navigator) {
              permissions.geolocation = 'available';
            } else {
              permissions.geolocation = 'unavailable';
            }
            
            // Check notifications
            if ('Notification' in window) {
              permissions.notifications = {
                available: true,
                permission: Notification.permission
              };
            } else {
              permissions.notifications = { available: false };
            }
            
            // Check camera/microphone (getUserMedia)
            if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
              permissions.media = 'available';
            } else {
              permissions.media = 'unavailable';
            }
            
            // Check clipboard
            if ('clipboard' in navigator) {
              permissions.clipboard = 'available';
            } else {
              permissions.clipboard = 'unavailable';
            }
            
            // Check service workers
            if ('serviceWorker' in navigator) {
              permissions.serviceWorker = 'available';
            } else {
              permissions.serviceWorker = 'unavailable';
            }
            
            // Check local storage
            try {
              localStorage.setItem('test', 'test');
              localStorage.removeItem('test');
              permissions.localStorage = 'available';
            } catch (e) {
              permissions.localStorage = 'blocked';
            }
            
            // Check session storage
            try {
              sessionStorage.setItem('test', 'test');
              sessionStorage.removeItem('test');
              permissions.sessionStorage = 'available';
            } catch (e) {
              permissions.sessionStorage = 'blocked';
            }
            
            // Check cookies
            permissions.cookies = navigator.cookieEnabled ? 'enabled' : 'disabled';
            
            return {
              permissions,
              checks,
              url: window.location.href,
              userAgent: navigator.userAgent,
              secure: window.location.protocol === 'https:'
            };
          })()
        `;

        const result = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: permissionsScript,
            returnByValue: true
          },
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const unwrapped = result.unwrap() as any;
        return {
          success: true,
          data: {
            ...unwrapped.result?.value,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register validate_csp tool
    this.registerTool({
      name: 'validate_csp',
      description: 'Validate Content Security Policy configuration',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            policy: obj.policy || null,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return {
              success: true,
              data: {
                policy: obj.policy || null,
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const cspScript = `
          (function() {
            const policy = ${JSON.stringify(args.policy)};
            const result = {
              current: null,
              provided: policy,
              analysis: {
                strengths: [],
                weaknesses: [],
                recommendations: []
              },
              score: 0
            };
            
            // Get current CSP
            const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            if (cspMeta) {
              result.current = cspMeta.getAttribute('content');
            }
            
            const analyzedPolicy = policy || result.current;
            
            if (!analyzedPolicy) {
              result.analysis.weaknesses.push('No Content Security Policy found');
              result.analysis.recommendations.push('Implement a Content Security Policy');
              return result;
            }
            
            const directives = analyzedPolicy.split(';').map(d => d.trim()).filter(d => d);
            
            // Check for important directives
            const importantDirectives = [
              'default-src',
              'script-src',
              'style-src',
              'img-src',
              'connect-src',
              'font-src',
              'object-src',
              'media-src',
              'frame-src'
            ];
            
            let score = 0;
            
            importantDirectives.forEach(directive => {
              const hasDirective = directives.some(d => d.startsWith(directive));
              if (hasDirective) {
                result.analysis.strengths.push(\`\${directive} directive configured\`);
                score += 10;
              } else {
                result.analysis.weaknesses.push(\`Missing \${directive} directive\`);
              }
            });
            
            // Check for unsafe directives
            const unsafePatterns = ['unsafe-inline', 'unsafe-eval', '*'];
            directives.forEach(directive => {
              unsafePatterns.forEach(pattern => {
                if (directive.includes(pattern)) {
                  result.analysis.weaknesses.push(\`Unsafe directive: \${directive}\`);
                  score -= 15;
                }
              });
            });
            
            // Check for nonce/hash usage
            if (analyzedPolicy.includes('nonce-') || analyzedPolicy.includes('sha256-')) {
              result.analysis.strengths.push('Uses nonce or hash for script security');
              score += 15;
            }
            
            result.score = Math.max(0, Math.min(100, score));
            
            return result;
          })()
        `;

        const result = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: cspScript,
            returnByValue: true
          },
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const unwrapped = result.unwrap() as any;
        return {
          success: true,
          data: {
            ...unwrapped.result?.value,
            timestamp: new Date().toISOString()
          }
        };
      }
    });
  }

  private async getCurrentUrl(context: any): Promise<string> {
    const result = await withCDPCommand(
      'Runtime.evaluate',
      { expression: 'window.location.href', returnByValue: true },
      context
    );
    
    if (result.isOk()) {
      const unwrapped = result.unwrap() as any;
      return unwrapped.result?.value || 'unknown';
    }
    return 'unknown';
  }
}

export class SecurityToolProviderFactory extends BaseProviderFactory<SecurityToolProvider> {
  create(deps: ProviderDependencies): SecurityToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'security',
      description: 'Security analysis and data protection tools'
    };

    return new SecurityToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}