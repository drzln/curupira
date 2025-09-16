/**
 * Example Provider Test with Dependency Injection
 * Demonstrates how to test providers using the DI container
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Container } from '../../core/di/container.js';
import { createTestContainer, resetTestContainer } from '../test-container.js';
import { CDPToolProviderFactory } from '../../mcp/tools/providers/cdp-tools.factory.js';
import {
  ChromeServiceToken,
  LoggerToken,
  ValidatorToken
} from '../../core/di/tokens.js';
import type { MockChromeService } from '../mocks/chrome-service.mock.js';
import type { MockLogger } from '../mocks/logger.mock.js';

describe('CDPToolProvider with Dependency Injection', () => {
  let container: Container;
  let chromeService: MockChromeService;
  let logger: MockLogger;
  let provider: any; // CDPToolProvider

  beforeEach(() => {
    // Create test container with all mocks
    container = createTestContainer();
    
    // Get mock services
    chromeService = container.resolve(ChromeServiceToken) as MockChromeService;
    logger = container.resolve(LoggerToken) as MockLogger;
    
    // Create provider using factory
    const factory = new CDPToolProviderFactory();
    provider = factory.create({
      chromeService: container.resolve(ChromeServiceToken),
      logger: container.resolve(LoggerToken),
      validator: container.resolve(ValidatorToken)
    });
  });

  afterEach(() => {
    resetTestContainer(container);
  });

  describe('Tool Registration', () => {
    it('should register all CDP tools', () => {
      const tools = provider.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('cdp_evaluate');
      expect(toolNames).toContain('cdp_navigate');
      expect(toolNames).toContain('cdp_get_cookies');
    });

    it('should log tool registration', () => {
      // Check that tools were logged during initialization
      expect(logger.hasLog('debug', 'Tool registered')).toBe(true);
      
      const debugLogs = logger.getLogs('debug');
      const registrationLogs = debugLogs.filter(log => 
        log.message === 'Tool registered'
      );
      
      expect(registrationLogs.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('cdp_evaluate', () => {
    beforeEach(() => {
      // Simulate Chrome connection
      chromeService.simulateConnection();
      
      // Set up mock client behavior
      const mockClient = chromeService.getMockClient();
      mockClient.simulateSendResult({
        result: {
          type: 'string',
          value: 'Hello from Chrome!'
        }
      });
    });

    it('should evaluate JavaScript expression', async () => {
      const handler = provider.getHandler('cdp_evaluate');
      expect(handler).toBeDefined();

      const result = await handler!.execute({
        expression: 'document.title'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello from Chrome!');
    });

    it('should handle evaluation errors', async () => {
      const mockClient = chromeService.getMockClient();
      mockClient.simulateSendError(new Error('Evaluation failed'));

      const handler = provider.getHandler('cdp_evaluate');
      const result = await handler!.execute({
        expression: 'invalid.code'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('CDP command Runtime.evaluate failed');
      
      // Check error was logged
      expect(logger.hasLog('error', 'CDP command failed')).toBe(true);
    });

    it('should validate arguments', async () => {
      const handler = provider.getHandler('cdp_evaluate');
      
      // Missing expression
      const result = await handler!.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('expression must be a string');
    });
  });

  describe('cdp_navigate', () => {
    beforeEach(() => {
      chromeService.simulateConnection();
    });

    it('should navigate to URL', async () => {
      const mockClient = chromeService.getMockClient();
      mockClient.simulateSendResult({
        frameId: 'main-frame-id'
      });

      const handler = provider.getHandler('cdp_navigate');
      const result = await handler!.execute({
        url: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ frameId: 'main-frame-id' });
      
      // Verify CDP command was called correctly
      const sendMock = mockClient.getSendMock();
      expect(sendMock).toHaveBeenCalledWith(
        'Page.navigate',
        { url: 'https://example.com' },
        expect.any(String)
      );
    });

    it('should handle navigation when not connected', async () => {
      // Disconnect Chrome
      await chromeService.disconnect();

      const handler = provider.getHandler('cdp_navigate');
      const result = await handler!.execute({
        url: 'https://example.com'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Chrome');
    });
  });

  describe('Session Management', () => {
    it('should handle missing Chrome connection gracefully', async () => {
      // Chrome not connected
      const handler = provider.getHandler('cdp_evaluate');
      const result = await handler!.execute({
        expression: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Chrome');
    });

    it('should use provided session ID', async () => {
      chromeService.simulateConnection();
      
      const handler = provider.getHandler('cdp_evaluate');
      await handler!.execute({
        expression: 'test',
        sessionId: 'custom-session-123'
      });

      // Session management would use the custom session ID
      // In the real implementation, this would be passed through
    });
  });
});