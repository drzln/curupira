/**
 * Zustand Store Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Zustand state management debugging tools
 * Tailored for NovaSkyn's Zustand 5.0.x architecture
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for Zustand tools
const zustandDetectionSchema: Schema<{ sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const zustandStoreInspectSchema: Schema<{ 
  storeId?: string; 
  includeActions?: boolean; 
  includeComputed?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      storeId: obj.storeId,
      includeActions: typeof obj.includeActions === 'boolean' ? obj.includeActions : true,
      includeComputed: typeof obj.includeComputed === 'boolean' ? obj.includeComputed : false,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const zustandSubscriptionTrackSchema: Schema<{ 
  storeId?: string; 
  trackSelectors?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      storeId: obj.storeId,
      trackSelectors: typeof obj.trackSelectors === 'boolean' ? obj.trackSelectors : false,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const zustandActionDispatchSchema: Schema<{ 
  storeId: string; 
  actionName: string; 
  payload?: any;
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.storeId !== 'string') {
      throw new Error('storeId must be a string');
    }
    if (typeof obj.actionName !== 'string') {
      throw new Error('actionName must be a string');
    }
    return {
      storeId: obj.storeId,
      actionName: obj.actionName,
      payload: obj.payload,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class ZustandToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register zustand_detect tool
    this.registerTool(
      this.createTool(
        'zustand_detect',
        'Detect Zustand stores and get store information',
        zustandDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const zustandInfo = {
                stores: [],
                devtools: false,
                version: null,
                totalStores: 0
              };
              
              // Check for Zustand DevTools
              if (window.__ZUSTAND_DEVTOOLS__) {
                zustandInfo.devtools = true;
              }
              
              // Method 1: Check for Zustand in global scope
              if (window.zustand) {
                zustandInfo.version = window.zustand.version || 'unknown';
              }
              
              // Method 2: Look for Zustand stores in window
              const possibleStoreNames = [
                'useStore', 'store', 'appStore', 'userStore', 'authStore',
                'cartStore', 'settingsStore', 'uiStore', 'dataStore'
              ];
              
              possibleStoreNames.forEach(name => {
                if (window[name] && typeof window[name] === 'function') {
                  try {
                    // Test if it's a Zustand store by calling it
                    const state = window[name]();
                    if (state && typeof state === 'object') {
                      zustandInfo.stores.push({
                        name,
                        id: name,
                        state: Object.keys(state),
                        stateSize: Object.keys(state).length,
                        source: 'global-function'
                      });
                    }
                  } catch (error) {
                    // Not a Zustand store
                  }
                }
              });
              
              // Method 3: Look for React components using Zustand
              if (window.React && zustandInfo.stores.length === 0) {
                try {
                  // Check for React DevTools to find Zustand usage
                  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                    zustandInfo.reactDevtoolsDetected = true;
                    // In a real implementation, we'd traverse the React tree
                    // to find components using Zustand stores
                  }
                } catch (error) {
                  zustandInfo.reactError = error.message;
                }
              }
              
              // Method 4: Check for module bundler globals (Webpack, Vite)
              if (window.__webpack_require__ || window.__vite_global__ || window.require) {
                try {
                  // Look for Zustand in module cache
                  zustandInfo.bundlerDetected = true;
                } catch (error) {
                  // Module inspection failed
                }
              }
              
              // Method 5: Look for common Zustand patterns in localStorage/sessionStorage
              try {
                const storageKeys = Object.keys(localStorage);
                const zustandKeys = storageKeys.filter(key => 
                  key.includes('zustand') || 
                  key.includes('store') ||
                  key.includes('persist')
                );
                
                if (zustandKeys.length > 0) {
                  zustandInfo.persistedStores = zustandKeys.map(key => {
                    try {
                      const data = JSON.parse(localStorage.getItem(key) || '{}');
                      return {
                        key,
                        data: Object.keys(data),
                        size: JSON.stringify(data).length
                      };
                    } catch {
                      return { key, error: 'Invalid JSON' };
                    }
                  });
                }
              } catch (error) {
                zustandInfo.storageError = error.message;
              }
              
              zustandInfo.totalStores = zustandInfo.stores.length;
              
              return {
                ...zustandInfo,
                timestamp: new Date().toISOString(),
                recommendation: zustandInfo.stores.length === 0 ? 
                  'No Zustand stores detected. Try accessing stores through React components or check if stores are globally accessible.' :
                  \`Found \${zustandInfo.stores.length} potential Zustand store(s)\`
              };
            })()
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: detectionScript,
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
            data: unwrapped.result?.value || { stores: [], devtools: false }
          };
        },
        {
          type: 'object',
          properties: {
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register zustand_store_inspect tool
    this.registerTool(
      this.createTool(
        'zustand_store_inspect',
        'Inspect Zustand store state and available actions',
        zustandStoreInspectSchema,
        async (args, context) => {
          const storeInspectionScript = `
            (function() {
              const storeInfo = {
                found: false,
                state: null,
                actions: [],
                metadata: {}
              };
              
              const storeId = '${args.storeId || ''}';
              const includeActions = ${args.includeActions !== false};
              const includeComputed = ${args.includeComputed === true};
              
              // Try to find the store
              let store = null;
              let storeName = storeId;
              
              if (storeId) {
                // Look for specific store by ID
                store = window[storeId];
                if (!store && window.stores && window.stores[storeId]) {
                  store = window.stores[storeId];
                }
              } else {
                // Find first available Zustand store
                const possibleStores = [
                  'useStore', 'store', 'appStore', 'userStore', 'authStore'
                ];
                
                for (const name of possibleStores) {
                  if (window[name] && typeof window[name] === 'function') {
                    try {
                      const testState = window[name]();
                      if (testState && typeof testState === 'object') {
                        store = window[name];
                        storeName = name;
                        break;
                      }
                    } catch (error) {
                      // Continue looking
                    }
                  }
                }
              }
              
              if (!store || typeof store !== 'function') {
                return { 
                  error: \`Store \${storeId || 'default'} not found or not accessible\`,
                  suggestions: [
                    'Ensure the store is globally accessible',
                    'Try using the store name as it appears in window object',
                    'Check if the store is properly initialized'
                  ]
                };
              }
              
              try {
                // Get current state
                const state = store();
                storeInfo.found = true;
                storeInfo.state = state;
                
                // Analyze state structure
                const stateKeys = Object.keys(state);
                const actions = [];
                const values = [];
                const computed = [];
                
                stateKeys.forEach(key => {
                  const value = state[key];
                  if (typeof value === 'function') {
                    actions.push({
                      name: key,
                      type: 'function',
                      parameters: value.length
                    });
                  } else if (typeof value === 'object' && value !== null) {
                    values.push({
                      name: key,
                      type: 'object',
                      keys: Object.keys(value),
                      size: Object.keys(value).length
                    });
                  } else {
                    values.push({
                      name: key,
                      type: typeof value,
                      value: value
                    });
                  }
                });
                
                if (includeActions) {
                  storeInfo.actions = actions;
                }
                
                storeInfo.values = values;
                
                // Get store metadata
                storeInfo.metadata = {
                  storeName,
                  totalKeys: stateKeys.length,
                  actionCount: actions.length,
                  valueCount: values.length,
                  stateSize: JSON.stringify(state).length
                };
                
                // Check for store persistence
                if (state.persist || state._persist) {
                  storeInfo.metadata.persistent = true;
                  storeInfo.metadata.persistKey = state.persist?.key || state._persist?.key;
                }
                
                // Check for middleware
                if (store.getState && typeof store.getState === 'function') {
                  storeInfo.metadata.hasGetState = true;
                }
                
                if (store.setState && typeof store.setState === 'function') {
                  storeInfo.metadata.hasSetState = true;
                }
                
                if (store.subscribe && typeof store.subscribe === 'function') {
                  storeInfo.metadata.hasSubscribe = true;
                }
                
              } catch (error) {
                return {
                  error: \`Failed to inspect store: \${error.message}\`,
                  storeName,
                  storeFound: true
                };
              }
              
              return storeInfo;
            })()
          `;

          const result = await withScriptExecution(storeInspectionScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            storeId: { 
              type: 'string', 
              description: 'Specific store ID to inspect (e.g., useStore, appStore)'
            },
            includeActions: { 
              type: 'boolean', 
              description: 'Include store actions in output',
              default: true
            },
            includeComputed: { 
              type: 'boolean', 
              description: 'Include computed values in output',
              default: false
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register zustand_subscription_track tool
    this.registerTool(
      this.createTool(
        'zustand_subscription_track',
        'Track Zustand store subscriptions and selectors',
        zustandSubscriptionTrackSchema,
        async (args, context) => {
          const subscriptionTrackingScript = `
            (function() {
              const subscriptionInfo = {
                subscriptions: [],
                selectors: [],
                activeListeners: 0
              };
              
              const storeId = '${args.storeId || ''}';
              const trackSelectors = ${args.trackSelectors === true};
              
              // Find the store
              let store = null;
              if (storeId && window[storeId]) {
                store = window[storeId];
              } else {
                // Find first available store
                const possibleStores = ['useStore', 'store', 'appStore'];
                for (const name of possibleStores) {
                  if (window[name] && typeof window[name] === 'function') {
                    store = window[name];
                    break;
                  }
                }
              }
              
              if (!store) {
                return { error: 'No Zustand store found for subscription tracking' };
              }
              
              // Check for subscription capabilities
              if (store.subscribe && typeof store.subscribe === 'function') {
                subscriptionInfo.hasSubscribe = true;
                
                // Create a test subscription to understand the pattern
                try {
                  const unsubscribe = store.subscribe((state) => {
                    // Test subscription - will be immediately unsubscribed
                  });
                  
                  if (typeof unsubscribe === 'function') {
                    unsubscribe(); // Clean up immediately
                    subscriptionInfo.subscriptionPattern = 'function-based';
                  }
                } catch (error) {
                  subscriptionInfo.subscriptionError = error.message;
                }
              }
              
              if (store.getState && typeof store.getState === 'function') {
                subscriptionInfo.hasGetState = true;
                
                try {
                  const state = store.getState();
                  subscriptionInfo.currentState = {
                    keys: Object.keys(state),
                    size: Object.keys(state).length
                  };
                } catch (error) {
                  subscriptionInfo.stateError = error.message;
                }
              }
              
              // Track selectors if requested
              if (trackSelectors) {
                // This would require monkey-patching the store's subscribe method
                // to track selector usage - simplified for this implementation
                subscriptionInfo.selectorTracking = 'not-implemented';
                subscriptionInfo.note = 'Selector tracking requires runtime modification of store methods';
              }
              
              // Check for React-Zustand integration
              if (window.React && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                subscriptionInfo.reactIntegration = true;
                // In a real implementation, we could traverse React components
                // to find useStore calls and their selectors
              }
              
              return {
                ...subscriptionInfo,
                timestamp: new Date().toISOString(),
                recommendations: [
                  'Use browser DevTools to set breakpoints in store.subscribe calls',
                  'Monitor state changes through store.getState() before and after actions',
                  'Consider adding custom logging to your store actions'
                ]
              };
            })()
          `;

          const result = await withScriptExecution(subscriptionTrackingScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            storeId: { 
              type: 'string', 
              description: 'Specific store ID to track subscriptions for'
            },
            trackSelectors: { 
              type: 'boolean', 
              description: 'Track selector function usage',
              default: false
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register zustand_action_dispatch tool
    this.registerTool(
      this.createTool(
        'zustand_action_dispatch',
        'Dispatch actions to Zustand stores for testing',
        zustandActionDispatchSchema,
        async (args, context) => {
          const actionDispatchScript = `
            (function() {
              const storeId = '${args.storeId}';
              const actionName = '${args.actionName}';
              const payload = ${JSON.stringify(args.payload || null)};
              
              const result = {
                dispatched: false,
                storeBefore: null,
                storeAfter: null,
                error: null
              };
              
              // Find the store
              let store = window[storeId];
              if (!store && window.stores && window.stores[storeId]) {
                store = window.stores[storeId];
              }
              
              if (!store || typeof store !== 'function') {
                return {
                  error: \`Store '\${storeId}' not found or not accessible\`,
                  suggestions: [
                    'Check the store name/ID',
                    'Ensure the store is globally accessible',
                    'Verify the store is properly initialized'
                  ]
                };
              }
              
              try {
                // Get state before action
                const stateBefore = store();
                result.storeBefore = {
                  keys: Object.keys(stateBefore),
                  timestamp: new Date().toISOString()
                };
                
                // Find and call the action
                if (typeof stateBefore[actionName] !== 'function') {
                  return {
                    error: \`Action '\${actionName}' not found in store '\${storeId}'\`,
                    availableActions: Object.keys(stateBefore).filter(key => 
                      typeof stateBefore[key] === 'function'
                    )
                  };
                }
                
                // Dispatch the action
                let actionResult;
                if (payload !== null) {
                  actionResult = stateBefore[actionName](payload);
                } else {
                  actionResult = stateBefore[actionName]();
                }
                
                result.dispatched = true;
                result.actionResult = actionResult;
                
                // Get state after action
                const stateAfter = store();
                result.storeAfter = {
                  keys: Object.keys(stateAfter),
                  timestamp: new Date().toISOString()
                };
                
                // Calculate changes
                const changes = [];
                const allKeys = new Set([...Object.keys(stateBefore), ...Object.keys(stateAfter)]);
                
                allKeys.forEach(key => {
                  const before = stateBefore[key];
                  const after = stateAfter[key];
                  
                  if (before !== after) {
                    changes.push({
                      key,
                      before: typeof before === 'function' ? '[function]' : before,
                      after: typeof after === 'function' ? '[function]' : after,
                      type: typeof after
                    });
                  }
                });
                
                result.changes = changes;
                result.changeCount = changes.length;
                
              } catch (error) {
                result.error = error.message;
                result.errorType = error.name;
              }
              
              return result;
            })()
          `;

          const result = await withScriptExecution(actionDispatchScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            storeId: { 
              type: 'string', 
              description: 'Store ID to dispatch action to'
            },
            actionName: { 
              type: 'string', 
              description: 'Name of the action function to call'
            },
            payload: { 
              description: 'Payload to pass to the action function'
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: ['storeId', 'actionName']
        }
      )
    );

    // Register zustand_persist_inspect tool
    this.registerTool({
      name: 'zustand_persist_inspect',
      description: 'Inspect Zustand store persistence and storage state',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            storeId: obj.storeId,
            includeStorage: typeof obj.includeStorage === 'boolean' ? obj.includeStorage : true,
            sessionId: obj.sessionId
          };
        },
        safeParse: function(value) {
          try {
            const parsed = this.parse(value);
            return { success: true, data: parsed };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      jsonSchema: {
        type: 'object',
        properties: {
          storeId: { 
            type: 'string', 
            description: 'Specific store ID to inspect persistence for'
          },
          includeStorage: { 
            type: 'boolean', 
            description: 'Include localStorage/sessionStorage data',
            default: true
          },
          sessionId: { 
            type: 'string', 
            description: 'Optional Chrome session ID'
          }
        },
        required: []
      },
      handler: async (args, context) => {
        const persistInspectionScript = `
          (function() {
            const persistInfo = {
              stores: [],
              storageKeys: [],
              totalPersistentData: 0
            };
            
            const storeId = '${args.storeId || ''}';
            const includeStorage = ${args.includeStorage !== false};
            
            // Check specific store or all stores
            const storesToCheck = storeId ? [storeId] : [
              'useStore', 'store', 'appStore', 'userStore', 'authStore'
            ];
            
            storesToCheck.forEach(name => {
              if (window[name] && typeof window[name] === 'function') {
                try {
                  const state = window[name]();
                  const storeInfo = {
                    name,
                    persistent: false,
                    persistKey: null,
                    persistOptions: null,
                    storageType: null
                  };
                  
                  // Check for persistence metadata
                  if (state.persist) {
                    storeInfo.persistent = true;
                    storeInfo.persistKey = state.persist.key || state.persist.name;
                    storeInfo.persistOptions = state.persist.options || {};
                    storeInfo.storageType = state.persist.storage ? 'custom' : 'localStorage';
                  }
                  
                  if (state._persist) {
                    storeInfo.persistent = true;
                    storeInfo.persistKey = state._persist.key;
                    storeInfo.persistOptions = state._persist;
                  }
                  
                  persistInfo.stores.push(storeInfo);
                } catch (error) {
                  // Store not accessible
                }
              }
            });
            
            // Check storage for Zustand data
            if (includeStorage) {
              try {
                // Check localStorage
                const localStorageKeys = Object.keys(localStorage);
                const zustandKeys = localStorageKeys.filter(key => 
                  key.includes('zustand') || 
                  key.includes('store') ||
                  key.includes('persist') ||
                  persistInfo.stores.some(store => store.persistKey === key)
                );
                
                zustandKeys.forEach(key => {
                  try {
                    const data = localStorage.getItem(key);
                    const parsed = JSON.parse(data || '{}');
                    
                    persistInfo.storageKeys.push({
                      key,
                      type: 'localStorage',
                      size: data ? data.length : 0,
                      data: parsed,
                      keys: typeof parsed === 'object' ? Object.keys(parsed) : [],
                      timestamp: parsed._persist?.rehydrated || null
                    });
                    
                    persistInfo.totalPersistentData += data ? data.length : 0;
                  } catch (error) {
                    persistInfo.storageKeys.push({
                      key,
                      type: 'localStorage',
                      error: 'Invalid JSON',
                      size: 0
                    });
                  }
                });
                
                // Check sessionStorage
                const sessionStorageKeys = Object.keys(sessionStorage);
                const sessionZustandKeys = sessionStorageKeys.filter(key => 
                  key.includes('zustand') || key.includes('store')
                );
                
                sessionZustandKeys.forEach(key => {
                  try {
                    const data = sessionStorage.getItem(key);
                    const parsed = JSON.parse(data || '{}');
                    
                    persistInfo.storageKeys.push({
                      key,
                      type: 'sessionStorage',
                      size: data ? data.length : 0,
                      data: parsed,
                      keys: typeof parsed === 'object' ? Object.keys(parsed) : []
                    });
                    
                    persistInfo.totalPersistentData += data ? data.length : 0;
                  } catch (error) {
                    persistInfo.storageKeys.push({
                      key,
                      type: 'sessionStorage',
                      error: 'Invalid JSON',
                      size: 0
                    });
                  }
                });
              } catch (error) {
                persistInfo.storageError = error.message;
              }
            }
            
            return {
              ...persistInfo,
              summary: {
                totalStores: persistInfo.stores.length,
                persistentStores: persistInfo.stores.filter(s => s.persistent).length,
                storageEntries: persistInfo.storageKeys.length,
                totalDataSize: persistInfo.totalPersistentData
              }
            };
          })()
        `;

        const result = await withScriptExecution(persistInspectionScript, context);

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: result.unwrap()
        };
      }
    });
  }
}

export class ZustandToolProviderFactory extends BaseProviderFactory<ZustandToolProvider> {
  create(deps: ProviderDependencies): ZustandToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'zustand',
      description: 'Zustand state management debugging and inspection tools'
    };

    return new ZustandToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}