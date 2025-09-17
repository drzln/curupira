/**
 * Panda CSS Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Panda CSS debugging tools
 * Tailored for NovaSkyn's Panda CSS 1.1.x atomic CSS architecture
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for Panda CSS tools
const pandaDetectionSchema: Schema<{ sessionId?: string }> = {
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

const pandaClassAnalysisSchema: Schema<{ 
  selector?: string; 
  includeStyles?: boolean; 
  includeUtilities?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      selector: obj.selector,
      includeStyles: typeof obj.includeStyles === 'boolean' ? obj.includeStyles : true,
      includeUtilities: typeof obj.includeUtilities === 'boolean' ? obj.includeUtilities : true,
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

const pandaTokenInspectSchema: Schema<{ 
  tokenType?: string; 
  tokenName?: string; 
  includeValues?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      tokenType: obj.tokenType,
      tokenName: obj.tokenName,
      includeValues: typeof obj.includeValues === 'boolean' ? obj.includeValues : true,
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

class PandaCSSToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register panda_css_detect tool
    this.registerTool(
      this.createTool(
        'panda_css_detect',
        'Detect Panda CSS usage and configuration in the application',
        pandaDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const pandaInfo = {
                detected: false,
                stylesheets: [],
                classPatterns: [],
                buildInfo: null,
                devMode: false
              };
              
              // Method 1: Check for Panda CSS generated stylesheets
              const stylesheets = Array.from(document.styleSheets);
              
              stylesheets.forEach((sheet, index) => {
                try {
                  const href = sheet.href || 'inline';
                  
                  // Check for Panda CSS patterns in href or inline styles
                  if (href.includes('panda') || 
                      href.includes('styled-system') ||
                      href.includes('styles.css')) {
                    
                    pandaInfo.stylesheets.push({
                      index,
                      href,
                      source: 'stylesheet',
                      rulesCount: sheet.cssRules ? sheet.cssRules.length : 0
                    });
                    pandaInfo.detected = true;
                  }
                  
                  // Check CSS rules for Panda CSS patterns
                  if (sheet.cssRules) {
                    let pandaRules = 0;
                    for (let i = 0; i < Math.min(100, sheet.cssRules.length); i++) {
                      const rule = sheet.cssRules[i];
                      if (rule.selectorText) {
                        // Look for atomic CSS patterns
                        if (rule.selectorText.match(/\\.[a-z]+_[a-zA-Z0-9_]+/) ||
                            rule.selectorText.includes('--') ||
                            rule.selectorText.match(/\\.[a-z]{1,3}\\d+/)) {
                          pandaRules++;
                        }
                      }
                    }
                    
                    if (pandaRules > 10) { // Threshold for likely Panda CSS
                      pandaInfo.stylesheets.push({
                        index,
                        href,
                        pandaRules,
                        source: 'detected-patterns'
                      });
                      pandaInfo.detected = true;
                    }
                  }
                } catch (error) {
                  // Cross-origin or other CSS access issues
                }
              });
              
              // Method 2: Check for Panda CSS runtime objects
              if (window.panda || window.__panda__ || window.pandaCss) {
                pandaInfo.detected = true;
                pandaInfo.runtime = {
                  globalPanda: !!window.panda,
                  privatePanda: !!window.__panda__,
                  pandaCss: !!window.pandaCss
                };
              }
              
              // Method 3: Check for Panda CSS build artifacts
              const metaTags = Array.from(document.querySelectorAll('meta'));
              metaTags.forEach(meta => {
                if (meta.name === 'generator' && 
                    meta.content && 
                    meta.content.includes('panda')) {
                  pandaInfo.detected = true;
                  pandaInfo.buildInfo = {
                    generator: meta.content,
                    source: 'meta-tag'
                  };
                }
              });
              
              // Method 4: Analyze DOM classes for Panda CSS patterns
              const allElements = document.querySelectorAll('*');
              const classPatterns = new Map();
              
              for (let i = 0; i < Math.min(1000, allElements.length); i++) {
                const element = allElements[i];
                if (element.className && typeof element.className === 'string') {
                  const classes = element.className.split(' ');
                  
                  classes.forEach(cls => {
                    // Panda CSS atomic class patterns
                    if (cls.match(/^[a-z]+_[a-zA-Z0-9_]+$/)) {
                      const category = cls.split('_')[0];
                      classPatterns.set(category, (classPatterns.get(category) || 0) + 1);
                      pandaInfo.detected = true;
                    }
                    
                    // CSS-in-JS patterns
                    if (cls.match(/^css-[a-zA-Z0-9]+$/)) {
                      classPatterns.set('css-in-js', (classPatterns.get('css-in-js') || 0) + 1);
                      pandaInfo.detected = true;
                    }
                  });
                }
              }
              
              pandaInfo.classPatterns = Array.from(classPatterns.entries()).map(([pattern, count]) => ({
                pattern,
                count,
                percentage: Math.round(count / Math.min(1000, allElements.length) * 100)
              }));
              
              // Method 5: Check for Vite/build tool integration
              if (window.__vite_plugin_react_preamble_installed__ || 
                  window.__vite__ || 
                  document.querySelector('script[src*="vite"]')) {
                pandaInfo.buildTool = 'vite';
                
                // Check for HMR or dev mode indicators
                if (window.__vite__ || document.querySelector('script[src*="@vite/client"]')) {
                  pandaInfo.devMode = true;
                }
              }
              
              // Method 6: Check for CSS custom properties (design tokens)
              const rootStyles = getComputedStyle(document.documentElement);
              const customProps = [];
              
              for (let prop of Array.from(document.documentElement.style)) {
                if (prop.startsWith('--')) {
                  customProps.push({
                    property: prop,
                    value: rootStyles.getPropertyValue(prop).trim()
                  });
                }
              }
              
              if (customProps.length > 0) {
                pandaInfo.designTokens = {
                  count: customProps.length,
                  sample: customProps.slice(0, 10)
                };
              }
              
              return {
                ...pandaInfo,
                timestamp: new Date().toISOString(),
                summary: {
                  detected: pandaInfo.detected,
                  confidence: pandaInfo.detected ? 
                    (pandaInfo.runtime ? 'high' : 
                     pandaInfo.classPatterns.length > 5 ? 'medium' : 'low') : 'none',
                  stylesheetsFound: pandaInfo.stylesheets.length,
                  classPatternsFound: pandaInfo.classPatterns.length
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

    // Register panda_css_class_analysis tool
    this.registerTool(
      this.createTool(
        'panda_css_class_analysis',
        'Analyze Panda CSS classes and their computed styles',
        pandaClassAnalysisSchema,
        async (args, context) => {
          const classAnalysisScript = `
            (function() {
              const analysisInfo = {
                elements: [],
                classBreakdown: {},
                styleAnalysis: {}
              };
              
              const selector = '${args.selector || '*'}';
              const includeStyles = ${args.includeStyles !== false};
              const includeUtilities = ${args.includeUtilities !== false};
              
              const elements = document.querySelectorAll(selector);
              
              const classUsage = new Map();
              const utilityPatterns = new Map();
              
              Array.from(elements).slice(0, 100).forEach((element, index) => {
                if (element.className && typeof element.className === 'string') {
                  const classes = element.className.split(' ').filter(Boolean);
                  
                  const elementInfo = {
                    index,
                    tagName: element.tagName.toLowerCase(),
                    classes: classes,
                    pandaClasses: [],
                    utilityClasses: [],
                    customClasses: []
                  };
                  
                  classes.forEach(cls => {
                    classUsage.set(cls, (classUsage.get(cls) || 0) + 1);
                    
                    // Categorize classes
                    if (cls.match(/^[a-z]+_[a-zA-Z0-9_]+$/)) {
                      elementInfo.pandaClasses.push(cls);
                      const utility = cls.split('_')[0];
                      utilityPatterns.set(utility, (utilityPatterns.get(utility) || 0) + 1);
                    } else if (cls.match(/^(m|p|w|h|text|bg|border|flex|grid)-/)) {
                      elementInfo.utilityClasses.push(cls);
                    } else if (cls.match(/^css-[a-zA-Z0-9]+$/)) {
                      elementInfo.pandaClasses.push(cls);
                    } else {
                      elementInfo.customClasses.push(cls);
                    }
                  });
                  
                  // Get computed styles if requested
                  if (includeStyles && (elementInfo.pandaClasses.length > 0 || elementInfo.utilityClasses.length > 0)) {
                    try {
                      const computedStyles = getComputedStyle(element);
                      elementInfo.styles = {
                        display: computedStyles.display,
                        position: computedStyles.position,
                        width: computedStyles.width,
                        height: computedStyles.height,
                        margin: computedStyles.margin,
                        padding: computedStyles.padding,
                        backgroundColor: computedStyles.backgroundColor,
                        color: computedStyles.color,
                        fontSize: computedStyles.fontSize,
                        fontFamily: computedStyles.fontFamily
                      };
                    } catch (error) {
                      elementInfo.stylesError = error.message;
                    }
                  }
                  
                  analysisInfo.elements.push(elementInfo);
                }
              });
              
              // Compile class breakdown
              analysisInfo.classBreakdown = {
                totalClasses: classUsage.size,
                mostUsed: Array.from(classUsage.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 20)
                  .map(([cls, count]) => ({ class: cls, count }))
              };
              
              // Compile utility patterns
              if (includeUtilities) {
                analysisInfo.utilityAnalysis = {
                  patterns: Array.from(utilityPatterns.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([utility, count]) => ({ utility, count })),
                  coverage: {
                    spacing: utilityPatterns.has('m') || utilityPatterns.has('p'),
                    layout: utilityPatterns.has('flex') || utilityPatterns.has('grid'),
                    sizing: utilityPatterns.has('w') || utilityPatterns.has('h'),
                    colors: utilityPatterns.has('bg') || utilityPatterns.has('text'),
                    typography: utilityPatterns.has('text') || utilityPatterns.has('font')
                  }
                };
              }
              
              return {
                ...analysisInfo,
                summary: {
                  elementsAnalyzed: analysisInfo.elements.length,
                  totalUniqueClasses: classUsage.size,
                  pandaElements: analysisInfo.elements.filter(e => e.pandaClasses.length > 0).length,
                  utilityElements: analysisInfo.elements.filter(e => e.utilityClasses.length > 0).length,
                  averageClassesPerElement: analysisInfo.elements.length > 0 ? 
                    analysisInfo.elements.reduce((sum, e) => sum + e.classes.length, 0) / analysisInfo.elements.length : 0
                }
              };
            })()
          `;

          const result = await withScriptExecution(classAnalysisScript, context);

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
            selector: { 
              type: 'string', 
              description: 'CSS selector to analyze (default: all elements)'
            },
            includeStyles: { 
              type: 'boolean', 
              description: 'Include computed styles for elements',
              default: true
            },
            includeUtilities: { 
              type: 'boolean', 
              description: 'Include utility class analysis',
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

    // Register panda_css_token_inspect tool
    this.registerTool(
      this.createTool(
        'panda_css_token_inspect',
        'Inspect Panda CSS design tokens and custom properties',
        pandaTokenInspectSchema,
        async (args, context) => {
          const tokenInspectionScript = `
            (function() {
              const tokenInfo = {
                customProperties: [],
                tokenTypes: {},
                usage: []
              };
              
              const tokenType = '${args.tokenType || ''}';
              const tokenName = '${args.tokenName || ''}';
              const includeValues = ${args.includeValues !== false};
              
              // Get all CSS custom properties from the root element
              const rootStyles = getComputedStyle(document.documentElement);
              const allProps = [];
              
              // Get properties from inline styles
              for (let prop of Array.from(document.documentElement.style)) {
                if (prop.startsWith('--')) {
                  allProps.push(prop);
                }
              }
              
              // Get properties from stylesheets
              try {
                Array.from(document.styleSheets).forEach(sheet => {
                  try {
                    Array.from(sheet.cssRules).forEach(rule => {
                      if (rule.style) {
                        for (let prop of Array.from(rule.style)) {
                          if (prop.startsWith('--') && !allProps.includes(prop)) {
                            allProps.push(prop);
                          }
                        }
                      }
                    });
                  } catch (error) {
                    // Cross-origin or access issues
                  }
                });
              } catch (error) {
                tokenInfo.stylesheetError = error.message;
              }
              
              // Analyze custom properties
              allProps.forEach(prop => {
                const value = rootStyles.getPropertyValue(prop).trim();
                
                if (!value && !includeValues) return;
                
                const tokenData = {
                  property: prop,
                  value: includeValues ? value : '[hidden]'
                };
                
                // Categorize tokens by prefix/type
                const parts = prop.substring(2).split('-'); // Remove '--'
                const category = parts[0];
                
                if (!tokenInfo.tokenTypes[category]) {
                  tokenInfo.tokenTypes[category] = [];
                }
                tokenInfo.tokenTypes[category].push(tokenData);
                
                // Filter by token type if specified
                if (tokenType && !category.includes(tokenType.toLowerCase())) {
                  return;
                }
                
                // Filter by token name if specified
                if (tokenName && !prop.includes(tokenName.toLowerCase())) {
                  return;
                }
                
                // Analyze value type
                if (includeValues && value) {
                  if (value.match(/^#[0-9a-fA-F]{3,8}$/)) {
                    tokenData.type = 'color-hex';
                  } else if (value.match(/^rgb|hsl/)) {
                    tokenData.type = 'color-function';
                  } else if (value.match(/^\\d+(\\.\\d+)?(px|rem|em|%|vh|vw)$/)) {
                    tokenData.type = 'dimension';
                    tokenData.unit = value.match(/[a-z%]+$/)[0];
                  } else if (value.match(/^\\d+(\\.\\d+)?$/)) {
                    tokenData.type = 'number';
                  } else {
                    tokenData.type = 'string';
                  }
                }
                
                tokenInfo.customProperties.push(tokenData);
              });
              
              // Check for token usage in elements
              if (includeValues) {
                const elements = document.querySelectorAll('*');
                const usageMap = new Map();
                
                Array.from(elements).slice(0, 500).forEach(element => {
                  const computedStyles = getComputedStyle(element);
                  
                  // Check common CSS properties that might use custom properties
                  const propsToCheck = [
                    'color', 'backgroundColor', 'borderColor',
                    'fontSize', 'margin', 'padding', 'width', 'height'
                  ];
                  
                  propsToCheck.forEach(cssProp => {
                    const value = computedStyles.getPropertyValue(cssProp);
                    
                    allProps.forEach(customProp => {
                      const customValue = rootStyles.getPropertyValue(customProp);
                      if (value === customValue && customValue) {
                        const usage = usageMap.get(customProp) || { property: customProp, elements: 0, cssProperties: new Set() };
                        usage.elements++;
                        usage.cssProperties.add(cssProp);
                        usageMap.set(customProp, usage);
                      }
                    });
                  });
                });
                
                tokenInfo.usage = Array.from(usageMap.values()).map(usage => ({
                  ...usage,
                  cssProperties: Array.from(usage.cssProperties)
                }));
              }
              
              return {
                ...tokenInfo,
                summary: {
                  totalTokens: tokenInfo.customProperties.length,
                  tokenCategories: Object.keys(tokenInfo.tokenTypes).length,
                  mostUsedCategory: Object.entries(tokenInfo.tokenTypes)
                    .sort((a, b) => b[1].length - a[1].length)[0]?.[0] || null,
                  usageTracked: tokenInfo.usage.length
                }
              };
            })()
          `;

          const result = await withScriptExecution(tokenInspectionScript, context);

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
            tokenType: { 
              type: 'string', 
              description: 'Filter by token type/category (e.g., color, spacing, font)'
            },
            tokenName: { 
              type: 'string', 
              description: 'Filter by specific token name pattern'
            },
            includeValues: { 
              type: 'boolean', 
              description: 'Include token values in output',
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

    // Register panda_css_recipe_inspect tool
    this.registerTool({
      name: 'panda_css_recipe_inspect',
      description: 'Inspect Panda CSS recipes and component variants',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            recipeName: obj.recipeName,
            includeVariants: typeof obj.includeVariants === 'boolean' ? obj.includeVariants : true,
            includeSlots: typeof obj.includeSlots === 'boolean' ? obj.includeSlots : true,
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
          recipeName: { 
            type: 'string', 
            description: 'Specific recipe name to inspect'
          },
          includeVariants: { 
            type: 'boolean', 
            description: 'Include recipe variants in analysis',
            default: true
          },
          includeSlots: { 
            type: 'boolean', 
            description: 'Include slot-based recipe analysis',
            default: true
          },
          sessionId: { 
            type: 'string', 
            description: 'Optional Chrome session ID'
          }
        },
        required: []
      },
      handler: async (args, context) => {
        const recipeInspectionScript = `
          (function() {
            const recipeInfo = {
              recipes: [],
              variantUsage: {},
              detectedPatterns: []
            };
            
            const recipeName = '${args.recipeName || ''}';
            const includeVariants = ${args.includeVariants !== false};
            const includeSlots = ${args.includeSlots !== false};
            
            // Method 1: Look for Panda CSS recipe patterns in class names
            const elements = document.querySelectorAll('*');
            const recipePatterns = new Map();
            const variantPatterns = new Map();
            
            Array.from(elements).forEach(element => {
              if (element.className && typeof element.className === 'string') {
                const classes = element.className.split(' ');
                
                classes.forEach(cls => {
                  // Recipe pattern: recipeName__variant__value
                  const recipeMatch = cls.match(/^([a-zA-Z]+)__([a-zA-Z]+)__([a-zA-Z0-9]+)$/);
                  if (recipeMatch) {
                    const [, recipe, variant, value] = recipeMatch;
                    
                    if (!recipeName || recipe === recipeName) {
                      if (!recipePatterns.has(recipe)) {
                        recipePatterns.set(recipe, { variants: new Map(), elements: [] });
                      }
                      
                      const recipeData = recipePatterns.get(recipe);
                      if (!recipeData.variants.has(variant)) {
                        recipeData.variants.set(variant, new Set());
                      }
                      recipeData.variants.get(variant).add(value);
                      recipeData.elements.push({
                        tagName: element.tagName.toLowerCase(),
                        variant,
                        value
                      });
                    }
                  }
                  
                  // Look for compound variants: recipe--variant1-value1--variant2-value2
                  const compoundMatch = cls.match(/^([a-zA-Z]+)(--[a-zA-Z0-9-]+)+$/);
                  if (compoundMatch) {
                    const [, recipe, ...variants] = compoundMatch;
                    if (!recipeName || recipe === recipeName) {
                      recipeInfo.detectedPatterns.push({
                        type: 'compound-variant',
                        recipe,
                        class: cls,
                        variants: variants.join('')
                      });
                    }
                  }
                });
              }
            });
            
            // Convert patterns to structured data
            recipePatterns.forEach((data, recipe) => {
              const recipeData = {
                name: recipe,
                variants: {},
                elementCount: data.elements.length,
                elements: data.elements.slice(0, 10) // Sample of elements
              };
              
              if (includeVariants) {
                data.variants.forEach((values, variant) => {
                  recipeData.variants[variant] = Array.from(values);
                });
              }
              
              recipeInfo.recipes.push(recipeData);
            });
            
            // Method 2: Look for CSS-in-JS recipe patterns
            const styleElements = document.querySelectorAll('style');
            styleElements.forEach(styleEl => {
              const content = styleEl.textContent || '';
              
              // Look for Panda CSS generated recipe classes
              const recipeClassMatches = content.match(/\\.[a-zA-Z]+__[a-zA-Z]+__[a-zA-Z0-9]+/g);
              if (recipeClassMatches) {
                recipeClassMatches.forEach(match => {
                  const parts = match.substring(1).split('__'); // Remove leading dot
                  if (parts.length === 3) {
                    recipeInfo.detectedPatterns.push({
                      type: 'css-recipe',
                      recipe: parts[0],
                      variant: parts[1],
                      value: parts[2],
                      source: 'stylesheet'
                    });
                  }
                });
              }
            });
            
            // Method 3: Check for runtime recipe objects
            if (window.panda && window.panda.recipes) {
              recipeInfo.runtime = {
                available: true,
                recipes: Object.keys(window.panda.recipes)
              };
            }
            
            return {
              ...recipeInfo,
              summary: {
                totalRecipes: recipeInfo.recipes.length,
                totalPatterns: recipeInfo.detectedPatterns.length,
                hasRuntime: !!recipeInfo.runtime,
                mostUsedRecipe: recipeInfo.recipes.length > 0 ? 
                  recipeInfo.recipes.sort((a, b) => b.elementCount - a.elementCount)[0].name : null
              }
            };
          })()
        `;

        const result = await withScriptExecution(recipeInspectionScript, context);

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

    // Register panda_css_performance_analyze tool
    this.registerTool({
      name: 'panda_css_performance_analyze',
      description: 'Analyze Panda CSS performance and bundle size impact',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            includeUnused: typeof obj.includeUnused === 'boolean' ? obj.includeUnused : false,
            analyzeBundleSize: typeof obj.analyzeBundleSize === 'boolean' ? obj.analyzeBundleSize : true,
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
          includeUnused: { 
            type: 'boolean', 
            description: 'Analyze unused CSS rules',
            default: false
          },
          analyzeBundleSize: { 
            type: 'boolean', 
            description: 'Analyze CSS bundle size and compression',
            default: true
          },
          sessionId: { 
            type: 'string', 
            description: 'Optional Chrome session ID'
          }
        },
        required: []
      },
      handler: async (args, context) => {
        const performanceAnalysisScript = `
          (function() {
            const perfInfo = {
              stylesheets: [],
              totalRules: 0,
              totalSize: 0,
              unusedRules: [],
              atomic: {
                classes: 0,
                utilities: 0,
                components: 0
              }
            };
            
            const includeUnused = ${args.includeUnused === true};
            const analyzeBundleSize = ${args.analyzeBundleSize !== false};
            
            // Analyze stylesheets
            Array.from(document.styleSheets).forEach((sheet, index) => {
              try {
                const sheetInfo = {
                  index,
                  href: sheet.href || 'inline',
                  rulesCount: 0,
                  size: 0,
                  pandaRules: 0
                };
                
                if (sheet.cssRules) {
                  sheetInfo.rulesCount = sheet.cssRules.length;
                  
                  // Estimate size and analyze rules
                  Array.from(sheet.cssRules).forEach(rule => {
                    const ruleText = rule.cssText || '';
                    sheetInfo.size += ruleText.length;
                    
                    // Classify Panda CSS rules
                    if (rule.selectorText) {
                      // Atomic utility classes
                      if (rule.selectorText.match(/\\.[a-z]+_[a-zA-Z0-9_]+/)) {
                        perfInfo.atomic.utilities++;
                        sheetInfo.pandaRules++;
                      }
                      
                      // CSS-in-JS generated classes
                      if (rule.selectorText.match(/\\.css-[a-zA-Z0-9]+/)) {
                        perfInfo.atomic.components++;
                        sheetInfo.pandaRules++;
                      }
                      
                      // Recipe classes
                      if (rule.selectorText.match(/\\.[a-zA-Z]+__[a-zA-Z]+__[a-zA-Z0-9]+/)) {
                        perfInfo.atomic.classes++;
                        sheetInfo.pandaRules++;
                      }
                    }
                  });
                }
                
                perfInfo.stylesheets.push(sheetInfo);
                perfInfo.totalRules += sheetInfo.rulesCount;
                perfInfo.totalSize += sheetInfo.size;
              } catch (error) {
                perfInfo.stylesheets.push({
                  index,
                  href: sheet.href || 'inline',
                  error: error.message
                });
              }
            });
            
            // Analyze unused CSS if requested
            if (includeUnused) {
              // This is a simplified check - real unused CSS analysis requires more complex logic
              const usedClasses = new Set();
              document.querySelectorAll('*').forEach(el => {
                if (el.className && typeof el.className === 'string') {
                  el.className.split(' ').forEach(cls => usedClasses.add(cls));
                }
              });
              
              perfInfo.usageAnalysis = {
                totalClassesInDOM: usedClasses.size,
                note: 'Full unused CSS analysis requires CSS coverage tools'
              };
            }
            
            // Bundle size analysis
            if (analyzeBundleSize) {
              perfInfo.bundleAnalysis = {
                totalSizeBytes: perfInfo.totalSize,
                totalSizeKB: Math.round(perfInfo.totalSize / 1024 * 100) / 100,
                estimatedGzipped: Math.round(perfInfo.totalSize * 0.3 / 1024 * 100) / 100, // Rough estimate
                atomicRatio: {
                  utilities: perfInfo.atomic.utilities,
                  components: perfInfo.atomic.components,
                  recipes: perfInfo.atomic.classes,
                  total: perfInfo.atomic.utilities + perfInfo.atomic.components + perfInfo.atomic.classes
                }
              };
              
              perfInfo.recommendations = [];
              
              if (perfInfo.totalSize > 100000) { // > 100KB
                perfInfo.recommendations.push('Consider CSS purging or tree-shaking to reduce bundle size');
              }
              
              if (perfInfo.atomic.utilities > 1000) {
                perfInfo.recommendations.push('High utility class count - consider component-based approach');
              }
              
              if (perfInfo.stylesheets.length > 5) {
                perfInfo.recommendations.push('Consider CSS bundling to reduce HTTP requests');
              }
            }
            
            return perfInfo;
          })()
        `;

        const result = await withScriptExecution(performanceAnalysisScript, context);

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

export class PandaCSSToolProviderFactory extends BaseProviderFactory<PandaCSSToolProvider> {
  create(deps: ProviderDependencies): PandaCSSToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'panda-css',
      description: 'Panda CSS atomic styling and design token debugging tools'
    };

    return new PandaCSSToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}