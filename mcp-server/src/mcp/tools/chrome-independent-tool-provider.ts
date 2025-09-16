/**
 * Chrome Independent Tool Provider - Level 2 (MCP Core)
 * Base class for tool providers that don't require Chrome connection
 */

import type { SessionId } from '@curupira/shared/types';
import { Result } from '../../core/result.js';
import { BaseToolProvider, type BaseToolProviderConfig, type ExecutionContext } from './base-tool-provider.js';
import type { IChromeService } from '../../core/interfaces/chrome-service.interface.js';
import type { ILogger } from '../../core/interfaces/logger.interface.js';
import type { IValidator } from '../../core/interfaces/validator.interface.js';

export abstract class ChromeIndependentToolProvider<TConfig extends BaseToolProviderConfig = BaseToolProviderConfig> 
  extends BaseToolProvider<TConfig> {
  
  constructor(
    chromeService: IChromeService,
    logger: ILogger,
    validator: IValidator,
    config: TConfig
  ) {
    super(chromeService, logger, validator, config);
  }

  /**
   * Override getOrCreateSession to not require Chrome connection
   * Tools that need Chrome will handle connection internally
   */
  protected async getOrCreateSession(
    sessionId?: string
  ): Promise<Result<{ sessionId: SessionId; client: any }, never>> {
    // Return a pending session without Chrome client
    // Individual tools will handle Chrome connection as needed
    const pendingSessionId = (sessionId || 'pending') as SessionId;

    return Result.ok({
      sessionId: pendingSessionId,
      client: null // No client required for Chrome-independent tools
    });
  }

  /**
   * Create execution context without Chrome client requirement
   */
  protected createIndependentContext(sessionId?: string): ExecutionContext {
    return {
      sessionId: (sessionId || 'pending') as SessionId,
      chromeClient: null,
      logger: this.logger
    };
  }
}