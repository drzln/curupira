/**
 * DOM Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for DOM manipulation tool provider
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';
import { domToolSchemas } from '../schemas/dom-schemas.js';

// Schema definitions
const querySelectorSchema: Schema<{ selector: string; sessionId?: string }> = {
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
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: querySelectorSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const clickSchema: Schema<{ selector: string; sessionId?: string }> = {
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
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: clickSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const setValueSchema: Schema<{ selector: string; value: string; sessionId?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.selector !== 'string') {
      throw new Error('selector must be a string');
    }
    if (typeof obj.value !== 'string') {
      throw new Error('value must be a string');
    }
    return {
      selector: obj.selector,
      value: obj.value,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: setValueSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class DOMToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register dom_query_selector tool
    this.registerTool(
      this.createTool(
        'dom_query_selector',
        'Find elements by CSS selector',
        querySelectorSchema,
        async (args, context) => {
          const script = `
            (() => {
              const elements = document.querySelectorAll('${args.selector}');
              return Array.from(elements).map((el, index) => ({
                index,
                tagName: el.tagName.toLowerCase(),
                id: el.id || null,
                className: el.className || null,
                textContent: el.textContent?.slice(0, 100) || null,
                attributes: Array.from(el.attributes).reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {})
              }));
            })()
          `;

          const result = await withScriptExecution(script, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: {
              elements: result.unwrap(),
              count: (result.unwrap() as any[]).length
            }
          };
        },
        domToolSchemas.dom_query_selector
      )
    );

    // Register dom_click tool
    this.registerTool(
      this.createTool(
        'dom_click',
        'Click an element',
        clickSchema,
        async (args, context) => {
          const script = `
            (() => {
              const element = document.querySelector('${args.selector}');
              if (!element) {
                return { success: false, error: 'Element not found' };
              }
              
              // Simulate a real click
              const event = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
              
              return { 
                success: true, 
                element: {
                  tagName: element.tagName.toLowerCase(),
                  id: element.id || null,
                  className: element.className || null
                }
              };
            })()
          `;

          const result = await withScriptExecution(script, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const data = result.unwrap() as any;
          if (!data.success) {
            return {
              success: false,
              error: data.error
            };
          }

          return {
            success: true,
            data: data
          };
        },
        domToolSchemas.dom_click
      )
    );

    // Register dom_set_value tool
    this.registerTool(
      this.createTool(
        'dom_set_value',
        'Set value of an input element',
        setValueSchema,
        async (args, context) => {
          const script = `
            (() => {
              const element = document.querySelector('${args.selector}');
              if (!element) {
                return { success: false, error: 'Element not found' };
              }
              
              if (!('value' in element)) {
                return { success: false, error: 'Element does not have a value property' };
              }
              
              // Set the value
              element.value = ${JSON.stringify(args.value)};
              
              // Trigger input and change events
              const inputEvent = new Event('input', { bubbles: true });
              const changeEvent = new Event('change', { bubbles: true });
              element.dispatchEvent(inputEvent);
              element.dispatchEvent(changeEvent);
              
              return { 
                success: true,
                element: {
                  tagName: element.tagName.toLowerCase(),
                  id: element.id || null,
                  value: element.value
                }
              };
            })()
          `;

          const result = await withScriptExecution(script, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const data = result.unwrap() as any;
          if (!data.success) {
            return {
              success: false,
              error: data.error
            };
          }

          return {
            success: true,
            data: data
          };
        },
        domToolSchemas.dom_set_value
      )
    );

    // Register dom_get_text tool
    this.registerTool(
      this.createTool(
        'dom_get_text',
        'Get text content of elements',
        querySelectorSchema,
        async (args, context) => {
          const script = `
            (() => {
              const elements = document.querySelectorAll('${args.selector}');
              return Array.from(elements).map(el => ({
                text: el.textContent || '',
                innerText: el.innerText || '',
                innerHTML: el.innerHTML.slice(0, 500)
              }));
            })()
          `;

          const result = await withScriptExecution(script, context);

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
        domToolSchemas.dom_get_text
      )
    );

    // Register dom_get_attributes tool
    this.registerTool(
      this.createTool(
        'dom_get_attributes',
        'Get attributes of elements',
        querySelectorSchema,
        async (args, context) => {
          const script = `
            (() => {
              const elements = document.querySelectorAll('${args.selector}');
              return Array.from(elements).map(el => {
                const attrs = {};
                for (const attr of el.attributes) {
                  attrs[attr.name] = attr.value;
                }
                return attrs;
              });
            })()
          `;

          const result = await withScriptExecution(script, context);

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
        domToolSchemas.dom_get_attributes
      )
    );

    // Register dom_wait_for_selector tool
    this.registerTool(
      this.createTool(
        'dom_wait_for_selector',
        'Wait for an element to appear',
        querySelectorSchema,
        async (args, context) => {
          // For now, just check if element exists
          const script = `
            (() => {
              const element = document.querySelector('${args.selector}');
              return {
                found: !!element,
                selector: '${args.selector}'
              };
            })()
          `;

          const result = await withScriptExecution(script, context);

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
        domToolSchemas.dom_wait_for_selector
      )
    );
  }
}

export class DOMToolProviderFactory extends BaseProviderFactory<DOMToolProvider> {
  create(deps: ProviderDependencies): DOMToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'dom',
      description: 'DOM manipulation and inspection tools'
    };

    return new DOMToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}