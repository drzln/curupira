/**
 * Screenshot Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Screenshot and visual debugging tools
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand } from '../patterns/common-handlers.js';
import { MinIOServiceToken } from '../../../core/di/tokens.js';
import type { IMinIOService } from '../../../infrastructure/storage/minio.service.js';

// Schema definitions
const screenshotSchema: Schema<{ 
  format?: string; 
  quality?: number; 
  fullPage?: boolean; 
  selector?: string;
  sessionId?: string 
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      format: obj.format === 'jpeg' ? 'jpeg' : 'png',
      quality: typeof obj.quality === 'number' ? Math.max(0, Math.min(100, obj.quality)) : 90,
      fullPage: obj.fullPage === true,
      selector: typeof obj.selector === 'string' ? obj.selector : undefined,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: screenshotSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const elementScreenshotSchema: Schema<{ 
  selector: string; 
  format?: string; 
  quality?: number;
  sessionId?: string 
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.selector !== 'string') {
      throw new Error('selector must be a string');
    }
    return {
      selector: obj.selector,
      format: obj.format === 'jpeg' ? 'jpeg' : 'png',
      quality: typeof obj.quality === 'number' ? Math.max(0, Math.min(100, obj.quality)) : 90,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: elementScreenshotSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class ScreenshotToolProvider extends BaseToolProvider {
  private readonly minioService: IMinIOService | null;

  constructor(
    chromeService: any,
    logger: any,
    validator: any,
    config: BaseToolProviderConfig,
    minioService: IMinIOService | null
  ) {
    super(chromeService, logger, validator, config);
    this.minioService = minioService;
  }

  /**
   * Store screenshot in MinIO and return URL
   */
  private async storeScreenshot(
    data: string,
    metadata: Record<string, string>
  ): Promise<{ stored: boolean; url?: string; error?: string }> {
    if (!this.minioService) {
      return { stored: false };
    }

    try {
      // Generate unique key
      const timestamp = Date.now();
      const format = metadata.format || 'png';
      const key = `screenshots/${timestamp}-${Math.random().toString(36).substring(7)}.${format}`;

      // Convert base64 to buffer
      const buffer = Buffer.from(data, 'base64');

      // Store in MinIO
      const result = await this.minioService.store(key, buffer, {
        'Content-Type': `image/${format}`,
        ...metadata
      });

      if (result.isOk()) {
        // Get signed URL
        const urlResult = await this.minioService.getSignedUrl(key);
        if (urlResult.isOk()) {
          return { stored: true, url: urlResult.unwrap() };
        }
      }

      return { stored: false, error: result.isErr() ? result.unwrapErr().message : 'Unknown error' };
    } catch (error) {
      this.logger.error({ error }, 'Failed to store screenshot in MinIO');
      return { stored: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  protected initializeTools(): void {
    // Register capture_screenshot tool
    this.registerTool(
      this.createTool(
        'capture_screenshot',
        'Capture a screenshot of the current page or viewport',
        screenshotSchema,
        async (args, context) => {
          const captureParams: any = {
            format: args.format,
            captureBeyondViewport: args.fullPage
          };

          if (args.format === 'jpeg') {
            captureParams.quality = args.quality;
          }

          const result = await withCDPCommand(
            'Page.captureScreenshot',
            captureParams,
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const screenshot = result.unwrap() as any;
          const timestamp = new Date().toISOString();

          // Try to store in MinIO
          const storeResult = await this.storeScreenshot(screenshot.data, {
            format: args.format || 'png',
            fullPage: String(args.fullPage),
            quality: String(args.quality),
            timestamp,
            type: 'full-page-screenshot'
          });

          if (storeResult.stored && storeResult.url) {
            // Return MinIO URL instead of base64 data
            return {
              success: true,
              data: {
                url: storeResult.url,
                format: args.format,
                fullPage: args.fullPage,
                quality: args.quality,
                timestamp,
                size: Buffer.from(screenshot.data, 'base64').length,
                stored: true
              }
            };
          }

          // Fallback to returning base64 data if MinIO is not available
          return {
            success: true,
            data: {
              image: screenshot.data,
              format: args.format,
              fullPage: args.fullPage,
              quality: args.quality,
              timestamp,
              stored: false,
              storageError: storeResult.error
            }
          };
        }
      )
    );

    // Register capture_element_screenshot tool
    this.registerTool(
      this.createTool(
        'capture_element_screenshot',
        'Capture a screenshot of a specific element',
        elementScreenshotSchema,
        async (args, context) => {
          // First, get the element by selector
          const elementResult = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: `document.querySelector('${args.selector}')`
            },
            context
          );

          if (elementResult.isErr()) {
            return {
              success: false,
              error: elementResult.unwrapErr()
            };
          }

          const element = elementResult.unwrap() as any;
          if (!element.result?.objectId) {
            return {
              success: false,
              error: `Element not found: ${args.selector}`
            };
          }

          // Get element bounding box
          const boxResult = await withCDPCommand(
            'DOM.getBoxModel',
            { objectId: element.result.objectId },
            context
          );

          if (boxResult.isErr()) {
            return {
              success: false,
              error: boxResult.unwrapErr()
            };
          }

          const box = boxResult.unwrap() as any;
          const content = box.model?.content;
          
          if (!content || content.length < 4) {
            return {
              success: false,
              error: 'Could not get element bounding box'
            };
          }

          // Calculate clip area from content box
          const clip = {
            x: Math.min(content[0], content[2], content[4], content[6]),
            y: Math.min(content[1], content[3], content[5], content[7]),
            width: Math.max(content[0], content[2], content[4], content[6]) - Math.min(content[0], content[2], content[4], content[6]),
            height: Math.max(content[1], content[3], content[5], content[7]) - Math.min(content[1], content[3], content[5], content[7]),
            scale: 1
          };

          const captureParams: any = {
            format: args.format,
            clip
          };

          if (args.format === 'jpeg') {
            captureParams.quality = args.quality;
          }

          const result = await withCDPCommand(
            'Page.captureScreenshot',
            captureParams,
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const screenshot = result.unwrap() as any;
          const timestamp = new Date().toISOString();

          // Try to store in MinIO
          const storeResult = await this.storeScreenshot(screenshot.data, {
            format: args.format || 'png',
            selector: args.selector,
            quality: String(args.quality),
            timestamp,
            bounds: JSON.stringify(clip),
            type: 'element-screenshot'
          });

          if (storeResult.stored && storeResult.url) {
            // Return MinIO URL instead of base64 data
            return {
              success: true,
              data: {
                url: storeResult.url,
                format: args.format,
                selector: args.selector,
                bounds: clip,
                quality: args.quality,
                timestamp,
                size: Buffer.from(screenshot.data, 'base64').length,
                stored: true
              }
            };
          }

          // Fallback to returning base64 data if MinIO is not available
          return {
            success: true,
            data: {
              image: screenshot.data,
              format: args.format,
              selector: args.selector,
              bounds: clip,
              quality: args.quality,
              timestamp,
              stored: false,
              storageError: storeResult.error
            }
          };
        }
      )
    );

    // Register capture_viewport tool
    this.registerTool({
      name: 'capture_viewport',
      description: 'Capture screenshot of current viewport only',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            format: obj.format === 'jpeg' ? 'jpeg' : 'png',
            quality: typeof obj.quality === 'number' ? Math.max(0, Math.min(100, obj.quality)) : 90,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return {
              success: true,
              data: {
                format: obj.format === 'jpeg' ? 'jpeg' : 'png',
                quality: typeof obj.quality === 'number' ? Math.max(0, Math.min(100, obj.quality)) : 90,
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const captureParams: any = {
          format: args.format,
          captureBeyondViewport: false
        };

        if (args.format === 'jpeg') {
          captureParams.quality = args.quality;
        }

        const result = await withCDPCommand(
          'Page.captureScreenshot',
          captureParams,
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const screenshot = result.unwrap() as any;
        const timestamp = new Date().toISOString();

        // Try to store in MinIO
        const storeResult = await this.storeScreenshot(screenshot.data, {
          format: args.format || 'png',
          viewport: 'true',
          quality: String(args.quality),
          timestamp,
          type: 'viewport-screenshot'
        });

        if (storeResult.stored && storeResult.url) {
          // Return MinIO URL instead of base64 data
          return {
            success: true,
            data: {
              url: storeResult.url,
              format: args.format,
              viewport: true,
              quality: args.quality,
              timestamp,
              size: Buffer.from(screenshot.data, 'base64').length,
              stored: true
            }
          };
        }

        // Fallback to returning base64 data if MinIO is not available
        return {
          success: true,
          data: {
            image: screenshot.data,
            format: args.format,
            viewport: true,
            quality: args.quality,
            timestamp,
            stored: false,
            storageError: storeResult.error
          }
        };
      }
    });

    // Register start_screencast tool
    this.registerTool({
      name: 'start_screencast',
      description: 'Start recording screen changes as a series of frames',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            format: obj.format === 'jpeg' ? 'jpeg' : 'png',
            quality: typeof obj.quality === 'number' ? Math.max(0, Math.min(100, obj.quality)) : 90,
            maxWidth: typeof obj.maxWidth === 'number' ? obj.maxWidth : 1280,
            maxHeight: typeof obj.maxHeight === 'number' ? obj.maxHeight : 720,
            everyNthFrame: typeof obj.everyNthFrame === 'number' ? obj.everyNthFrame : 1,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return {
              success: true,
              data: {
                format: obj.format === 'jpeg' ? 'jpeg' : 'png',
                quality: typeof obj.quality === 'number' ? Math.max(0, Math.min(100, obj.quality)) : 90,
                maxWidth: typeof obj.maxWidth === 'number' ? obj.maxWidth : 1280,
                maxHeight: typeof obj.maxHeight === 'number' ? obj.maxHeight : 720,
                everyNthFrame: typeof obj.everyNthFrame === 'number' ? obj.everyNthFrame : 1,
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const startParams: any = {
          format: args.format,
          maxWidth: args.maxWidth,
          maxHeight: args.maxHeight,
          everyNthFrame: args.everyNthFrame
        };

        if (args.format === 'jpeg') {
          startParams.quality = args.quality;
        }

        const result = await withCDPCommand(
          'Page.startScreencast',
          startParams,
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
          data: {
            recording: true,
            format: args.format,
            maxWidth: args.maxWidth,
            maxHeight: args.maxHeight,
            quality: args.quality,
            everyNthFrame: args.everyNthFrame,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register stop_screencast tool
    this.registerTool({
      name: 'stop_screencast',
      description: 'Stop screen recording',
      argsSchema: {
        parse: (value) => (value || {}),
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Page.stopScreencast',
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
          data: {
            recording: false,
            stopped: true,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register create_pdf tool
    this.registerTool({
      name: 'create_pdf',
      description: 'Generate PDF of the current page',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            landscape: obj.landscape === true,
            displayHeaderFooter: obj.displayHeaderFooter === true,
            printBackground: obj.printBackground !== false,
            scale: typeof obj.scale === 'number' ? Math.max(0.1, Math.min(2, obj.scale)) : 1,
            paperWidth: typeof obj.paperWidth === 'number' ? obj.paperWidth : undefined,
            paperHeight: typeof obj.paperHeight === 'number' ? obj.paperHeight : undefined,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return {
              success: true,
              data: {
                landscape: obj.landscape === true,
                displayHeaderFooter: obj.displayHeaderFooter === true,
                printBackground: obj.printBackground !== false,
                scale: typeof obj.scale === 'number' ? Math.max(0.1, Math.min(2, obj.scale)) : 1,
                paperWidth: typeof obj.paperWidth === 'number' ? obj.paperWidth : undefined,
                paperHeight: typeof obj.paperHeight === 'number' ? obj.paperHeight : undefined,
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const pdfParams: any = {
          landscape: args.landscape,
          displayHeaderFooter: args.displayHeaderFooter,
          printBackground: args.printBackground,
          scale: args.scale
        };

        if (args.paperWidth) pdfParams.paperWidth = args.paperWidth;
        if (args.paperHeight) pdfParams.paperHeight = args.paperHeight;

        const result = await withCDPCommand(
          'Page.printToPDF',
          pdfParams,
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const pdf = result.unwrap() as any;
        const timestamp = new Date().toISOString();

        // Try to store in MinIO
        if (this.minioService) {
          try {
            const key = `pdfs/${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;
            const buffer = Buffer.from(pdf.data, 'base64');
            
            const storeResult = await this.minioService.store(key, buffer, {
              'Content-Type': 'application/pdf',
              landscape: String(args.landscape),
              scale: String(args.scale),
              timestamp,
              type: 'page-pdf'
            });

            if (storeResult.isOk()) {
              const urlResult = await this.minioService.getSignedUrl(key);
              if (urlResult.isOk()) {
                return {
                  success: true,
                  data: {
                    url: urlResult.unwrap(),
                    landscape: args.landscape,
                    scale: args.scale,
                    timestamp,
                    size: buffer.length,
                    stored: true
                  }
                };
              }
            }
          } catch (error) {
            this.logger.error({ error }, 'Failed to store PDF in MinIO');
          }
        }

        // Fallback to returning base64 data
        return {
          success: true,
          data: {
            pdf: pdf.data,
            landscape: args.landscape,
            scale: args.scale,
            timestamp,
            stored: false
          }
        };
      }
    });
  }
}

export class ScreenshotToolProviderFactory extends BaseProviderFactory<ScreenshotToolProvider> {
  create(deps: ProviderDependencies & { minioService?: IMinIOService | null }): ScreenshotToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'screenshot',
      description: 'Screenshot capture and visual debugging tools'
    };

    return new ScreenshotToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config,
      deps.minioService || null
    );
  }
}