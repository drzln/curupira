/**
 * Tests for Debugger Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DebuggerToolProvider } from '../../../mcp/tools/providers/debugger-tools.js'
import { ChromeManager } from '../../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, createCDPResponse, createCDPError, testSessionId } from '../../setup.js'

// Mock ChromeManager
vi.mock('../../../chrome/manager.js', () => ({
  ChromeManager: {
    getInstance: vi.fn(() => ({
      getClient: () => mockChromeClient,
    })),
  },
}))

// Mock BaseToolProvider
vi.mock('../../../mcp/tools/providers/base.js', () => ({
  BaseToolProvider: class {
    async getSessionId(argSessionId?: string) {
      return argSessionId || testSessionId
    }
  }
}))

describe('DebuggerToolProvider', () => {
  let provider: DebuggerToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new DebuggerToolProvider()
  })

  describe('listTools', () => {
    it('should return all debugger tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(10)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('debugger_set_breakpoint')
      expect(toolNames).toContain('debugger_remove_breakpoint')
      expect(toolNames).toContain('debugger_pause')
      expect(toolNames).toContain('debugger_resume')
      expect(toolNames).toContain('debugger_step_over')
      expect(toolNames).toContain('debugger_step_into')
      expect(toolNames).toContain('debugger_step_out')
      expect(toolNames).toContain('debugger_get_call_stack')
      expect(toolNames).toContain('debugger_evaluate_on_call_frame')
      expect(toolNames).toContain('debugger_get_scope_variables')
    })
  })

  describe('debugger_set_breakpoint', () => {

    it('should set breakpoint by URL', async () => {
      const mockBreakpointId = 'breakpoint:1:0:100'
      const mockLocations = [{
        scriptId: '123',
        lineNumber: 100,
        columnNumber: 0,
      }]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Debugger.enable
        .mockResolvedValueOnce({
          breakpointId: mockBreakpointId,
          locations: mockLocations,
        }) // Debugger.setBreakpointByUrl

      const handler = provider.getHandler('debugger_set_breakpoint')!

      const result = await handler.execute({
        url: 'https://example.com/app.js',
        lineNumber: 100,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.enable',
        {},
        testSessionId
      )
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.setBreakpointByUrl',
        {
          url: 'https://example.com/app.js',
          lineNumber: 100,
          columnNumber: undefined,
          condition: undefined
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          breakpointId: mockBreakpointId,
          locations: mockLocations,
          url: 'https://example.com/app.js',
          lineNumber: 100
        },
      })
    })

    it('should set conditional breakpoint', async () => {
      const mockBreakpointId = 'breakpoint:1:0:50'
      const mockLocations = [{
        scriptId: '123',
        lineNumber: 50,
        columnNumber: 0,
      }]
      const condition = 'x > 10'
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Debugger.enable
        .mockResolvedValueOnce({
          breakpointId: mockBreakpointId,
          locations: mockLocations,
        })

      const handler = provider.getHandler('debugger_set_breakpoint')!

      const result = await handler.execute({
        url: 'https://example.com/app.js',
        lineNumber: 50,
        condition,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.setBreakpointByUrl',
        {
          url: 'https://example.com/app.js',
          lineNumber: 50,
          columnNumber: undefined,
          condition
        },
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('debugger_remove_breakpoint', () => {

    it('should remove breakpoint', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.removeBreakpoint

      const breakpointId = 'breakpoint:1:0:100'
      const handler = provider.getHandler('debugger_remove_breakpoint')!

      const result = await handler.execute({ breakpointId })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.removeBreakpoint',
        { breakpointId },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          breakpointId,
          removed: true
        },
      })
    })
  })

  describe('debugger_pause', () => {

    it('should pause execution', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Debugger.enable
        .mockResolvedValueOnce(undefined) // Debugger.pause

      const handler = provider.getHandler('debugger_pause')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.enable',
        {},
        testSessionId
      )
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.pause',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          paused: true,
          timestamp: expect.any(String)
        },
      })
    })
  })

  describe('debugger_resume', () => {

    it('should resume execution', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.resume

      const handler = provider.getHandler('debugger_resume')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.resume',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          resumed: true,
          timestamp: expect.any(String)
        },
      })
    })
  })

  describe('debugger_step_over', () => {

    it('should step over', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.stepOver

      const handler = provider.getHandler('debugger_step_over')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.stepOver',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          stepped: 'over',
          timestamp: expect.any(String)
        },
      })
    })
  })

  describe('debugger_step_into', () => {

    it('should step into', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.stepInto

      const handler = provider.getHandler('debugger_step_into')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.stepInto',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          stepped: 'into',
          timestamp: expect.any(String)
        },
      })
    })
  })

  describe('debugger_step_out', () => {

    it('should step out', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.stepOut

      const handler = provider.getHandler('debugger_step_out')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.stepOut',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          stepped: 'out',
          timestamp: expect.any(String)
        },
      })
    })
  })

  describe('debugger_get_call_stack', () => {

    it('should get call stack when paused', async () => {
      const mockCallFrames = [
        {
          callFrameId: 'frame-1',
          functionName: 'myFunction',
          url: 'https://example.com/app.js',
          location: { lineNumber: 42, columnNumber: 0 },
          scopeChain: [
            { type: 'local', name: 'Local' },
            { type: 'closure', name: 'Closure' }
          ]
        }
      ]

      // Mock the pause event listener setup
      let pauseListener: (params: any) => void
      mockChromeClient.on = vi.fn((event, listener) => {
        if (event === 'Debugger.paused') {
          pauseListener = listener
          // Simulate paused event immediately
          setTimeout(() => {
            pauseListener({ callFrames: mockCallFrames })
          }, 0)
        }
      })

      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Debugger.pause
        .mockResolvedValueOnce(undefined) // Debugger.resume

      const handler = provider.getHandler('debugger_get_call_stack')!

      const result = await handler.execute({})

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        callStack: expect.arrayContaining([
          expect.objectContaining({
            functionName: 'myFunction',
            url: 'https://example.com/app.js',
            lineNumber: 42,
            columnNumber: 0,
            callFrameId: 'frame-1'
          })
        ]),
        depth: expect.any(Number)
      })
    })
  })

  describe('debugger_evaluate_on_call_frame', () => {

    it('should evaluate expression on call frame', async () => {
      const mockResult = {
        result: {
          type: 'number',
          value: 42,
          className: 'Number'
        }
      }

      mockChromeClient.send.mockResolvedValueOnce(mockResult)

      const handler = provider.getHandler('debugger_evaluate_on_call_frame')!

      const result = await handler.execute({
        callFrameId: 'frame-1',
        expression: 'x + y'
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.evaluateOnCallFrame',
        {
          callFrameId: 'frame-1',
          expression: 'x + y',
          returnByValue: true,
          generatePreview: true
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          result: 42,
          type: 'number',
          className: 'Number'
        }
      })
    })

    it('should handle evaluation errors', async () => {
      const mockError = {
        exceptionDetails: {
          text: 'ReferenceError: x is not defined'
        }
      }

      mockChromeClient.send.mockResolvedValueOnce(mockError)

      const handler = provider.getHandler('debugger_evaluate_on_call_frame')!

      const result = await handler.execute({
        callFrameId: 'frame-1',
        expression: 'undefinedVariable'
      })

      expect(result).toEqual({
        success: false,
        error: 'Evaluation error: ReferenceError: x is not defined',
        data: mockError.exceptionDetails
      })
    })
  })

  describe('debugger_get_scope_variables', () => {

    it('should return error when not paused', async () => {
      // No pause event listener setup means no target frame
      mockChromeClient.on = vi.fn()

      const handler = provider.getHandler('debugger_get_scope_variables')!

      const result = await handler.execute({
        callFrameId: 'frame-1'
      })

      expect(result).toEqual({
        success: false,
        error: 'Call frame not found. Debugger must be paused at this frame.'
      })
    })
  })

  describe('error handling', () => {

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Debugger not enabled'))

      const handler = provider.getHandler('debugger_set_breakpoint')!
      const result = await handler.execute({
        url: 'https://example.com/app.js',
        lineNumber: 100,
      })

      expect(result).toEqual({
        success: false,
        error: 'Debugger not enabled',
      })
    })

    it('should handle invalid script ID', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Debugger.enable
        .mockRejectedValueOnce(new Error('Script not found'))

      const handler = provider.getHandler('debugger_set_breakpoint')!
      const result = await handler.execute({
        url: 'invalid://script',
        lineNumber: 100,
      })

      expect(result).toEqual({
        success: false,
        error: 'Script not found',
      })
    })
  })
})