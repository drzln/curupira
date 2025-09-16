/**
 * Tests for React Tool Provider with Dependency Injection
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReactToolProviderFactory } from '../../../mcp/tools/providers/react-tools.factory.js';
import { createTestContainer, resetTestContainer } from '../../test-container.js';
import type { Container } from '../../../core/di/container.js';
import type { MockChromeService } from '../../mocks/chrome-service.mock.js';
import type { MockLogger } from '../../mocks/logger.mock.js';
import type { MockValidator } from '../../mocks/validator.mock.js';
import { ChromeServiceToken, LoggerToken, ValidatorToken } from '../../../core/di/tokens.js';

describe('ReactToolProvider with DI', () => {
  let container: Container;
  let chromeService: MockChromeService;
  let logger: MockLogger;
  let validator: MockValidator;
  let factory: ReactToolProviderFactory;
  let provider: any;

  beforeEach(() => {
    container = createTestContainer();
    chromeService = container.resolve(ChromeServiceToken) as MockChromeService;
    logger = container.resolve(LoggerToken) as MockLogger;
    validator = container.resolve(ValidatorToken) as MockValidator;
    
    factory = new ReactToolProviderFactory();
    provider = factory.create({
      chromeService,
      logger,
      validator
    });
  });

  afterEach(() => {
    resetTestContainer(container);
  });

  describe('listTools', () => {
    it('should return all React tools', () => {
      const tools = provider.listTools();
      
      expect(tools).toHaveLength(4); // Our new provider has 4 tools
      
      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('react_detect');
      expect(toolNames).toContain('react_component_tree');
      expect(toolNames).toContain('react_find_component');
      expect(toolNames).toContain('react_profiler');
    });

    it('should have proper tool metadata', () => {
      const tools = provider.listTools();
      
      tools.forEach((tool: any) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
      });
    });
  });

  describe('react_detect tool', () => {
    it('should detect React presence', async () => {
      // Mock the chrome client to return a successful evaluation
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          result: {
            type: 'object',
            value: {
              detected: true,
              version: '18.2.0',
              devToolsAvailable: true
            }
          }
        })
      };
      chromeService.getCurrentClient = vi.fn().mockReturnValue(mockClient);

      const handler = provider.getHandler('react_detect');
      expect(handler).toBeDefined();

      const result = await handler.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        detected: true,
        version: '18.2.0',
        devToolsAvailable: true
      });
    });

    it('should handle when React is not detected', async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          result: {
            type: 'object',
            value: {
              detected: false
            }
          }
        })
      };
      chromeService.getCurrentClient = vi.fn().mockReturnValue(mockClient);

      const handler = provider.getHandler('react_detect');
      const result = await handler.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        detected: false
      });
    });
  });

  describe('react_component_tree tool', () => {
    it('should get component tree with default depth', async () => {
      const mockTree = {
        type: 'App',
        props: ['className', 'children'],
        children: [
          {
            type: 'Header',
            props: ['title'],
            children: []
          }
        ]
      };

      const mockClient = {
        send: vi.fn().mockResolvedValue({
          result: {
            type: 'object',
            value: mockTree
          }
        })
      };
      chromeService.getCurrentClient = vi.fn().mockReturnValue(mockClient);

      const handler = provider.getHandler('react_component_tree');
      const result = await handler.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTree);
    });

    it('should respect custom depth parameter', async () => {
      const mockClient = {
        send: vi.fn()
      };
      chromeService.getCurrentClient = vi.fn().mockReturnValue(mockClient);

      const handler = provider.getHandler('react_component_tree');
      await handler.execute({ depth: 5 });
      
      // Check that the script includes the depth parameter
      const callArgs = mockClient.send.mock.calls[0];
      expect(callArgs[1].expression).toContain('maxDepth = 5');
    });
  });

  describe('react_find_component tool', () => {
    it('should find components by name', async () => {
      const mockResults = {
        found: 2,
        components: [
          {
            name: 'Button',
            path: 'App > Layout > Button',
            props: ['onClick', 'disabled'],
            state: 'No state'
          },
          {
            name: 'SubmitButton',
            path: 'App > Form > SubmitButton',
            props: ['onClick', 'loading'],
            state: 'Has state'
          }
        ]
      };

      const mockClient = {
        send: vi.fn().mockResolvedValue({
          result: {
            type: 'object',
            value: mockResults
          }
        })
      };
      chromeService.getCurrentClient = vi.fn().mockReturnValue(mockClient);

      const handler = provider.getHandler('react_find_component');
      const result = await handler.execute({ name: 'Button' });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResults);
    });

    it('should validate name parameter is required', async () => {
      const handler = provider.getHandler('react_find_component');
      const result = await handler.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });

  describe('react_profiler tool', () => {
    it('should enable profiler', async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          result: {
            type: 'object',
            value: {
              message: 'React profiler enabled'
            }
          }
        })
      };
      chromeService.getCurrentClient = vi.fn().mockReturnValue(mockClient);

      const handler = provider.getHandler('react_profiler');
      const result = await handler.execute({ enabled: true });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: 'React profiler enabled'
      });
    });

    it('should disable profiler and return data', async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          result: {
            type: 'object',
            value: {
              message: 'React profiler disabled',
              data: 'Profiling data available'
            }
          }
        })
      };
      chromeService.getCurrentClient = vi.fn().mockReturnValue(mockClient);

      const handler = provider.getHandler('react_profiler');
      const result = await handler.execute({ enabled: false });
      
      expect(result.success).toBe(true);
      expect(result.data.message).toBe('React profiler disabled');
      expect(result.data.data).toBe('Profiling data available');
    });
  });

  describe('error handling', () => {
    it('should handle Chrome not connected', async () => {
      chromeService.getCurrentClient = vi.fn().mockReturnValue(null);

      const handler = provider.getHandler('react_detect');
      const result = await handler.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not connected to Chrome');
    });

    it('should handle script execution errors', async () => {
      const mockClient = {
        send: vi.fn().mockRejectedValue(new Error('Script execution failed'))
      };
      chromeService.getCurrentClient = vi.fn().mockReturnValue(mockClient);

      const handler = provider.getHandler('react_detect');
      const result = await handler.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Script execution failed');
    });
  });
});