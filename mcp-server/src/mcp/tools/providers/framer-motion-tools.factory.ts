/**
 * Framer Motion Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Framer Motion animation debugging tools
 * Tailored for NovaSkyn's animation and interaction architecture
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for Framer Motion tools
const motionDetectionSchema: Schema<{ sessionId?: string }> = {
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

const animationInspectSchema: Schema<{ 
  selector?: string; 
  includeValues?: boolean; 
  includeTimeline?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      selector: obj.selector,
      includeValues: typeof obj.includeValues === 'boolean' ? obj.includeValues : true,
      includeTimeline: typeof obj.includeTimeline === 'boolean' ? obj.includeTimeline : false,
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

const gestureInspectSchema: Schema<{ 
  selector?: string; 
  includeHandlers?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      selector: obj.selector,
      includeHandlers: typeof obj.includeHandlers === 'boolean' ? obj.includeHandlers : true,
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

class FramerMotionToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register framer_motion_detect tool
    this.registerTool(
      this.createTool(
        'framer_motion_detect',
        'Detect Framer Motion components and animation state',
        motionDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const motionInfo = {
                detected: false,
                version: null,
                components: [],
                animations: [],
                totalMotionElements: 0
              };
              
              // Method 1: Check for Framer Motion in global scope
              if (window.motion || window.framerMotion || window.Motion) {
                motionInfo.detected = true;
                const motion = window.motion || window.framerMotion || window.Motion;
                motionInfo.version = motion.version || motion.VERSION || 'unknown';
              }
              
              // Method 2: Check for motion elements in DOM
              const motionElements = document.querySelectorAll('[data-framer-component], [data-motion-component]');
              if (motionElements.length > 0) {
                motionInfo.detected = true;
                motionInfo.totalMotionElements = motionElements.length;
              }
              
              // Method 3: Check for React components with motion
              if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                try {
                  const motionComponents = [];
                  
                  const searchForMotionComponents = (fiber) => {
                    if (!fiber) return;
                    
                    const componentName = fiber.type?.name || fiber.elementType?.name || fiber.type?.displayName;
                    const isMotionComponent = componentName && (
                      componentName.startsWith('motion.') ||
                      componentName.includes('Motion') ||
                      componentName === 'AnimatePresence' ||
                      componentName === 'LazyMotion' ||
                      componentName === 'MotionConfig'
                    );
                    
                    if (isMotionComponent) {
                      motionComponents.push({
                        name: componentName,
                        props: fiber.memoizedProps || {},
                        key: fiber.key,
                        hasAnimations: !!(fiber.memoizedProps?.animate || 
                                        fiber.memoizedProps?.initial ||
                                        fiber.memoizedProps?.exit ||
                                        fiber.memoizedProps?.whileHover ||
                                        fiber.memoizedProps?.whileTap ||
                                        fiber.memoizedProps?.whileDrag)
                      });
                      motionInfo.detected = true;
                    }
                    
                    // Check for elements with motion props
                    if (fiber.memoizedProps) {
                      const motionProps = ['animate', 'initial', 'exit', 'variants', 'transition',
                                          'whileHover', 'whileTap', 'whileDrag', 'whileInView'];
                      const hasMotionProps = motionProps.some(prop => fiber.memoizedProps[prop] !== undefined);
                      
                      if (hasMotionProps) {
                        motionComponents.push({
                          name: componentName || 'Unknown',
                          type: 'motion-element',
                          props: Object.keys(fiber.memoizedProps).filter(key => motionProps.includes(key)),
                          key: fiber.key
                        });
                        motionInfo.detected = true;
                      }
                    }
                    
                    if (fiber.child) searchForMotionComponents(fiber.child);
                    if (fiber.sibling) searchForMotionComponents(fiber.sibling);
                  };
                  
                  const containers = document.querySelectorAll('[data-reactroot], #root, .react-root');
                  containers.forEach(container => {
                    const fiberRoot = container._reactInternalFiber || 
                                    container._reactInternalInstance ||
                                    container.__reactInternalInstance ||
                                    container._reactRootContainer?._internalRoot;
                    
                    if (fiberRoot) {
                      searchForMotionComponents(fiberRoot.current || fiberRoot);
                    }
                  });
                  
                  motionInfo.components = motionComponents;
                } catch (error) {
                  motionInfo.reactError = error.message;
                }
              }
              
              // Method 4: Check for CSS animations and transitions
              try {
                const animatedElements = [];
                const allElements = document.querySelectorAll('*');
                
                allElements.forEach((element, index) => {
                  if (index > 500) return; // Limit to first 500 elements for performance
                  
                  const computedStyle = window.getComputedStyle(element);
                  const hasAnimation = computedStyle.animationName !== 'none' && computedStyle.animationName !== '';
                  const hasTransition = computedStyle.transitionProperty !== 'none' && computedStyle.transitionProperty !== '';
                  const hasTransform = computedStyle.transform !== 'none' && computedStyle.transform !== '';
                  
                  if (hasAnimation || hasTransition || hasTransform) {
                    animatedElements.push({
                      tagName: element.tagName.toLowerCase(),
                      className: element.className,
                      id: element.id,
                      hasAnimation,
                      hasTransition,
                      hasTransform,
                      animationName: hasAnimation ? computedStyle.animationName : null,
                      transitionProperty: hasTransition ? computedStyle.transitionProperty : null,
                      transform: hasTransform ? computedStyle.transform : null
                    });
                  }
                });
                
                motionInfo.cssAnimations = {
                  count: animatedElements.length,
                  elements: animatedElements.slice(0, 20) // Limit to first 20 for output size
                };
              } catch (error) {
                motionInfo.cssError = error.message;
              }
              
              // Method 5: Check for Web Animations API usage
              try {
                motionInfo.webAnimationsAPI = {
                  supported: !!(document.documentElement.animate),
                  activeAnimations: document.getAnimations ? document.getAnimations().length : 0
                };
                
                if (document.getAnimations) {
                  const animations = document.getAnimations();
                  motionInfo.webAnimationsAPI.animations = animations.slice(0, 10).map(anim => ({
                    playState: anim.playState,
                    currentTime: anim.currentTime,
                    startTime: anim.startTime,
                    effect: anim.effect ? {
                      target: anim.effect.target?.tagName || 'unknown',
                      duration: anim.effect.getTiming().duration,
                      iterations: anim.effect.getTiming().iterations
                    } : null
                  }));
                }
              } catch (error) {
                motionInfo.webAnimationsError = error.message;
              }
              
              // Method 6: Check for motion values and springs
              if (motionInfo.detected) {
                try {
                  // Look for Framer Motion specific globals
                  const motionGlobals = {
                    useMotionValue: !!(window.useMotionValue),
                    useSpring: !!(window.useSpring),
                    useTransform: !!(window.useTransform),
                    useAnimation: !!(window.useAnimation),
                    useDragControls: !!(window.useDragControls),
                    useAnimationControls: !!(window.useAnimationControls)
                  };
                  
                  motionInfo.motionHooks = Object.entries(motionGlobals)
                    .filter(([_, available]) => available)
                    .map(([name]) => name);
                } catch (error) {
                  motionInfo.hooksError = error.message;
                }
              }
              
              return {
                ...motionInfo,
                timestamp: new Date().toISOString(),
                summary: {
                  detected: motionInfo.detected,
                  version: motionInfo.version || 'unknown',
                  motionComponents: motionInfo.components.length,
                  cssAnimations: motionInfo.cssAnimations?.count || 0,
                  webAnimations: motionInfo.webAnimationsAPI?.activeAnimations || 0,
                  confidence: motionInfo.components.length > 0 ? 'high' :
                            motionInfo.totalMotionElements > 0 ? 'medium' :
                            motionInfo.detected ? 'low' : 'none'
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

    // Register framer_motion_animations_inspect tool
    this.registerTool(
      this.createTool(
        'framer_motion_animations_inspect',
        'Inspect active animations and motion values',
        animationInspectSchema,
        async (args, context) => {
          const animationInspectionScript = `
            (function() {
              const animationInfo = {
                activeAnimations: [],
                motionValues: [],
                totalActive: 0
              };
              
              const selector = '${args.selector || ''}';
              const includeValues = ${args.includeValues !== false};
              const includeTimeline = ${args.includeTimeline === true};
              
              try {
                // Method 1: Web Animations API
                if (document.getAnimations) {
                  const animations = document.getAnimations();
                  
                  animations.forEach((animation, index) => {
                    const target = animation.effect?.target;
                    
                    // Apply selector filter if provided
                    if (selector && target && !target.matches(selector)) {
                      return;
                    }
                    
                    const animInfo = {
                      index,
                      playState: animation.playState,
                      currentTime: animation.currentTime,
                      playbackRate: animation.playbackRate,
                      ready: animation.ready.then ? 'pending' : 'resolved',
                      finished: animation.finished.then ? 'pending' : 'resolved',
                      target: target ? {
                        tagName: target.tagName,
                        className: target.className,
                        id: target.id
                      } : null
                    };
                    
                    if (animation.effect) {
                      const timing = animation.effect.getTiming();
                      animInfo.effect = {
                        duration: timing.duration,
                        delay: timing.delay,
                        endDelay: timing.endDelay,
                        iterations: timing.iterations,
                        direction: timing.direction,
                        fill: timing.fill,
                        easing: timing.easing
                      };
                      
                      if (includeTimeline && animation.effect.getKeyframes) {
                        try {
                          animInfo.keyframes = animation.effect.getKeyframes();
                        } catch (e) {
                          animInfo.keyframesError = e.message;
                        }
                      }
                    }
                    
                    if (includeValues && animation.effect?.getComputedTiming) {
                      try {
                        animInfo.computedTiming = animation.effect.getComputedTiming();
                      } catch (e) {
                        animInfo.computedTimingError = e.message;
                      }
                    }
                    
                    animationInfo.activeAnimations.push(animInfo);
                  });
                  
                  animationInfo.totalActive = animations.length;
                }
                
                // Method 2: CSS Animations inspection
                const elements = selector ? 
                  document.querySelectorAll(selector) : 
                  document.querySelectorAll('*');
                
                const cssAnimations = [];
                elements.forEach((element, index) => {
                  if (index > 100) return; // Limit for performance
                  
                  const computedStyle = window.getComputedStyle(element);
                  const animationName = computedStyle.animationName;
                  const transitionProperty = computedStyle.transitionProperty;
                  
                  if (animationName !== 'none' || transitionProperty !== 'none') {
                    cssAnimations.push({
                      element: {
                        tagName: element.tagName,
                        className: element.className,
                        id: element.id
                      },
                      animation: animationName !== 'none' ? {
                        name: animationName,
                        duration: computedStyle.animationDuration,
                        delay: computedStyle.animationDelay,
                        iterationCount: computedStyle.animationIterationCount,
                        direction: computedStyle.animationDirection,
                        fillMode: computedStyle.animationFillMode,
                        playState: computedStyle.animationPlayState,
                        timingFunction: computedStyle.animationTimingFunction
                      } : null,
                      transition: transitionProperty !== 'none' ? {
                        property: transitionProperty,
                        duration: computedStyle.transitionDuration,
                        delay: computedStyle.transitionDelay,
                        timingFunction: computedStyle.transitionTimingFunction
                      } : null
                    });
                  }
                });
                
                animationInfo.cssAnimations = cssAnimations;
                
                // Method 3: Look for Framer Motion specific data
                if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                  const motionData = [];
                  
                  const searchForMotionValues = (fiber) => {
                    if (!fiber) return;
                    
                    // Look for motion values in component state/props
                    if (fiber.memoizedProps) {
                      const motionProps = ['animate', 'initial', 'variants', 'transition'];
                      motionProps.forEach(prop => {
                        if (fiber.memoizedProps[prop]) {
                          motionData.push({
                            component: fiber.type?.name || 'Unknown',
                            prop,
                            value: fiber.memoizedProps[prop],
                            key: fiber.key
                          });
                        }
                      });
                    }
                    
                    // Check component state for motion values
                    if (includeValues && fiber.memoizedState) {
                      let current = fiber.memoizedState;
                      while (current) {
                        if (current.memoizedState && typeof current.memoizedState === 'object') {
                          const state = current.memoizedState;
                          if (state && (state._value !== undefined || state.get || state.set)) {
                            // Looks like a motion value
                            motionData.push({
                              component: fiber.type?.name || 'Unknown',
                              type: 'motion-value',
                              hasGetter: !!state.get,
                              hasSetter: !!state.set,
                              value: state._value || state.current || 'unknown'
                            });
                          }
                        }
                        current = current.next;
                      }
                    }
                    
                    if (fiber.child) searchForMotionValues(fiber.child);
                    if (fiber.sibling) searchForMotionValues(fiber.sibling);
                  };
                  
                  const containers = document.querySelectorAll('[data-reactroot], #root, .react-root');
                  containers.forEach(container => {
                    const fiberRoot = container._reactInternalFiber || 
                                    container._reactInternalInstance ||
                                    container.__reactInternalInstance ||
                                    container._reactRootContainer?._internalRoot;
                    
                    if (fiberRoot) {
                      searchForMotionValues(fiberRoot.current || fiberRoot);
                    }
                  });
                  
                  animationInfo.motionValues = motionData;
                }
                
              } catch (error) {
                animationInfo.error = error.message;
              }
              
              return {
                ...animationInfo,
                summary: {
                  webAnimations: animationInfo.activeAnimations.length,
                  cssAnimations: animationInfo.cssAnimations?.length || 0,
                  motionValues: animationInfo.motionValues.length,
                  totalAnimated: animationInfo.totalActive + (animationInfo.cssAnimations?.length || 0),
                  hasActiveAnimations: animationInfo.totalActive > 0 || (animationInfo.cssAnimations?.length || 0) > 0
                }
              };
            })()
          `;

          const result = await withScriptExecution(animationInspectionScript, context);

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
              description: 'CSS selector to filter animated elements'
            },
            includeValues: { 
              type: 'boolean', 
              description: 'Include motion values and computed timing',
              default: true
            },
            includeTimeline: { 
              type: 'boolean', 
              description: 'Include animation keyframes and timeline data',
              default: false
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

    // Register framer_motion_gestures_inspect tool
    this.registerTool(
      this.createTool(
        'framer_motion_gestures_inspect',
        'Inspect gesture handlers and interactive elements',
        gestureInspectSchema,
        async (args, context) => {
          const gestureInspectionScript = `
            (function() {
              const gestureInfo = {
                interactiveElements: [],
                gestureHandlers: [],
                totalInteractive: 0
              };
              
              const selector = '${args.selector || ''}';
              const includeHandlers = ${args.includeHandlers !== false};
              
              try {
                // Method 1: Look for elements with pointer/touch event listeners
                const elements = selector ? 
                  document.querySelectorAll(selector) : 
                  document.querySelectorAll('*');
                
                elements.forEach((element, index) => {
                  if (index > 200) return; // Limit for performance
                  
                  const interactive = {
                    element: {
                      tagName: element.tagName,
                      className: element.className,
                      id: element.id
                    },
                    events: [],
                    style: {},
                    gestures: []
                  };
                  
                  // Check for common gesture/interaction event types
                  const eventTypes = [
                    'click', 'mousedown', 'mouseup', 'mousemove',
                    'touchstart', 'touchmove', 'touchend',
                    'pointerdown', 'pointermove', 'pointerup',
                    'dragstart', 'drag', 'dragend'
                  ];
                  
                  eventTypes.forEach(eventType => {
                    if (element[\`on\${eventType}\`] || element.getAttribute(\`on\${eventType}\`)) {
                      interactive.events.push(eventType);
                    }
                  });
                  
                  // Check computed style for cursor and user interaction properties
                  const computedStyle = window.getComputedStyle(element);
                  if (computedStyle.cursor !== 'auto' && computedStyle.cursor !== 'default') {
                    interactive.style.cursor = computedStyle.cursor;
                  }
                  if (computedStyle.pointerEvents !== 'auto') {
                    interactive.style.pointerEvents = computedStyle.pointerEvents;
                  }
                  if (computedStyle.touchAction !== 'auto') {
                    interactive.style.touchAction = computedStyle.touchAction;
                  }
                  if (computedStyle.userSelect !== 'auto') {
                    interactive.style.userSelect = computedStyle.userSelect;
                  }
                  
                  // Check for data attributes that might indicate gestures
                  const gestureAttributes = [
                    'data-drag', 'data-hover', 'data-tap', 'data-gesture',
                    'data-motion', 'data-framer-gesture'
                  ];
                  
                  gestureAttributes.forEach(attr => {
                    if (element.hasAttribute(attr)) {
                      interactive.gestures.push({
                        type: attr.replace('data-', ''),
                        value: element.getAttribute(attr)
                      });
                    }
                  });
                  
                  // Only include if element has some interactive features
                  if (interactive.events.length > 0 || 
                      Object.keys(interactive.style).length > 0 ||
                      interactive.gestures.length > 0) {
                    gestureInfo.interactiveElements.push(interactive);
                  }
                });
                
                gestureInfo.totalInteractive = gestureInfo.interactiveElements.length;
                
                // Method 2: Look for Framer Motion gesture props in React components
                if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && includeHandlers) {
                  const gestureHandlers = [];
                  
                  const searchForGestureHandlers = (fiber) => {
                    if (!fiber) return;
                    
                    if (fiber.memoizedProps) {
                      const gestureProps = [
                        'whileHover', 'whileTap', 'whileDrag', 'whileFocus',
                        'onTap', 'onTapStart', 'onTapCancel',
                        'onHoverStart', 'onHoverEnd',
                        'onDragStart', 'onDrag', 'onDragEnd',
                        'onPan', 'onPanStart', 'onPanEnd',
                        'drag', 'dragConstraints', 'dragElastic',
                        'dragMomentum', 'dragTransition'
                      ];
                      
                      const foundGestures = [];
                      gestureProps.forEach(prop => {
                        if (fiber.memoizedProps[prop] !== undefined) {
                          foundGestures.push({
                            prop,
                            value: typeof fiber.memoizedProps[prop],
                            hasHandler: typeof fiber.memoizedProps[prop] === 'function'
                          });
                        }
                      });
                      
                      if (foundGestures.length > 0) {
                        gestureHandlers.push({
                          component: fiber.type?.name || 'Unknown',
                          gestures: foundGestures,
                          key: fiber.key,
                          totalGestures: foundGestures.length
                        });
                      }
                    }
                    
                    if (fiber.child) searchForGestureHandlers(fiber.child);
                    if (fiber.sibling) searchForGestureHandlers(fiber.sibling);
                  };
                  
                  const containers = document.querySelectorAll('[data-reactroot], #root, .react-root');
                  containers.forEach(container => {
                    const fiberRoot = container._reactInternalFiber || 
                                    container._reactInternalInstance ||
                                    container.__reactInternalInstance ||
                                    container._reactRootContainer?._internalRoot;
                    
                    if (fiberRoot) {
                      searchForGestureHandlers(fiberRoot.current || fiberRoot);
                    }
                  });
                  
                  gestureInfo.gestureHandlers = gestureHandlers;
                }
                
                // Method 3: Check for drag and drop API usage
                const dragElements = document.querySelectorAll('[draggable="true"]');
                if (dragElements.length > 0) {
                  gestureInfo.dragDropElements = Array.from(dragElements).map(el => ({
                    tagName: el.tagName,
                    className: el.className,
                    id: el.id,
                    draggable: true
                  }));
                }
                
              } catch (error) {
                gestureInfo.error = error.message;
              }
              
              return {
                ...gestureInfo,
                summary: {
                  interactiveElements: gestureInfo.totalInteractive,
                  gestureHandlers: gestureInfo.gestureHandlers.length,
                  dragDropElements: gestureInfo.dragDropElements?.length || 0,
                  hasGestures: gestureInfo.gestureHandlers.length > 0 || gestureInfo.totalInteractive > 0,
                  totalGestureProps: gestureInfo.gestureHandlers.reduce((sum, handler) => sum + handler.totalGestures, 0)
                }
              };
            })()
          `;

          const result = await withScriptExecution(gestureInspectionScript, context);

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
              description: 'CSS selector to filter interactive elements'
            },
            includeHandlers: { 
              type: 'boolean', 
              description: 'Include React component gesture handlers',
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

    // Register framer_motion_performance_analyze tool
    this.registerTool({
      name: 'framer_motion_performance_analyze',
      description: 'Analyze animation performance and frame rates',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            duration: typeof obj.duration === 'number' ? Math.max(1000, Math.min(obj.duration, 60000)) : 5000,
            includeFrameData: typeof obj.includeFrameData === 'boolean' ? obj.includeFrameData : false,
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
          duration: { 
            type: 'number', 
            description: 'Monitoring duration in milliseconds',
            default: 5000,
            minimum: 1000,
            maximum: 60000
          },
          includeFrameData: { 
            type: 'boolean', 
            description: 'Include detailed frame timing data',
            default: false
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
            const duration = ${args.duration};
            const includeFrameData = ${args.includeFrameData === true};
            
            return new Promise((resolve) => {
              const performanceData = {
                startTime: performance.now(),
                frames: [],
                frameRate: 0,
                animationMetrics: {
                  totalAnimations: 0,
                  droppedFrames: 0,
                  averageFrameTime: 0
                }
              };
              
              let frameCount = 0;
              let lastFrameTime = performance.now();
              const frameTimes = [];
              
              // Monitor frame rate during the duration
              const frameCallback = (currentTime) => {
                frameCount++;
                const frameTime = currentTime - lastFrameTime;
                frameTimes.push(frameTime);
                
                if (includeFrameData && performanceData.frames.length < 100) {
                  performanceData.frames.push({
                    time: currentTime,
                    deltaTime: frameTime,
                    frameNumber: frameCount
                  });
                }
                
                lastFrameTime = currentTime;
                
                if (currentTime - performanceData.startTime < duration) {
                  requestAnimationFrame(frameCallback);
                } else {
                  // Calculate metrics
                  const totalTime = currentTime - performanceData.startTime;
                  performanceData.frameRate = Math.round((frameCount / totalTime) * 1000);
                  performanceData.animationMetrics.averageFrameTime = 
                    frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
                  
                  // Count dropped frames (frames > 16.67ms for 60fps)
                  performanceData.animationMetrics.droppedFrames = 
                    frameTimes.filter(time => time > 16.67).length;
                  
                  // Get current active animations
                  if (document.getAnimations) {
                    performanceData.animationMetrics.totalAnimations = document.getAnimations().length;
                  }
                  
                  // Performance entries
                  const paintEntries = performance.getEntriesByType('paint');
                  const measureEntries = performance.getEntriesByType('measure');
                  
                  performanceData.paintMetrics = paintEntries.map(entry => ({
                    name: entry.name,
                    startTime: entry.startTime,
                    duration: entry.duration
                  }));
                  
                  performanceData.measureMetrics = measureEntries
                    .filter(entry => entry.name.includes('animation') || entry.name.includes('frame'))
                    .map(entry => ({
                      name: entry.name,
                      startTime: entry.startTime,
                      duration: entry.duration
                    }));
                  
                  // Memory usage if available
                  if (performance.memory) {
                    performanceData.memoryUsage = {
                      usedJSHeapSize: performance.memory.usedJSHeapSize,
                      totalJSHeapSize: performance.memory.totalJSHeapSize,
                      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                    };
                  }
                  
                  resolve({
                    ...performanceData,
                    endTime: currentTime,
                    totalDuration: totalTime,
                    summary: {
                      frameRate: performanceData.frameRate,
                      droppedFrames: performanceData.animationMetrics.droppedFrames,
                      averageFrameTime: Math.round(performanceData.animationMetrics.averageFrameTime * 100) / 100,
                      performance: performanceData.frameRate >= 55 ? 'excellent' :
                                  performanceData.frameRate >= 45 ? 'good' :
                                  performanceData.frameRate >= 30 ? 'fair' : 'poor'
                    }
                  });
                }
              };
              
              requestAnimationFrame(frameCallback);
            });
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

export class FramerMotionToolProviderFactory extends BaseProviderFactory<FramerMotionToolProvider> {
  create(deps: ProviderDependencies): FramerMotionToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'framer-motion',
      description: 'Framer Motion animation and gesture debugging tools'
    };

    return new FramerMotionToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}