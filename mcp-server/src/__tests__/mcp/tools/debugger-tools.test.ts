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
      expect(toolNames).toContain('debugger_enable')
      expect(toolNames).toContain('debugger_disable')
      expect(toolNames).toContain('debugger_set_breakpoint')
      expect(toolNames).toContain('debugger_remove_breakpoint')
      expect(toolNames).toContain('debugger_set_breakpoint_by_url')
      expect(toolNames).toContain('debugger_pause')
      expect(toolNames).toContain('debugger_resume')
      expect(toolNames).toContain('debugger_step_over')
      expect(toolNames).toContain('debugger_step_into')
      expect(toolNames).toContain('debugger_step_out')
    })
  })

  describe('debugger_enable', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_enable')!

    it('should enable debugger', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.enable

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.enable',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { enabled: true },
      })
    })
  })

  describe('debugger_disable', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_disable')!

    it('should disable debugger', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.disable

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.disable',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { enabled: false },
      })
    })
  })

  describe('debugger_set_breakpoint', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_set_breakpoint')!

    it('should set breakpoint at location', async () => {
      const mockBreakpointId = 'breakpoint:1:0:100'
      const mockLocation = {
        scriptId: '123',
        lineNumber: 100,
        columnNumber: 0,
      }
      
      mockChromeClient.send.mockResolvedValueOnce(
        createCDPResponse({
          breakpointId: mockBreakpointId,
          actualLocation: mockLocation,
        })
      )

      const result = await handler.execute({
        location: mockLocation,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.setBreakpoint',
        { location: mockLocation },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          breakpointId: mockBreakpointId,
          actualLocation: mockLocation,
        },
      })
    })

    it('should set conditional breakpoint', async () => {
      const mockBreakpointId = 'breakpoint:1:0:50'
      const location = {
        scriptId: '123',
        lineNumber: 50,
      }
      const condition = 'x > 10'
      
      mockChromeClient.send.mockResolvedValueOnce(
        createCDPResponse({
          breakpointId: mockBreakpointId,
          actualLocation: { ...location, columnNumber: 0 },
        })
      )

      const result = await handler.execute({
        location,
        condition,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.setBreakpoint',
        { location, condition },
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('debugger_remove_breakpoint', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_remove_breakpoint')!

    it('should remove breakpoint', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.removeBreakpoint

      const breakpointId = 'breakpoint:1:0:100'
      const result = await handler.execute({ breakpointId })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.removeBreakpoint',
        { breakpointId },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { removed: breakpointId },
      })
    })
  })

  describe('debugger_set_breakpoint_by_url', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_set_breakpoint_by_url')!

    it('should set breakpoint by URL and line', async () => {
      const mockBreakpointId = 'breakpoint:url:1'
      const mockLocations = [
        {
          scriptId: '123',
          lineNumber: 42,
          columnNumber: 0,
        },
      ]
      
      mockChromeClient.send.mockResolvedValueOnce(
        createCDPResponse({
          breakpointId: mockBreakpointId,
          locations: mockLocations,
        })
      )

      const result = await handler.execute({
        url: 'https://example.com/app.js',
        lineNumber: 42,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.setBreakpointByUrl',
        {
          url: 'https://example.com/app.js',
          lineNumber: 42,
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          breakpointId: mockBreakpointId,
          locations: mockLocations,
        },
      })
    })

    it('should set breakpoint by URL regex', async () => {
      const mockBreakpointId = 'breakpoint:regex:1'
      mockChromeClient.send.mockResolvedValueOnce(
        createCDPResponse({
          breakpointId: mockBreakpointId,
          locations: [],
        })
      )

      const result = await handler.execute({
        urlRegex: '.*\\.js$',
        lineNumber: 100,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.setBreakpointByUrl',
        {
          urlRegex: '.*\\.js$',
          lineNumber: 100,
        },
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('debugger_pause', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_pause')!

    it('should pause execution', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.pause

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.pause',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { paused: true },
      })
    })
  })

  describe('debugger_resume', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_resume')!

    it('should resume execution', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.resume

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.resume',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { resumed: true },
      })
    })
  })

  describe('debugger_step_over', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_step_over')!

    it('should step over', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.stepOver

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.stepOver',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { action: 'stepOver' },
      })
    })
  })

  describe('debugger_step_into', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_step_into')!

    it('should step into', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.stepInto

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.stepInto',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { action: 'stepInto' },
      })
    })
  })

  describe('debugger_step_out', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_step_out')!

    it('should step out', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Debugger.stepOut

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Debugger.stepOut',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { action: 'stepOut' },
      })
    })
  })

  describe('error handling', () => {
    const handler = new DebuggerToolProvider().getHandler('debugger_set_breakpoint')!

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Debugger not enabled'))

      const result = await handler.execute({
        location: {
          scriptId: '123',
          lineNumber: 100,
        },
      })

      expect(result).toEqual({
        success: false,
        error: 'Debugger not enabled',
      })
    })

    it('should handle invalid script ID', async () => {
      mockChromeClient.send.mockResolvedValueOnce(
        createCDPError('Script not found')
      )

      const result = await handler.execute({
        location: {
          scriptId: 'invalid',
          lineNumber: 100,
        },
      })

      expect(result).toEqual({
        success: false,
        error: 'Script not found',
      })
    })
  })
})