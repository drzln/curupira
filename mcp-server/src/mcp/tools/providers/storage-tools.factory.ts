/**
 * Storage Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Browser storage management tools
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand } from '../patterns/common-handlers.js';

// Schema definitions
const storageOperationSchema: Schema<{ 
  type: string; 
  key?: string; 
  value?: string;
  sessionId?: string 
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.type !== 'string') {
      throw new Error('type must be a string');
    }
    return {
      type: obj.type,
      key: obj.key,
      value: obj.value,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: storageOperationSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Specific schema for set operations
const setStorageSchema: Schema<{
  key: string;
  value: string;
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.key !== 'string') {
      throw new Error('key must be a string');
    }
    if (typeof obj.value !== 'string') {
      throw new Error('value must be a string');
    }
    return {
      key: obj.key,
      value: obj.value,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: setStorageSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const clearStorageSchema: Schema<{ 
  types?: string[];
  confirm?: boolean;
  sessionId?: string 
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    const defaultTypes = ['localStorage', 'sessionStorage', 'cookies', 'indexedDB', 'webSQL', 'cache'];
    return {
      types: Array.isArray(obj.types) ? obj.types : defaultTypes,
      confirm: obj.confirm === true,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: clearStorageSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class StorageToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register get_local_storage tool
    this.registerTool({
      name: 'get_local_storage',
      description: 'Get all localStorage data or specific key',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            key: obj.key || null,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return {
              success: true,
              data: {
                key: obj.key || null,
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const script = args.key 
          ? `localStorage.getItem('${args.key}')`
          : `JSON.stringify(Object.fromEntries(Object.entries(localStorage)))`;

        const result = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: script,
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
        const value = unwrapped.result?.value;
        
        return {
          success: true,
          data: {
            key: args.key,
            value: args.key ? value : JSON.parse(value || '{}'),
            count: args.key ? (value ? 1 : 0) : Object.keys(JSON.parse(value || '{}')).length,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register set_local_storage tool
    this.registerTool(
      this.createTool(
        'set_local_storage',
        'Set localStorage item',
        setStorageSchema,
        async (args, context) => {
          if (!args.key || args.value === undefined) {
            return {
              success: false,
              error: 'key and value are required for set operation'
            };
          }

          const script = `
            try {
              localStorage.setItem('${args.key}', ${JSON.stringify(args.value)});
              'success';
            } catch (e) {
              e.message;
            }
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: script,
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
          const outcome = unwrapped.result?.value;
          
          return {
            success: outcome === 'success',
            data: outcome === 'success' ? {
              key: args.key,
              value: args.value,
              set: true,
              timestamp: new Date().toISOString()
            } : null,
            error: outcome !== 'success' ? outcome : undefined
          };
        }
      )
    );

    // Register get_session_storage tool
    this.registerTool({
      name: 'get_session_storage',
      description: 'Get all sessionStorage data or specific key',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            key: obj.key || null,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return {
              success: true,
              data: {
                key: obj.key || null,
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const script = args.key 
          ? `sessionStorage.getItem('${args.key}')`
          : `JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))`;

        const result = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: script,
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
        const value = unwrapped.result?.value;
        
        return {
          success: true,
          data: {
            key: args.key,
            value: args.key ? value : JSON.parse(value || '{}'),
            count: args.key ? (value ? 1 : 0) : Object.keys(JSON.parse(value || '{}')).length,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register get_cookies tool
    this.registerTool({
      name: 'get_cookies',
      description: 'Get all cookies or filter by domain/name',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            domain: obj.domain || null,
            name: obj.name || null,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return {
              success: true,
              data: {
                domain: obj.domain || null,
                name: obj.name || null,
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        // Use CDP to get cookies
        const result = await withCDPCommand(
          'Network.getCookies',
          args.domain ? { urls: [args.domain] } : {},
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        let cookies = (result.unwrap() as any).cookies || [];
        
        // Filter by name if specified
        if (args.name) {
          cookies = cookies.filter((cookie: any) => cookie.name === args.name);
        }

        return {
          success: true,
          data: {
            cookies: cookies.map((cookie: any) => ({
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path,
              expires: cookie.expires,
              httpOnly: cookie.httpOnly,
              secure: cookie.secure,
              sameSite: cookie.sameSite
            })),
            count: cookies.length,
            filters: {
              domain: args.domain,
              name: args.name
            },
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register set_cookie tool
    this.registerTool({
      name: 'set_cookie',
      description: 'Set a cookie',
      argsSchema: {
        parse: (value) => {
          if (typeof value !== 'object' || value === null) {
            throw new Error('Expected object');
          }
          const obj = value as any;
          if (typeof obj.name !== 'string' || typeof obj.value !== 'string') {
            throw new Error('name and value must be strings');
          }
          return {
            name: obj.name,
            value: obj.value,
            domain: obj.domain || '',
            path: obj.path || '/',
            expires: obj.expires || null,
            httpOnly: obj.httpOnly === true,
            secure: obj.secure === true,
            sameSite: obj.sameSite || 'Lax',
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            if (typeof value !== 'object' || value === null) {
              throw new Error('Expected object');
            }
            const obj = value as any;
            if (typeof obj.name !== 'string' || typeof obj.value !== 'string') {
              throw new Error('name and value must be strings');
            }
            return {
              success: true,
              data: {
                name: obj.name,
                value: obj.value,
                domain: obj.domain,
                path: obj.path || '/',
                expires: obj.expires || null,
                httpOnly: obj.httpOnly === true,
                secure: obj.secure === true,
                sameSite: obj.sameSite || 'Lax',
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const cookieParams: any = {
          name: args.name,
          value: args.value,
          domain: args.domain,
          path: args.path,
          httpOnly: args.httpOnly,
          secure: args.secure,
          sameSite: args.sameSite
        };

        if (args.expires) {
          cookieParams.expires = new Date(args.expires).getTime() / 1000;
        }

        const result = await withCDPCommand(
          'Network.setCookie',
          cookieParams,
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const setCookieResult = result.unwrap() as any;
        
        return {
          success: setCookieResult.success,
          data: setCookieResult.success ? {
            name: args.name,
            value: args.value,
            domain: args.domain,
            path: args.path,
            set: true,
            timestamp: new Date().toISOString()
          } : null,
          error: !setCookieResult.success ? 'Failed to set cookie' : undefined
        };
      }
    });

    // Register get_indexeddb_info tool
    this.registerTool({
      name: 'get_indexeddb_info',
      description: 'Get IndexedDB database information',
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
        const script = `
          (function() {
            return new Promise((resolve) => {
              if (!window.indexedDB) {
                resolve({ available: false, error: 'IndexedDB not supported' });
                return;
              }
              
              // This is a simplified check - real implementation would be more complex
              const databases = [];
              
              try {
                // Modern browsers have indexedDB.databases()
                if (indexedDB.databases) {
                  indexedDB.databases().then(dbs => {
                    resolve({
                      available: true,
                      databases: dbs.map(db => ({
                        name: db.name,
                        version: db.version
                      })),
                      count: dbs.length
                    });
                  }).catch(error => {
                    resolve({
                      available: true,
                      databases: [],
                      error: error.message,
                      count: 0
                    });
                  });
                } else {
                  resolve({
                    available: true,
                    databases: [],
                    note: 'indexedDB.databases() not available - cannot enumerate databases',
                    count: 0
                  });
                }
              } catch (error) {
                resolve({
                  available: true,
                  error: error.message,
                  databases: [],
                  count: 0
                });
              }
            });
          })()
        `;

        const result = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: script,
            awaitPromise: true,
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

        return {
          success: true,
          data: {
            ...(result.unwrap() as any).result?.value,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register get_storage_usage tool
    this.registerTool({
      name: 'get_storage_usage',
      description: 'Get storage quota and usage information',
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
        const script = `
          (function() {
            return new Promise(async (resolve) => {
              const usage = {
                available: false,
                quota: null,
                usage: null,
                storageTypes: {}
              };
              
              try {
                if ('storage' in navigator && 'estimate' in navigator.storage) {
                  const estimate = await navigator.storage.estimate();
                  usage.available = true;
                  usage.quota = estimate.quota;
                  usage.usage = estimate.usage;
                  usage.usageDetails = estimate.usageDetails || {};
                  usage.percentUsed = estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(2) : 0;
                }
                
                // Check individual storage types
                try {
                  const localStorageSize = JSON.stringify(localStorage).length;
                  usage.storageTypes.localStorage = {
                    size: localStorageSize,
                    count: localStorage.length
                  };
                } catch (e) {
                  usage.storageTypes.localStorage = { error: e.message };
                }
                
                try {
                  const sessionStorageSize = JSON.stringify(sessionStorage).length;
                  usage.storageTypes.sessionStorage = {
                    size: sessionStorageSize,
                    count: sessionStorage.length
                  };
                } catch (e) {
                  usage.storageTypes.sessionStorage = { error: e.message };
                }
                
                // Check cookies size (approximate)
                try {
                  const cookiesSize = document.cookie.length;
                  usage.storageTypes.cookies = {
                    size: cookiesSize,
                    count: document.cookie.split(';').filter(c => c.trim()).length
                  };
                } catch (e) {
                  usage.storageTypes.cookies = { error: e.message };
                }
                
                resolve(usage);
              } catch (error) {
                resolve({
                  available: false,
                  error: error.message,
                  storageTypes: usage.storageTypes
                });
              }
            });
          })()
        `;

        const result = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: script,
            awaitPromise: true,
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

        return {
          success: true,
          data: {
            ...(result.unwrap() as any).result?.value,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register clear_storage tool
    this.registerTool(
      this.createTool(
        'clear_storage',
        'Clear specified storage types',
        clearStorageSchema,
        async (args, context) => {
          if (!args.confirm) {
            return {
              success: false,
              error: 'This operation requires confirmation. Set confirm: true to proceed.'
            };
          }

          const results: any = {
            cleared: [],
            failed: [],
            types: args.types
          };

          for (const type of args.types || []) {
            try {
              switch (type) {
                case 'localStorage':
                  await withCDPCommand(
                    'Runtime.evaluate',
                    { expression: 'localStorage.clear()' },
                    context
                  );
                  results.cleared.push('localStorage');
                  break;

                case 'sessionStorage':
                  await withCDPCommand(
                    'Runtime.evaluate',
                    { expression: 'sessionStorage.clear()' },
                    context
                  );
                  results.cleared.push('sessionStorage');
                  break;

                case 'cookies':
                  const cookiesResult = await withCDPCommand(
                    'Network.clearBrowserCookies',
                    {},
                    context
                  );
                  if (cookiesResult.isOk()) {
                    results.cleared.push('cookies');
                  } else {
                    results.failed.push({ type: 'cookies', error: cookiesResult.unwrapErr() });
                  }
                  break;

                case 'cache':
                  const cacheResult = await withCDPCommand(
                    'Network.clearBrowserCache',
                    {},
                    context
                  );
                  if (cacheResult.isOk()) {
                    results.cleared.push('cache');
                  } else {
                    results.failed.push({ type: 'cache', error: cacheResult.unwrapErr() });
                  }
                  break;

                case 'indexedDB':
                  // IndexedDB clearing is complex - this is a simplified approach
                  await withCDPCommand(
                    'Runtime.evaluate',
                    {
                      expression: `
                        (async function() {
                          if (indexedDB.databases) {
                            const dbs = await indexedDB.databases();
                            for (const db of dbs) {
                              indexedDB.deleteDatabase(db.name);
                            }
                          }
                        })()
                      `,
                      awaitPromise: true
                    },
                    context
                  );
                  results.cleared.push('indexedDB');
                  break;

                default:
                  results.failed.push({ type, error: 'Unsupported storage type' });
              }
            } catch (error) {
              results.failed.push({ type, error: error instanceof Error ? error.message : String(error) });
            }
          }

          return {
            success: results.failed.length === 0,
            data: {
              ...results,
              clearedCount: results.cleared.length,
              failedCount: results.failed.length,
              timestamp: new Date().toISOString()
            }
          };
        }
      )
    );
  }
}

export class StorageToolProviderFactory extends BaseProviderFactory<StorageToolProvider> {
  create(deps: ProviderDependencies): StorageToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'storage',
      description: 'Browser storage management and analysis tools'
    };

    return new StorageToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}