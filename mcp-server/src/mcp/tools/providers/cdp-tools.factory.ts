/**
 * CDP Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for CDP tool provider
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import type { SessionId } from '@curupira/shared/types';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions
const evaluateSchema: Schema<{ expression: string; sessionId?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.expression !== 'string') {
      throw new Error('expression must be a string');
    }
    return {
      expression: obj.expression,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: evaluateSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const navigateSchema: Schema<{ url: string; sessionId?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.url !== 'string') {
      throw new Error('url must be a string');
    }
    return {
      url: obj.url,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: navigateSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class CDPToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register cdp_evaluate tool
    this.registerTool(
      this.createTool(
        'cdp_evaluate',
        'Evaluate JavaScript expression in the browser context',
        evaluateSchema,
        async (args, context) => {
          const result = await withScriptExecution(
            args.expression,
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
            data: result.unwrap()
          };
        }
      )
    );

    // Register cdp_navigate tool
    this.registerTool(
      this.createTool(
        'cdp_navigate', 
        'Navigate to a URL',
        navigateSchema,
        async (args, context) => {
          const result = await withCDPCommand(
            'Page.navigate',
            { url: args.url },
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
            data: result.unwrap()
          };
        }
      )
    );

    // Register cdp_get_cookies tool
    this.registerTool({
      name: 'cdp_get_cookies',
      description: 'Get browser cookies',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Network.getCookies',
          {},
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
          data: result.unwrap()
        };
      }
    });
  }
}

export class CDPToolProviderFactory extends BaseProviderFactory<CDPToolProvider> {
  create(deps: ProviderDependencies): CDPToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'cdp',
      description: 'Chrome DevTools Protocol tools'
    };

    return new CDPToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}