/**
 * XState Tool Provider - Tools for debugging XState state machines
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import type { XStateActorArgs, XStateEventArgs } from '../types.js'
import { BaseToolProvider } from './base.js'

export class XStateToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'xstate'
  
  listTools(): Tool[] {
    return [
      {
        name: 'xstate_inspect_actor',
        description: 'Inspect XState actor state',
        inputSchema: {
          type: 'object',
          properties: {
            actorId: { type: 'string', description: 'Actor ID' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['actorId']
        }
      },
      {
        name: 'xstate_send_event',
        description: 'Send event to XState actor',
        inputSchema: {
          type: 'object',
          properties: {
            actorId: { type: 'string', description: 'Actor ID' },
            event: { type: 'object', description: 'Event object' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['actorId', 'event']
        }
      },
      {
        name: 'xstate_list_actors',
        description: 'List all XState actors',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'xstate_inspect_machine',
        description: 'Inspect XState machine definition',
        inputSchema: {
          type: 'object',
          properties: {
            actorId: { type: 'string', description: 'Actor ID' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['actorId']
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const handlers: Record<string, ToolHandler> = {
      xstate_inspect_actor: {
        name: 'xstate_inspect_actor',
        description: 'Inspect XState actor state',
        async execute(args): Promise<ToolResult> {
          try {
            const { actorId, sessionId: argSessionId } = args as XStateActorArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const script = `
              (() => {
                if (!window.__xstate__ || !window.__xstate__.actors) {
                  return { error: 'XState actors not found. Make sure XState devtools is enabled.' }
                }
                
                const actor = window.__xstate__.actors.get('${actorId}')
                if (!actor) {
                  return { 
                    error: 'Actor not found', 
                    availableActors: Array.from(window.__xstate__.actors.keys())
                  }
                }
                
                const snapshot = actor.getSnapshot()
                
                return {
                  actorId: '${actorId}',
                  state: {
                    value: snapshot.value,
                    context: snapshot.context,
                    status: snapshot.status,
                    error: snapshot.error,
                    tags: Array.from(snapshot.tags || []),
                    done: snapshot.done
                  },
                  machine: {
                    id: actor.machine?.id,
                    version: actor.machine?.version,
                    states: actor.machine?.states ? Object.keys(actor.machine.states) : []
                  }
                }
              })()
            `
            
            const result = await this.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string }
            // For consistency with other tools, return success: true even with error data
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to inspect actor'
            }
          }
        }
      },
      
      xstate_send_event: {
        name: 'xstate_send_event',
        description: 'Send event to XState actor',
        async execute(args): Promise<ToolResult> {
          try {
            const { actorId, event, sessionId: argSessionId } = args as XStateEventArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const script = `
              (() => {
                if (!window.__xstate__ || !window.__xstate__.actors) {
                  return { error: 'XState actors not found' }
                }
                
                const actor = window.__xstate__.actors.get('${actorId}')
                if (!actor) {
                  return { 
                    error: 'Actor not found', 
                    availableActors: Array.from(window.__xstate__.actors.keys())
                  }
                }
                
                const previousSnapshot = actor.getSnapshot()
                const previousState = {
                  value: previousSnapshot.value,
                  context: previousSnapshot.context
                }
                
                // Send the event
                actor.send(${JSON.stringify(event)})
                
                // Get new state after event
                const newSnapshot = actor.getSnapshot()
                const newState = {
                  value: newSnapshot.value,
                  context: newSnapshot.context,
                  status: newSnapshot.status,
                  error: newSnapshot.error
                }
                
                return {
                  success: true,
                  event: ${JSON.stringify(event)},
                  previousState,
                  newState,
                  transition: {
                    changed: previousSnapshot.value !== newSnapshot.value,
                    actions: newSnapshot.actions || []
                  }
                }
              })()
            `
            
            const result = await this.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string; success?: boolean }
            // For consistency with other tools, return success: true even with error data
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to send event'
            }
          }
        }
      },
      
      xstate_list_actors: {
        name: 'xstate_list_actors',
        description: 'List all XState actors',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const script = `
              (() => {
                if (!window.__xstate__ || !window.__xstate__.actors) {
                  return { error: 'XState actors not found' }
                }
                
                const actors = []
                window.__xstate__.actors.forEach((actor, id) => {
                  const snapshot = actor.getSnapshot()
                  actors.push({
                    id,
                    state: snapshot.value,
                    status: snapshot.status,
                    machineId: actor.machine?.id
                  })
                })
                
                return { actors }
              })()
            `
            
            const result = await this.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string }
            // For consistency with other tools, return success: true even with error data
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to list actors'
            }
          }
        }
      },
      
      xstate_inspect_machine: {
        name: 'xstate_inspect_machine',
        description: 'Inspect XState machine definition',
        async execute(args): Promise<ToolResult> {
          try {
            const { actorId, sessionId: argSessionId } = args as XStateActorArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const script = `
              (() => {
                if (!window.__xstate__ || !window.__xstate__.actors) {
                  return { error: 'XState actors not found' }
                }
                
                const actor = window.__xstate__.actors.get('${actorId}')
                if (!actor) {
                  return { error: 'Actor not found' }
                }
                
                const machine = actor.machine
                if (!machine) {
                  return { error: 'Machine definition not available' }
                }
                
                // Extract machine definition
                const definition = {
                  id: machine.id,
                  version: machine.version,
                  type: machine.type,
                  initial: machine.initial,
                  states: {}
                }
                
                // Extract states and transitions
                if (machine.states) {
                  Object.entries(machine.states).forEach(([stateName, stateNode]) => {
                    definition.states[stateName] = {
                      type: stateNode.type,
                      on: stateNode.on ? Object.keys(stateNode.on) : [],
                      entry: stateNode.entry ? stateNode.entry.length : 0,
                      exit: stateNode.exit ? stateNode.exit.length : 0,
                      invoke: stateNode.invoke ? stateNode.invoke.length : 0
                    }
                  })
                }
                
                return {
                  actorId: '${actorId}',
                  machine: definition
                }
              })()
            `
            
            const result = await this.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string }
            // For consistency with other tools, return success: true even with error data
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to inspect machine'
            }
          }
        }
      }
    }
    
    const handler = handlers[toolName]
    if (handler) {
      // Bind the execute method to this instance to preserve context
      return {
        ...handler,
        execute: handler.execute.bind(this)
      }
    }
    return undefined
  }
}