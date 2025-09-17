/**
 * XState Machine Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for XState finite state machine debugging tools
 * Tailored for NovaSkyn's XState 5.20.x architecture
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for XState tools
const xstateDetectionSchema: Schema<{ sessionId?: string }> = {
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

const machineInspectSchema: Schema<{ 
  machineId?: string; 
  includeContext?: boolean; 
  includeEvents?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      machineId: obj.machineId,
      includeContext: typeof obj.includeContext === 'boolean' ? obj.includeContext : true,
      includeEvents: typeof obj.includeEvents === 'boolean' ? obj.includeEvents : true,
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

const stateTransitionSchema: Schema<{ 
  machineId?: string; 
  event: string; 
  payload?: any;
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.event !== 'string') {
      throw new Error('event must be a string');
    }
    return {
      machineId: obj.machineId,
      event: obj.event,
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

const actorInspectSchema: Schema<{ 
  actorId?: string; 
  includeChildren?: boolean; 
  includeHistory?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      actorId: obj.actorId,
      includeChildren: typeof obj.includeChildren === 'boolean' ? obj.includeChildren : true,
      includeHistory: typeof obj.includeHistory === 'boolean' ? obj.includeHistory : false,
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

class XStateToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register xstate_detect tool
    this.registerTool(
      this.createTool(
        'xstate_detect',
        'Detect XState machines and actor instances in the application',
        xstateDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const xstateInfo = {
                detected: false,
                machines: [],
                actors: [],
                interpreters: [],
                devtools: false,
                version: null
              };
              
              // Method 1: Check for XState global objects
              if (window.XState || window.xstate) {
                xstateInfo.detected = true;
                xstateInfo.version = (window.XState && window.XState.version) || 
                                   (window.xstate && window.xstate.version) || 'unknown';
                xstateInfo.globalXState = true;
              }
              
              // Method 2: Check for XState DevTools
              if (window.__xstate__ || window.__XSTATE_DEVTOOLS__) {
                xstateInfo.detected = true;
                xstateInfo.devtools = true;
                
                if (window.__xstate__) {
                  try {
                    const devtoolsData = window.__xstate__;
                    xstateInfo.devtoolsInfo = {
                      services: devtoolsData.services ? Object.keys(devtoolsData.services).length : 0,
                      register: !!devtoolsData.register,
                      unregister: !!devtoolsData.unregister
                    };
                  } catch (error) {
                    xstateInfo.devtoolsError = error.message;
                  }
                }
              }
              
              // Method 3: Look for XState machines in common locations
              const possibleMachines = [
                'machine', 'stateMachine', 'xstateMachine',
                'authMachine', 'userMachine', 'appMachine'
              ];
              
              possibleMachines.forEach(name => {
                if (window[name] && typeof window[name] === 'object') {
                  try {
                    const obj = window[name];
                    
                    // Check if it looks like an XState machine
                    if (obj.config || obj.definition || obj.states || obj.id) {
                      xstateInfo.machines.push({
                        name,
                        id: obj.id || name,
                        source: 'global-object',
                        type: obj.config ? 'machine' : obj.definition ? 'machine-definition' : 'unknown',
                        states: obj.states ? Object.keys(obj.states) : [],
                        initialState: obj.initialState || obj.initial
                      });
                      xstateInfo.detected = true;
                    }
                  } catch (error) {
                    // Not an XState machine
                  }
                }
              });
              
              // Method 4: Look for XState actors/interpreters
              const possibleActors = [
                'actor', 'service', 'interpreter',
                'authActor', 'userActor', 'appActor'
              ];
              
              possibleActors.forEach(name => {
                if (window[name] && typeof window[name] === 'object') {
                  try {
                    const obj = window[name];
                    
                    // Check if it looks like an XState actor
                    if (obj.send && obj.getSnapshot && typeof obj.send === 'function') {
                      const snapshot = obj.getSnapshot();
                      
                      xstateInfo.actors.push({
                        name,
                        id: obj.id || name,
                        source: 'global-object',
                        currentState: snapshot.value || snapshot.state || 'unknown',
                        context: snapshot.context ? Object.keys(snapshot.context) : [],
                        status: obj.status || 'running'
                      });
                      xstateInfo.detected = true;
                    }
                    
                    // Check for legacy XState interpreters
                    if (obj.state && obj.send && typeof obj.send === 'function') {
                      xstateInfo.interpreters.push({
                        name,
                        id: obj.id || obj.machine?.id || name,
                        source: 'global-interpreter',
                        currentState: obj.state.value || 'unknown',
                        context: obj.state.context ? Object.keys(obj.state.context) : [],
                        machine: obj.machine ? obj.machine.id : null
                      });
                      xstateInfo.detected = true;
                    }
                  } catch (error) {
                    // Not an XState actor/interpreter
                  }
                }
              });
              
              // Method 5: Check React components for XState usage
              if (window.React && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                try {
                  xstateInfo.reactIntegration = true;
                  // In a real implementation, we'd traverse React components
                  // to find useMachine, useActor, useSelector usage
                } catch (error) {
                  xstateInfo.reactError = error.message;
                }
              }
              
              // Method 6: Check for XState in module system
              if (window.__webpack_require__ || window.require) {
                try {
                  xstateInfo.moduleSystemDetected = true;
                  // Could check for @xstate/react, xstate modules
                } catch (error) {
                  xstateInfo.moduleError = error.message;
                }
              }
              
              return {
                ...xstateInfo,
                timestamp: new Date().toISOString(),
                summary: {
                  detected: xstateInfo.detected,
                  machinesFound: xstateInfo.machines.length,
                  actorsFound: xstateInfo.actors.length,
                  interpretersFound: xstateInfo.interpreters.length,
                  hasDevtools: xstateInfo.devtools,
                  confidence: xstateInfo.devtools ? 'high' : 
                            xstateInfo.machines.length > 0 ? 'medium' : 
                            xstateInfo.detected ? 'low' : 'none'
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

    // Register xstate_machine_inspect tool
    this.registerTool(
      this.createTool(
        'xstate_machine_inspect',
        'Inspect XState machine definition, states, and configuration',
        machineInspectSchema,
        async (args, context) => {
          const machineInspectionScript = `
            (function() {
              const machineInfo = {
                machines: [],
                found: false
              };
              
              const machineId = '${args.machineId || ''}';
              const includeContext = ${args.includeContext !== false};
              const includeEvents = ${args.includeEvents !== false};
              
              // Method 1: Find machines in global scope
              const possibleMachines = machineId ? [machineId] : [
                'machine', 'stateMachine', 'xstateMachine',
                'authMachine', 'userMachine', 'appMachine'
              ];
              
              possibleMachines.forEach(name => {
                if (window[name] && typeof window[name] === 'object') {
                  try {
                    const machine = window[name];
                    
                    // Check if it's an XState machine
                    if (machine.config || machine.definition || machine.states) {
                      const machineData = {
                        name,
                        id: machine.id || name,
                        type: machine.config ? 'machine' : 'definition',
                        initial: machine.initial || machine.initialState,
                        states: {},
                        transitions: {},
                        guards: [],
                        actions: [],
                        services: []
                      };
                      
                      // Analyze states
                      const states = machine.states || machine.config?.states || {};
                      Object.entries(states).forEach(([stateName, stateConfig]) => {
                        machineData.states[stateName] = {
                          type: stateConfig.type || 'atomic',
                          on: stateConfig.on ? Object.keys(stateConfig.on) : [],
                          entry: stateConfig.entry ? (Array.isArray(stateConfig.entry) ? stateConfig.entry.length : 1) : 0,
                          exit: stateConfig.exit ? (Array.isArray(stateConfig.exit) ? stateConfig.exit.length : 1) : 0,
                          invoke: !!stateConfig.invoke,
                          always: !!stateConfig.always,
                          after: !!stateConfig.after
                        };
                        
                        // Collect transitions
                        if (stateConfig.on) {
                          Object.entries(stateConfig.on).forEach(([event, transition]) => {
                            if (!machineData.transitions[event]) {
                              machineData.transitions[event] = [];
                            }
                            machineData.transitions[event].push({
                              from: stateName,
                              to: Array.isArray(transition) ? transition.map(t => t.target || t).join(', ') : 
                                  transition.target || transition,
                              guard: transition.cond || transition.guard,
                              actions: transition.actions
                            });
                          });
                        }
                      });
                      
                      // Analyze machine options
                      const options = machine.options || machine.config?.options || {};
                      
                      if (options.guards) {
                        machineData.guards = Object.keys(options.guards);
                      }
                      
                      if (options.actions) {
                        machineData.actions = Object.keys(options.actions);
                      }
                      
                      if (options.services || options.actors) {
                        machineData.services = Object.keys(options.services || options.actors);
                      }
                      
                      // Include context schema if requested
                      if (includeContext && machine.context) {
                        machineData.context = {
                          schema: typeof machine.context === 'object' ? Object.keys(machine.context) : [],
                          initialValue: machine.context
                        };
                      }
                      
                      // Include event types if requested
                      if (includeEvents) {
                        const eventTypes = new Set();
                        Object.values(machineData.transitions).forEach(transitions => {
                          transitions.forEach(t => eventTypes.add(t.event));
                        });
                        machineData.eventTypes = Array.from(eventTypes);
                      }
                      
                      machineInfo.machines.push(machineData);
                      machineInfo.found = true;
                    }
                  } catch (error) {
                    machineInfo.machines.push({
                      name,
                      error: error.message,
                      type: 'inspection-failed'
                    });
                  }
                }
              });
              
              // Method 2: Check XState DevTools registry
              if (window.__xstate__ && window.__xstate__.services) {
                try {
                  Object.entries(window.__xstate__.services).forEach(([id, service]) => {
                    if (machineId && id !== machineId) return;
                    
                    if (service.machine) {
                      const machine = service.machine;
                      machineInfo.machines.push({
                        name: id,
                        id,
                        source: 'devtools-registry',
                        type: 'registered-service',
                        initial: machine.initial,
                        states: machine.states ? Object.keys(machine.states) : [],
                        currentState: service.state ? service.state.value : 'unknown'
                      });
                      machineInfo.found = true;
                    }
                  });
                } catch (error) {
                  machineInfo.devtoolsError = error.message;
                }
              }
              
              if (!machineInfo.found) {
                return {
                  error: machineId ? 
                    \`Machine '\${machineId}' not found\` : 
                    'No XState machines found',
                  suggestions: [
                    'Ensure XState machines are globally accessible',
                    'Check if XState DevTools are installed',
                    'Verify machine is properly initialized'
                  ]
                };
              }
              
              return {
                ...machineInfo,
                summary: {
                  totalMachines: machineInfo.machines.length,
                  totalStates: machineInfo.machines.reduce((sum, m) => sum + (Object.keys(m.states || {}).length), 0),
                  totalTransitions: machineInfo.machines.reduce((sum, m) => sum + (Object.keys(m.transitions || {}).length), 0)
                }
              };
            })()
          `;

          const result = await withScriptExecution(machineInspectionScript, context);

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
            machineId: { 
              type: 'string', 
              description: 'Specific machine ID to inspect'
            },
            includeContext: { 
              type: 'boolean', 
              description: 'Include machine context schema',
              default: true
            },
            includeEvents: { 
              type: 'boolean', 
              description: 'Include machine event types',
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

    // Register xstate_actor_inspect tool
    this.registerTool(
      this.createTool(
        'xstate_actor_inspect',
        'Inspect XState actor instances and their current state',
        actorInspectSchema,
        async (args, context) => {
          const actorInspectionScript = `
            (function() {
              const actorInfo = {
                actors: [],
                found: false
              };
              
              const actorId = '${args.actorId || ''}';
              const includeChildren = ${args.includeChildren !== false};
              const includeHistory = ${args.includeHistory === true};
              
              // Method 1: Find actors in global scope
              const possibleActors = actorId ? [actorId] : [
                'actor', 'service', 'interpreter',
                'authActor', 'userActor', 'appActor'
              ];
              
              possibleActors.forEach(name => {
                if (window[name] && typeof window[name] === 'object') {
                  try {
                    const actor = window[name];
                    
                    // Check for XState v5 actor
                    if (actor.send && actor.getSnapshot && typeof actor.send === 'function') {
                      const snapshot = actor.getSnapshot();
                      
                      const actorData = {
                        name,
                        id: actor.id || name,
                        type: 'actor',
                        status: actor.status || 'running',
                        currentState: snapshot.value || snapshot.state || 'unknown',
                        context: snapshot.context,
                        tags: snapshot.tags || [],
                        can: {},
                        machine: actor.src?.id || actor.machine?.id || null
                      };
                      
                      // Check what events the actor can receive
                      if (actor.machine && actor.machine.states) {
                        const currentStateConfig = actor.machine.states[snapshot.value];
                        if (currentStateConfig && currentStateConfig.on) {
                          actorData.can = Object.keys(currentStateConfig.on).reduce((acc, event) => {
                            acc[event] = true;
                            return acc;
                          }, {});
                        }
                      }
                      
                      // Include children if requested
                      if (includeChildren && snapshot.children) {
                        actorData.children = Object.keys(snapshot.children).map(childId => ({
                          id: childId,
                          status: snapshot.children[childId].status || 'unknown'
                        }));
                      }
                      
                      // Include history if requested
                      if (includeHistory && actor._state?.history) {
                        actorData.history = actor._state.history.slice(-10).map(event => ({
                          type: event.type,
                          timestamp: event.timestamp || Date.now()
                        }));
                      }
                      
                      actorInfo.actors.push(actorData);
                      actorInfo.found = true;
                    }
                    
                    // Check for XState v4 interpreter
                    else if (actor.state && actor.send && typeof actor.send === 'function') {
                      const actorData = {
                        name,
                        id: actor.id || actor.machine?.id || name,
                        type: 'interpreter',
                        status: actor.status || 'running',
                        currentState: actor.state.value,
                        context: actor.state.context,
                        nextEvents: actor.state.nextEvents || [],
                        machine: actor.machine?.id || null,
                        changed: actor.state.changed,
                        done: actor.state.done,
                        event: actor.state.event
                      };
                      
                      // Include children if requested  
                      if (includeChildren && actor.state.children) {
                        actorData.children = Object.keys(actor.state.children).map(childId => ({
                          id: childId,
                          state: actor.state.children[childId].state?.value || 'unknown'
                        }));
                      }
                      
                      // Include history if requested
                      if (includeHistory && actor.state.history) {
                        actorData.history = actor.state.history.slice(-10).map(state => ({
                          value: state.value,
                          event: state.event?.type,
                          timestamp: state.timestamp || Date.now()
                        }));
                      }
                      
                      actorInfo.actors.push(actorData);
                      actorInfo.found = true;
                    }
                  } catch (error) {
                    actorInfo.actors.push({
                      name,
                      error: error.message,
                      type: 'inspection-failed'
                    });
                  }
                }
              });
              
              // Method 2: Check XState DevTools registry
              if (window.__xstate__ && window.__xstate__.services) {
                try {
                  Object.entries(window.__xstate__.services).forEach(([id, service]) => {
                    if (actorId && id !== actorId) return;
                    
                    const actorData = {
                      name: id,
                      id,
                      source: 'devtools-registry',
                      type: 'registered-service',
                      status: service.status || 'unknown',
                      currentState: service.state?.value || 'unknown',
                      machine: service.machine?.id || null
                    };
                    
                    if (service.state) {
                      actorData.context = service.state.context;
                      actorData.nextEvents = service.state.nextEvents || [];
                    }
                    
                    actorInfo.actors.push(actorData);
                    actorInfo.found = true;
                  });
                } catch (error) {
                  actorInfo.devtoolsError = error.message;
                }
              }
              
              if (!actorInfo.found) {
                return {
                  error: actorId ? 
                    \`Actor '\${actorId}' not found\` : 
                    'No XState actors found',
                  suggestions: [
                    'Ensure XState actors/services are globally accessible',
                    'Check if XState DevTools are installed',
                    'Verify actors are running and not stopped'
                  ]
                };
              }
              
              return {
                ...actorInfo,
                summary: {
                  totalActors: actorInfo.actors.length,
                  running: actorInfo.actors.filter(a => a.status === 'running').length,
                  stopped: actorInfo.actors.filter(a => a.status === 'stopped').length,
                  withChildren: actorInfo.actors.filter(a => a.children && a.children.length > 0).length
                }
              };
            })()
          `;

          const result = await withScriptExecution(actorInspectionScript, context);

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
            actorId: { 
              type: 'string', 
              description: 'Specific actor ID to inspect'
            },
            includeChildren: { 
              type: 'boolean', 
              description: 'Include child actors in inspection',
              default: true
            },
            includeHistory: { 
              type: 'boolean', 
              description: 'Include state transition history',
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

    // Register xstate_send_event tool
    this.registerTool(
      this.createTool(
        'xstate_send_event',
        'Send events to XState actors for testing state transitions',
        stateTransitionSchema,
        async (args, context) => {
          const sendEventScript = `
            (function() {
              const machineId = '${args.machineId || ''}';
              const event = '${args.event}';
              const payload = ${JSON.stringify(args.payload || null)};
              
              const result = {
                sent: false,
                actor: null,
                stateBefore: null,
                stateAfter: null,
                error: null
              };
              
              // Find the actor to send event to
              let targetActor = null;
              let actorName = machineId;
              
              if (machineId && window[machineId]) {
                targetActor = window[machineId];
              } else {
                // Find first available actor
                const possibleActors = ['actor', 'service', 'interpreter'];
                for (const name of possibleActors) {
                  if (window[name] && window[name].send) {
                    targetActor = window[name];
                    actorName = name;
                    break;
                  }
                }
              }
              
              if (!targetActor || typeof targetActor.send !== 'function') {
                return {
                  error: machineId ? 
                    \`Actor '\${machineId}' not found or doesn't have send method\` :
                    'No XState actors found with send method',
                  suggestions: [
                    'Ensure the actor is globally accessible',
                    'Check the actor ID/name',
                    'Verify the actor is running'
                  ]
                };
              }
              
              try {
                // Get state before sending event
                if (targetActor.getSnapshot) {
                  // XState v5 actor
                  const snapshot = targetActor.getSnapshot();
                  result.stateBefore = {
                    value: snapshot.value,
                    context: snapshot.context,
                    tags: snapshot.tags || []
                  };
                } else if (targetActor.state) {
                  // XState v4 interpreter
                  result.stateBefore = {
                    value: targetActor.state.value,
                    context: targetActor.state.context,
                    nextEvents: targetActor.state.nextEvents || []
                  };
                }
                
                // Send the event
                const eventObj = payload ? { type: event, ...payload } : { type: event };
                targetActor.send(eventObj);
                
                result.sent = true;
                result.actor = {
                  id: targetActor.id || actorName,
                  name: actorName
                };
                result.event = eventObj;
                
                // Get state after sending event (may be async, so we capture it immediately)
                if (targetActor.getSnapshot) {
                  // XState v5 actor
                  const snapshot = targetActor.getSnapshot();
                  result.stateAfter = {
                    value: snapshot.value,
                    context: snapshot.context,
                    tags: snapshot.tags || []
                  };
                } else if (targetActor.state) {
                  // XState v4 interpreter
                  result.stateAfter = {
                    value: targetActor.state.value,
                    context: targetActor.state.context,
                    nextEvents: targetActor.state.nextEvents || []
                  };
                }
                
                // Check if state actually changed
                const stateChanged = JSON.stringify(result.stateBefore?.value) !== 
                                   JSON.stringify(result.stateAfter?.value);
                const contextChanged = JSON.stringify(result.stateBefore?.context) !== 
                                     JSON.stringify(result.stateAfter?.context);
                
                result.changes = {
                  stateChanged,
                  contextChanged,
                  transitioned: stateChanged || contextChanged
                };
                
              } catch (error) {
                result.error = error.message;
                result.errorType = error.name;
              }
              
              return result;
            })()
          `;

          const result = await withScriptExecution(sendEventScript, context);

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
            machineId: { 
              type: 'string', 
              description: 'Specific actor/machine ID to send event to'
            },
            event: { 
              type: 'string', 
              description: 'Event type to send'
            },
            payload: { 
              description: 'Additional event payload data'
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: ['event']
        }
      )
    );

    // Register xstate_visualize_machine tool
    this.registerTool({
      name: 'xstate_visualize_machine',
      description: 'Generate visualization data for XState machine state charts',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            machineId: obj.machineId,
            format: obj.format || 'mermaid',
            includeActions: typeof obj.includeActions === 'boolean' ? obj.includeActions : false,
            includeGuards: typeof obj.includeGuards === 'boolean' ? obj.includeGuards : false,
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
          machineId: { 
            type: 'string', 
            description: 'Specific machine ID to visualize'
          },
          format: { 
            type: 'string', 
            enum: ['mermaid', 'dot', 'json'],
            description: 'Output format for visualization',
            default: 'mermaid'
          },
          includeActions: { 
            type: 'boolean', 
            description: 'Include actions in visualization',
            default: false
          },
          includeGuards: { 
            type: 'boolean', 
            description: 'Include guards in visualization',
            default: false
          },
          sessionId: { 
            type: 'string', 
            description: 'Optional Chrome session ID'
          }
        },
        required: []
      },
      handler: async (args, context) => {
        const visualizationScript = `
          (function() {
            const machineId = '${args.machineId || ''}';
            const format = '${args.format || 'mermaid'}';
            const includeActions = ${args.includeActions === true};
            const includeGuards = ${args.includeGuards === true};
            
            // Find machine to visualize
            let machine = null;
            let machineName = machineId;
            
            if (machineId && window[machineId]) {
              machine = window[machineId];
            } else {
              // Find first available machine
              const possibleMachines = ['machine', 'stateMachine', 'authMachine'];
              for (const name of possibleMachines) {
                if (window[name] && (window[name].states || window[name].config)) {
                  machine = window[name];
                  machineName = name;
                  break;
                }
              }
            }
            
            if (!machine) {
              return {
                error: 'No XState machine found for visualization',
                suggestions: ['Ensure machine is globally accessible', 'Check machine ID']
              };
            }
            
            const states = machine.states || machine.config?.states || {};
            const initial = machine.initial || machine.config?.initial;
            
            if (format === 'mermaid') {
              let mermaidDiagram = 'stateDiagram-v2\\n';
              
              // Add initial state
              if (initial) {
                mermaidDiagram += \`    [*] --> \${initial}\\n\`;
              }
              
              // Add states and transitions
              Object.entries(states).forEach(([stateName, stateConfig]) => {
                if (stateConfig.on) {
                  Object.entries(stateConfig.on).forEach(([event, transition]) => {
                    const target = Array.isArray(transition) ? 
                      transition[0].target || transition[0] : 
                      transition.target || transition;
                    
                    let label = event;
                    if (includeGuards && transition.cond) {
                      label += \` [guard]\`;
                    }
                    if (includeActions && transition.actions) {
                      label += \` / actions\`;
                    }
                    
                    mermaidDiagram += \`    \${stateName} --> \${target} : \${label}\\n\`;
                  });
                }
                
                // Add final states
                if (stateConfig.type === 'final') {
                  mermaidDiagram += \`    \${stateName} --> [*]\\n\`;
                }
              });
              
              return {
                format: 'mermaid',
                machine: machineName,
                visualization: mermaidDiagram,
                states: Object.keys(states),
                transitions: Object.values(states).reduce((acc, state) => 
                  acc + (state.on ? Object.keys(state.on).length : 0), 0)
              };
            }
            
            if (format === 'json') {
              return {
                format: 'json',
                machine: machineName,
                visualization: {
                  id: machine.id || machineName,
                  initial,
                  states: Object.entries(states).map(([name, config]) => ({
                    name,
                    type: config.type || 'atomic',
                    transitions: config.on ? Object.keys(config.on) : [],
                    entry: config.entry ? (Array.isArray(config.entry) ? config.entry.length : 1) : 0,
                    exit: config.exit ? (Array.isArray(config.exit) ? config.exit.length : 1) : 0
                  }))
                }
              };
            }
            
            return {
              error: \`Unsupported format: \${format}\`,
              supportedFormats: ['mermaid', 'json']
            };
          })()
        `;

        const result = await withScriptExecution(visualizationScript, context);

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

export class XStateToolProviderFactory extends BaseProviderFactory<XStateToolProvider> {
  create(deps: ProviderDependencies): XStateToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'xstate',
      description: 'XState finite state machine debugging and inspection tools'
    };

    return new XStateToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}