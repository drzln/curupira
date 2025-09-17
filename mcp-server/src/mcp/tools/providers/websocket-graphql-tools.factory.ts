/**
 * WebSocket/GraphQL Subscription Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for WebSocket and GraphQL subscription debugging tools
 * Tailored for NovaSkyn's real-time GraphQL architecture
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for WebSocket/GraphQL tools
const wsDetectionSchema: Schema<{ sessionId?: string }> = {
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

const wsInspectSchema: Schema<{ 
  url?: string; 
  includeMessages?: boolean; 
  messageLimit?: number;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      url: obj.url,
      includeMessages: typeof obj.includeMessages === 'boolean' ? obj.includeMessages : true,
      messageLimit: typeof obj.messageLimit === 'number' ? obj.messageLimit : 50,
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

const subscriptionInspectSchema: Schema<{ 
  subscriptionName?: string; 
  includeData?: boolean; 
  includeErrors?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      subscriptionName: obj.subscriptionName,
      includeData: typeof obj.includeData === 'boolean' ? obj.includeData : true,
      includeErrors: typeof obj.includeErrors === 'boolean' ? obj.includeErrors : true,
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

const wsMessageSendSchema: Schema<{ 
  url?: string; 
  message: any; 
  messageType?: string;
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (obj.message === undefined) {
      throw new Error('message is required');
    }
    return {
      url: obj.url,
      message: obj.message,
      messageType: obj.messageType || 'text',
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

class WebSocketGraphQLToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register websocket_detect tool
    this.registerTool(
      this.createTool(
        'websocket_detect',
        'Detect WebSocket connections and GraphQL subscriptions',
        wsDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const wsInfo = {
                webSockets: [],
                graphqlSubscriptions: [],
                eventSources: [],
                apolloSubscriptions: [],
                detected: false
              };
              
              // Method 1: Check for WebSocket instances in global scope
              const possibleWS = [
                'ws', 'websocket', 'socket', 'connection',
                'apolloWS', 'subscriptionClient', 'graphqlWS'
              ];
              
              possibleWS.forEach(name => {
                if (window[name] && window[name] instanceof WebSocket) {
                  wsInfo.webSockets.push({
                    name,
                    url: window[name].url,
                    readyState: window[name].readyState,
                    protocol: window[name].protocol,
                    source: 'global-websocket'
                  });
                  wsInfo.detected = true;
                }
              });
              
              // Method 2: Check for Apollo GraphQL subscriptions
              if (window.__APOLLO_CLIENT__ || window.apolloClient) {
                const client = window.__APOLLO_CLIENT__ || window.apolloClient;
                
                try {
                  if (client.link) {
                    // Traverse Apollo Link chain to find subscription links
                    const analyzeLink = (link, depth = 0) => {
                      if (!link || depth > 10) return;
                      
                      const linkType = link.constructor.name;
                      
                      if (linkType.includes('WebSocket') || 
                          linkType.includes('Subscription') ||
                          linkType.includes('Split')) {
                        wsInfo.apolloSubscriptions.push({
                          type: linkType,
                          depth,
                          hasRequest: !!link.request,
                          hasNext: !!link.left || !!link.right
                        });
                        wsInfo.detected = true;
                      }
                      
                      // Check for WebSocket URL in link
                      if (link.url && (link.url.startsWith('ws://') || link.url.startsWith('wss://'))) {
                        wsInfo.apolloSubscriptions.push({
                          type: 'websocket-link',
                          url: link.url,
                          protocols: link.protocols || []
                        });
                        wsInfo.detected = true;
                      }
                      
                      // Traverse left and right links
                      if (link.left) analyzeLink(link.left, depth + 1);
                      if (link.right) analyzeLink(link.right, depth + 1);
                    };
                    
                    analyzeLink(client.link);
                  }
                  
                  // Check for active subscriptions in Apollo Client
                  if (client.queryManager && client.queryManager.queries) {
                    let subscriptionCount = 0;
                    Object.values(client.queryManager.queries).forEach(query => {
                      if (query.document && query.document.definitions) {
                        const hasSubscription = query.document.definitions.some(def => 
                          def.kind === 'OperationDefinition' && def.operation === 'subscription'
                        );
                        if (hasSubscription) {
                          subscriptionCount++;
                        }
                      }
                    });
                    
                    if (subscriptionCount > 0) {
                      wsInfo.apolloSubscriptions.push({
                        type: 'active-subscriptions',
                        count: subscriptionCount,
                        source: 'apollo-query-manager'
                      });
                      wsInfo.detected = true;
                    }
                  }
                } catch (error) {
                  wsInfo.apolloError = error.message;
                }
              }
              
              // Method 3: Check for Server-Sent Events (EventSource)
              const possibleEventSources = [
                'eventSource', 'sse', 'serverEvents', 'liveUpdates'
              ];
              
              possibleEventSources.forEach(name => {
                if (window[name] && window[name] instanceof EventSource) {
                  wsInfo.eventSources.push({
                    name,
                    url: window[name].url,
                    readyState: window[name].readyState,
                    source: 'global-eventsource'
                  });
                  wsInfo.detected = true;
                }
              });
              
              // Method 4: Check for GraphQL subscription libraries
              if (window.graphqlWs || window.subscriptionsTransportWs) {
                wsInfo.subscriptionLibraries = {
                  graphqlWs: !!window.graphqlWs,
                  subscriptionsTransportWs: !!window.subscriptionsTransportWs
                };
                wsInfo.detected = true;
              }
              
              // Method 5: Monitor WebSocket constructor for new connections
              if (window.WebSocket && !window.WebSocket._curupiraPatched) {
                const originalWebSocket = window.WebSocket;
                const connections = [];
                
                window.WebSocket = function(url, protocols) {
                  const ws = new originalWebSocket(url, protocols);
                  connections.push({
                    url,
                    protocols: protocols || [],
                    timestamp: Date.now(),
                    readyState: ws.readyState
                  });
                  return ws;
                };
                
                // Copy static methods
                Object.setPrototypeOf(window.WebSocket, originalWebSocket);
                window.WebSocket.prototype = originalWebSocket.prototype;
                window.WebSocket._curupiraPatched = true;
                
                if (connections.length > 0) {
                  wsInfo.recentConnections = connections;
                  wsInfo.detected = true;
                }
              }
              
              // Method 6: Check for real-time libraries
              const realtimeLibraries = {
                socketio: !!window.io,
                pusher: !!window.Pusher,
                supabase: !!window.supabase && !!window.supabase.realtime,
                firebase: !!window.firebase && !!window.firebase.database
              };
              
              const detectedLibraries = Object.entries(realtimeLibraries)
                .filter(([_, detected]) => detected)
                .map(([name]) => name);
              
              if (detectedLibraries.length > 0) {
                wsInfo.realtimeLibraries = detectedLibraries;
                wsInfo.detected = true;
              }
              
              return {
                ...wsInfo,
                timestamp: new Date().toISOString(),
                summary: {
                  detected: wsInfo.detected,
                  totalWebSockets: wsInfo.webSockets.length,
                  totalEventSources: wsInfo.eventSources.length,
                  apolloSubscriptions: wsInfo.apolloSubscriptions.length,
                  realtimeLibrariesDetected: detectedLibraries.length
                }
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
            data: unwrapped.result?.value || { detected: false }
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

    // Register websocket_inspect tool
    this.registerTool(
      this.createTool(
        'websocket_inspect',
        'Inspect WebSocket connections and message history',
        wsInspectSchema,
        async (args, context) => {
          const wsInspectionScript = `
            (function() {
              const wsInfo = {
                connections: [],
                messageHistory: [],
                totalMessages: 0
              };
              
              const targetUrl = '${args.url || ''}';
              const includeMessages = ${args.includeMessages !== false};
              const messageLimit = ${args.messageLimit || 50};
              
              // Find WebSocket connections
              const possibleWS = [
                'ws', 'websocket', 'socket', 'connection',
                'apolloWS', 'subscriptionClient', 'graphqlWS'
              ];
              
              possibleWS.forEach(name => {
                if (window[name] && window[name] instanceof WebSocket) {
                  const ws = window[name];
                  
                  // Filter by URL if specified
                  if (targetUrl && !ws.url.includes(targetUrl)) {
                    return;
                  }
                  
                  const connectionInfo = {
                    name,
                    url: ws.url,
                    readyState: ws.readyState,
                    readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState],
                    protocol: ws.protocol,
                    extensions: ws.extensions,
                    binaryType: ws.binaryType,
                    bufferedAmount: ws.bufferedAmount
                  };
                  
                  // Add message monitoring if requested
                  if (includeMessages && !ws._curupiraMonitored) {
                    const messages = [];
                    
                    // Store original event handlers
                    const originalOnMessage = ws.onmessage;
                    const originalOnError = ws.onerror;
                    const originalOnClose = ws.onclose;
                    const originalSend = ws.send;
                    
                    // Monitor incoming messages
                    ws.addEventListener('message', (event) => {
                      messages.push({
                        type: 'incoming',
                        data: event.data,
                        timestamp: Date.now(),
                        size: typeof event.data === 'string' ? event.data.length : event.data.byteLength || 0
                      });
                      
                      // Keep only recent messages
                      if (messages.length > messageLimit) {
                        messages.shift();
                      }
                    });
                    
                    // Monitor outgoing messages
                    ws.send = function(data) {
                      messages.push({
                        type: 'outgoing',
                        data: data,
                        timestamp: Date.now(),
                        size: typeof data === 'string' ? data.length : data.byteLength || 0
                      });
                      
                      if (messages.length > messageLimit) {
                        messages.shift();
                      }
                      
                      return originalSend.call(this, data);
                    };
                    
                    ws._curupiraMonitored = true;
                    ws._curupiraMessages = messages;
                  }
                  
                  // Include existing message history
                  if (includeMessages && ws._curupiraMessages) {
                    connectionInfo.messages = ws._curupiraMessages.slice(-messageLimit);
                    connectionInfo.totalMessages = ws._curupiraMessages.length;
                    wsInfo.totalMessages += ws._curupiraMessages.length;
                  }
                  
                  wsInfo.connections.push(connectionInfo);
                }
              });
              
              // Check for Apollo Client WebSocket transport
              if (window.__APOLLO_CLIENT__ || window.apolloClient) {
                try {
                  const client = window.__APOLLO_CLIENT__ || window.apolloClient;
                  
                  // Look for subscription transport
                  if (client.wsClient || client.subscriptionClient) {
                    const transport = client.wsClient || client.subscriptionClient;
                    
                    wsInfo.connections.push({
                      name: 'apollo-subscription-client',
                      type: 'apollo-transport',
                      status: transport.status || 'unknown',
                      url: transport.url || transport.uri,
                      operations: transport.operations ? Object.keys(transport.operations).length : 0
                    });
                  }
                } catch (error) {
                  wsInfo.apolloError = error.message;
                }
              }
              
              return {
                ...wsInfo,
                summary: {
                  totalConnections: wsInfo.connections.length,
                  openConnections: wsInfo.connections.filter(c => c.readyState === 1).length,
                  totalMessages: wsInfo.totalMessages,
                  messageMonitoring: includeMessages
                }
              };
            })()
          `;

          const result = await withScriptExecution(wsInspectionScript, context);

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
            url: { 
              type: 'string', 
              description: 'Filter by WebSocket URL pattern'
            },
            includeMessages: { 
              type: 'boolean', 
              description: 'Include message history in output',
              default: true
            },
            messageLimit: { 
              type: 'number', 
              description: 'Maximum number of messages to include',
              default: 50
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

    // Register graphql_subscription_inspect tool
    this.registerTool(
      this.createTool(
        'graphql_subscription_inspect',
        'Inspect active GraphQL subscriptions and their data',
        subscriptionInspectSchema,
        async (args, context) => {
          const subscriptionInspectionScript = `
            (function() {
              const subscriptionInfo = {
                activeSubscriptions: [],
                apolloSubscriptions: [],
                totalSubscriptions: 0
              };
              
              const subscriptionName = '${args.subscriptionName || ''}';
              const includeData = ${args.includeData !== false};
              const includeErrors = ${args.includeErrors !== false};
              
              // Method 1: Check Apollo Client subscriptions
              if (window.__APOLLO_CLIENT__ || window.apolloClient) {
                try {
                  const client = window.__APOLLO_CLIENT__ || window.apolloClient;
                  
                  if (client.queryManager && client.queryManager.queries) {
                    Object.entries(client.queryManager.queries).forEach(([queryId, query]) => {
                      if (query.document && query.document.definitions) {
                        const subscriptionDef = query.document.definitions.find(def => 
                          def.kind === 'OperationDefinition' && def.operation === 'subscription'
                        );
                        
                        if (subscriptionDef) {
                          const operationName = subscriptionDef.name ? subscriptionDef.name.value : 'unnamed';
                          
                          // Filter by subscription name if specified
                          if (subscriptionName && !operationName.includes(subscriptionName)) {
                            return;
                          }
                          
                          const subscriptionData = {
                            queryId,
                            operationName,
                            status: query.networkStatus || 'unknown',
                            variables: query.variables || {},
                            lastResult: null,
                            lastError: null,
                            isActive: !!(query.observers && query.observers.size > 0),
                            observerCount: query.observers ? query.observers.size : 0
                          };
                          
                          // Include data if requested and available
                          if (includeData && query.lastResult) {
                            subscriptionData.lastResult = {
                              data: query.lastResult.data,
                              loading: query.lastResult.loading,
                              networkStatus: query.lastResult.networkStatus
                            };
                          }
                          
                          // Include errors if requested
                          if (includeErrors && query.lastError) {
                            subscriptionData.lastError = {
                              message: query.lastError.message,
                              name: query.lastError.name,
                              networkError: query.lastError.networkError ? {
                                message: query.lastError.networkError.message
                              } : null,
                              graphQLErrors: query.lastError.graphQLErrors || []
                            };
                          }
                          
                          // Extract subscription fields
                          if (subscriptionDef.selectionSet) {
                            subscriptionData.fields = subscriptionDef.selectionSet.selections.map(sel => 
                              sel.name ? sel.name.value : 'unknown'
                            );
                          }
                          
                          subscriptionInfo.apolloSubscriptions.push(subscriptionData);
                          subscriptionInfo.totalSubscriptions++;
                        }
                      }
                    });
                  }
                  
                  // Check for observable queries with subscriptions
                  if (client.queryManager && client.queryManager.observableQueries) {
                    Object.values(client.queryManager.observableQueries).forEach(observable => {
                      if (observable.options && observable.options.pollInterval) {
                        // This is a polling query, not a subscription, but relevant for real-time data
                        subscriptionInfo.apolloSubscriptions.push({
                          type: 'polling-query',
                          operationName: observable.options.operationName || 'unnamed',
                          pollInterval: observable.options.pollInterval,
                          isActive: !observable.isStopped,
                          status: 'polling'
                        });
                      }
                    });
                  }
                } catch (error) {
                  subscriptionInfo.apolloError = error.message;
                }
              }
              
              // Method 2: Check for other GraphQL subscription clients
              if (window.subscriptionClient || window.graphqlSubscriptionClient) {
                try {
                  const client = window.subscriptionClient || window.graphqlSubscriptionClient;
                  
                  if (client.operations || client.subscriptions) {
                    const operations = client.operations || client.subscriptions;
                    
                    Object.entries(operations).forEach(([opId, operation]) => {
                      subscriptionInfo.activeSubscriptions.push({
                        operationId: opId,
                        query: operation.query || 'unknown',
                        variables: operation.variables || {},
                        status: operation.status || 'active',
                        client: 'subscription-client'
                      });
                      subscriptionInfo.totalSubscriptions++;
                    });
                  }
                } catch (error) {
                  subscriptionInfo.subscriptionClientError = error.message;
                }
              }
              
              // Method 3: Check for custom subscription tracking
              if (window.__GRAPHQL_SUBSCRIPTIONS__) {
                try {
                  const customSubs = window.__GRAPHQL_SUBSCRIPTIONS__;
                  
                  if (Array.isArray(customSubs)) {
                    customSubs.forEach(sub => {
                      subscriptionInfo.activeSubscriptions.push({
                        ...sub,
                        source: 'custom-tracking'
                      });
                      subscriptionInfo.totalSubscriptions++;
                    });
                  }
                } catch (error) {
                  subscriptionInfo.customTrackingError = error.message;
                }
              }
              
              return {
                ...subscriptionInfo,
                summary: {
                  totalSubscriptions: subscriptionInfo.totalSubscriptions,
                  apolloSubscriptions: subscriptionInfo.apolloSubscriptions.length,
                  activeSubscriptions: subscriptionInfo.activeSubscriptions.length,
                  withData: includeData,
                  withErrors: includeErrors
                }
              };
            })()
          `;

          const result = await withScriptExecution(subscriptionInspectionScript, context);

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
            subscriptionName: { 
              type: 'string', 
              description: 'Filter by subscription operation name'
            },
            includeData: { 
              type: 'boolean', 
              description: 'Include subscription data in output',
              default: true
            },
            includeErrors: { 
              type: 'boolean', 
              description: 'Include subscription errors in output',
              default: true
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

    // Register websocket_send_message tool
    this.registerTool(
      this.createTool(
        'websocket_send_message',
        'Send test messages to WebSocket connections',
        wsMessageSendSchema,
        async (args, context) => {
          const sendMessageScript = `
            (function() {
              const targetUrl = '${args.url || ''}';
              const message = ${JSON.stringify(args.message)};
              const messageType = '${args.messageType || 'text'}';
              
              const result = {
                sent: false,
                connection: null,
                error: null,
                messageSize: 0
              };
              
              // Find WebSocket connection to send to
              let targetWS = null;
              let connectionName = '';
              
              const possibleWS = [
                'ws', 'websocket', 'socket', 'connection',
                'apolloWS', 'subscriptionClient', 'graphqlWS'
              ];
              
              for (const name of possibleWS) {
                if (window[name] && window[name] instanceof WebSocket) {
                  const ws = window[name];
                  
                  // If URL specified, match against it
                  if (targetUrl && !ws.url.includes(targetUrl)) {
                    continue;
                  }
                  
                  // Check if connection is open
                  if (ws.readyState === WebSocket.OPEN) {
                    targetWS = ws;
                    connectionName = name;
                    break;
                  }
                }
              }
              
              if (!targetWS) {
                return {
                  error: targetUrl ? 
                    \`No open WebSocket connection found for URL: \${targetUrl}\` :
                    'No open WebSocket connections found',
                  suggestions: [
                    'Ensure WebSocket is connected and open',
                    'Check the URL pattern if specified',
                    'Verify WebSocket is globally accessible'
                  ]
                };
              }
              
              try {
                let messageToSend;
                
                if (messageType === 'json') {
                  messageToSend = JSON.stringify(message);
                } else if (messageType === 'binary') {
                  // Convert message to ArrayBuffer
                  const encoder = new TextEncoder();
                  messageToSend = encoder.encode(JSON.stringify(message));
                } else {
                  // Text message
                  messageToSend = typeof message === 'string' ? message : JSON.stringify(message);
                }
                
                // Send the message
                targetWS.send(messageToSend);
                
                result.sent = true;
                result.connection = {
                  name: connectionName,
                  url: targetWS.url,
                  readyState: targetWS.readyState,
                  protocol: targetWS.protocol
                };
                result.messageSize = typeof messageToSend === 'string' ? 
                  messageToSend.length : 
                  messageToSend.byteLength || 0;
                result.messageType = messageType;
                
                // Record the sent message for monitoring
                if (targetWS._curupiraMessages) {
                  targetWS._curupiraMessages.push({
                    type: 'outgoing-test',
                    data: messageToSend,
                    timestamp: Date.now(),
                    size: result.messageSize,
                    testMessage: true
                  });
                }
                
              } catch (error) {
                result.error = error.message;
                result.errorType = error.name;
              }
              
              return result;
            })()
          `;

          const result = await withScriptExecution(sendMessageScript, context);

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
            url: { 
              type: 'string', 
              description: 'Target WebSocket URL pattern'
            },
            message: { 
              description: 'Message to send (any type)'
            },
            messageType: { 
              type: 'string', 
              enum: ['text', 'json', 'binary'],
              description: 'Type of message to send',
              default: 'text'
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: ['message']
        }
      )
    );

    // Register realtime_connection_monitor tool
    this.registerTool({
      name: 'realtime_connection_monitor',
      description: 'Monitor real-time connection health and performance',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            duration: typeof obj.duration === 'number' ? obj.duration : 30000,
            includeMetrics: typeof obj.includeMetrics === 'boolean' ? obj.includeMetrics : true,
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
          duration: { 
            type: 'number', 
            description: 'Monitoring duration in milliseconds',
            default: 30000
          },
          includeMetrics: { 
            type: 'boolean', 
            description: 'Include performance metrics',
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
        const monitoringScript = `
          (function() {
            const duration = ${args.duration || 30000};
            const includeMetrics = ${args.includeMetrics !== false};
            
            const monitoringInfo = {
              connections: [],
              metrics: {
                messagesSent: 0,
                messagesReceived: 0,
                bytesTransferred: 0,
                errors: 0,
                reconnections: 0
              },
              startTime: Date.now(),
              duration: duration
            };
            
            // Find all real-time connections to monitor
            const possibleWS = [
              'ws', 'websocket', 'socket', 'connection',
              'apolloWS', 'subscriptionClient', 'graphqlWS'
            ];
            
            possibleWS.forEach(name => {
              if (window[name] && window[name] instanceof WebSocket) {
                const ws = window[name];
                
                const connectionInfo = {
                  name,
                  url: ws.url,
                  initialState: ws.readyState,
                  events: [],
                  messageCount: 0,
                  errorCount: 0,
                  bytesTransferred: 0
                };
                
                // Monitor connection events
                const startTime = Date.now();
                
                // Message monitoring
                const messageHandler = (event) => {
                  connectionInfo.messageCount++;
                  connectionInfo.bytesTransferred += event.data ? 
                    (typeof event.data === 'string' ? event.data.length : event.data.byteLength || 0) : 0;
                  
                  connectionInfo.events.push({
                    type: 'message',
                    timestamp: Date.now() - startTime,
                    size: event.data ? 
                      (typeof event.data === 'string' ? event.data.length : event.data.byteLength || 0) : 0
                  });
                  
                  monitoringInfo.metrics.messagesReceived++;
                  monitoringInfo.metrics.bytesTransferred += connectionInfo.bytesTransferred;
                };
                
                // Error monitoring
                const errorHandler = (event) => {
                  connectionInfo.errorCount++;
                  connectionInfo.events.push({
                    type: 'error',
                    timestamp: Date.now() - startTime,
                    error: event.message || 'Unknown error'
                  });
                  
                  monitoringInfo.metrics.errors++;
                };
                
                // Close monitoring
                const closeHandler = (event) => {
                  connectionInfo.events.push({
                    type: 'close',
                    timestamp: Date.now() - startTime,
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                  });
                };
                
                // Open monitoring (for reconnections)
                const openHandler = (event) => {
                  connectionInfo.events.push({
                    type: 'open',
                    timestamp: Date.now() - startTime
                  });
                  
                  if (Date.now() - startTime > 1000) { // Only count as reconnection if not initial
                    monitoringInfo.metrics.reconnections++;
                  }
                };
                
                // Add event listeners
                ws.addEventListener('message', messageHandler);
                ws.addEventListener('error', errorHandler);
                ws.addEventListener('close', closeHandler);
                ws.addEventListener('open', openHandler);
                
                // Store cleanup function
                connectionInfo.cleanup = () => {
                  ws.removeEventListener('message', messageHandler);
                  ws.removeEventListener('error', errorHandler);
                  ws.removeEventListener('close', closeHandler);
                  ws.removeEventListener('open', openHandler);
                };
                
                monitoringInfo.connections.push(connectionInfo);
              }
            });
            
            // Note: This is a snapshot approach since we can't actually wait in the browser
            // In a real implementation, this would set up monitoring and return results after duration
            
            return {
              ...monitoringInfo,
              note: 'This is an initial snapshot. For continuous monitoring, implement server-side collection.',
              summary: {
                connectionsMonitored: monitoringInfo.connections.length,
                totalConnections: monitoringInfo.connections.length,
                openConnections: monitoringInfo.connections.filter(c => c.initialState === 1).length,
                monitoringDuration: duration + 'ms'
              },
              recommendations: [
                'Use browser DevTools Network tab for detailed WebSocket monitoring',
                'Implement client-side logging for production monitoring',
                'Consider using WebSocket debugging tools for real-time analysis'
              ]
            };
          })()
        `;

        const result = await withScriptExecution(monitoringScript, context);

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

export class WebSocketGraphQLToolProviderFactory extends BaseProviderFactory<WebSocketGraphQLToolProvider> {
  create(deps: ProviderDependencies): WebSocketGraphQLToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'websocket-graphql',
      description: 'WebSocket and GraphQL subscription debugging tools'
    };

    return new WebSocketGraphQLToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}