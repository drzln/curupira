# Curupira Tool Improvements & Implementation Plan

## 📋 Overview

This document tracks all tool fixes and new implementations needed for the Curupira MCP Debug Server based on comprehensive testing performed on 2025-09-17.

---

## 🔧 Tools Requiring Fixes

### 1. **Debugger Tools** (HIGH PRIORITY)
#### Issues:
- `debugger_set_breakpoint` - Validation schema failing
- `debugger_evaluate_expression` - Validation schema failing

#### Theory/Solution:
The schema validation is likely too strict or missing required parameters. Need to:
1. Check the schema definition in `debugger-tools.factory.ts`
2. Ensure the schema matches what the CDP `Debugger.setBreakpointByUrl` expects
3. The breakpoint tool might need `columnNumber` as optional, not required
4. Evaluate expression might need proper execution context handling

```typescript
// Likely fix for debugger_set_breakpoint schema
const setBreakpointSchema = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    lineNumber: { type: 'number' },
    columnNumber: { type: 'number' }, // Should be optional
    condition: { type: 'string' } // Should be optional
  },
  required: ['url', 'lineNumber'] // Remove columnNumber from required
}
```

---

### 2. **React Tools** (HIGH PRIORITY)
#### Issues:
- `react_get_component_tree` - "React fiber not found" error
- `react_find_component` - Schema validation failing
- `react_inspect_component` - Will fail due to fiber issues
- `react_profiler` - Script execution error

#### Theory/Solution:
The React DevTools detection works, but fiber root access is failing. This suggests:
1. Production React builds minimize fiber exposure
2. Need to access React internals differently, possibly through `__REACT_DEVTOOLS_GLOBAL_HOOK__`
3. The component search might be using the wrong property names

```typescript
// Better React fiber detection
const getFiberRoot = () => {
  // Try multiple strategies
  // 1. Through DevTools hook
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook && hook.renderers && hook.renderers.size > 0) {
    const renderer = hook.renderers.values().next().value;
    return renderer.getFiberRoots();
  }
  
  // 2. Through DOM element
  const root = document.getElementById('root');
  if (root && root._reactRootContainer) {
    return root._reactRootContainer._internalRoot;
  }
  
  // 3. Through React 18's new root API
  const reactRoot = root?._reactRoot;
  if (reactRoot) return reactRoot;
}
```

---

### 3. **Performance Tools** (HIGH PRIORITY)
#### Issues:
- `performance_get_metrics` - Returns empty object
- `performance_measure_js` - Shows all zeros for timing

#### Theory/Solution:
1. `performance_get_metrics` needs to use CDP's `Performance.getMetrics` method
2. Timing measurements need proper high-resolution timer setup

```typescript
// Fix for performance_get_metrics
async getMetrics() {
  const metrics = await this.cdpClient.send('Performance.getMetrics');
  const mapped = {};
  for (const metric of metrics.metrics) {
    mapped[metric.name] = metric.value;
  }
  return mapped;
}

// Fix for measure_js timing
async measureJS(code: string, iterations: number) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = await this.cdpClient.evaluate('performance.now()');
    await this.cdpClient.evaluate(code);
    const end = await this.cdpClient.evaluate('performance.now()');
    times.push(end - start);
  }
  return {
    times,
    average: times.reduce((a, b) => a + b) / times.length,
    min: Math.min(...times),
    max: Math.max(...times)
  };
}
```

---

### 4. **Storage Tools** (MEDIUM PRIORITY)
#### Issues:
- `set_local_storage` - Schema validation failing

#### Theory/Solution:
The schema might be expecting a different structure. CDP uses specific format for DOM storage.

```typescript
// Fix schema to match CDP expectations
const setStorageSchema = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    value: { type: 'string' }, // Must be string, not any type
    sessionId: { type: 'string' } // Make optional
  },
  required: ['key', 'value']
}
```

---

### 5. **Framework Detection** (MEDIUM PRIORITY)
#### Issues:
- `framework_version` - Returns "unknown" for React version

#### Theory/Solution:
Need to extract version from React object or DevTools

```typescript
// Better version detection
const detectReactVersion = () => {
  // Try React global
  if (window.React && window.React.version) {
    return window.React.version;
  }
  
  // Try through DevTools
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook && hook.renderers) {
    for (const [id, renderer] of hook.renderers) {
      if (renderer.version) return renderer.version;
    }
  }
  
  // Try from loaded scripts
  const scripts = Array.from(document.scripts);
  for (const script of scripts) {
    if (script.src.includes('react') && script.src.includes('@')) {
      const match = script.src.match(/react@([0-9.]+)/);
      if (match) return match[1];
    }
  }
}
```

---

## 🆕 New Tools to Implement

### 1. **CSS Inspection Tools** (HIGH PRIORITY)

#### `css_get_computed_styles`
```typescript
{
  name: 'css_get_computed_styles',
  description: 'Get computed styles for an element',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string' },
      properties: { 
        type: 'array', 
        items: { type: 'string' },
        description: 'Specific properties to retrieve'
      }
    },
    required: ['selector']
  },
  async execute(args) {
    const elements = document.querySelectorAll(args.selector);
    const results = [];
    
    for (const el of elements) {
      const computed = window.getComputedStyle(el);
      const styles = {};
      
      if (args.properties) {
        for (const prop of args.properties) {
          styles[prop] = computed.getPropertyValue(prop);
        }
      } else {
        // Get all styles
        for (let i = 0; i < computed.length; i++) {
          const prop = computed[i];
          styles[prop] = computed.getPropertyValue(prop);
        }
      }
      
      results.push(styles);
    }
    
    return results;
  }
}
```

#### `css_get_stylesheets`
```typescript
{
  name: 'css_get_stylesheets',
  description: 'List all stylesheets and their rules',
  async execute() {
    const stylesheets = [];
    
    for (const sheet of document.styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        stylesheets.push({
          href: sheet.href,
          media: sheet.media.mediaText,
          disabled: sheet.disabled,
          ruleCount: rules.length,
          rules: rules.map(r => ({
            selector: r.selectorText,
            style: r.style?.cssText
          }))
        });
      } catch (e) {
        // Cross-origin stylesheet
        stylesheets.push({
          href: sheet.href,
          error: 'Cross-origin stylesheet'
        });
      }
    }
    
    return stylesheets;
  }
}
```

#### `css_get_animations`
```typescript
{
  name: 'css_get_animations',
  description: 'Get active animations and transitions',
  async execute() {
    const animations = document.getAnimations();
    return animations.map(anim => ({
      id: anim.id,
      playState: anim.playState,
      startTime: anim.startTime,
      currentTime: anim.currentTime,
      playbackRate: anim.playbackRate,
      target: {
        tagName: anim.effect?.target?.tagName,
        id: anim.effect?.target?.id,
        className: anim.effect?.target?.className
      },
      timing: anim.effect?.getTiming()
    }));
  }
}
```

#### `css_inject_styles`
```typescript
{
  name: 'css_inject_styles',
  description: 'Inject temporary CSS for testing',
  inputSchema: {
    type: 'object',
    properties: {
      css: { type: 'string' },
      id: { type: 'string', default: 'curupira-injected-styles' }
    },
    required: ['css']
  },
  async execute(args) {
    let style = document.getElementById(args.id);
    if (!style) {
      style = document.createElement('style');
      style.id = args.id;
      document.head.appendChild(style);
    }
    style.textContent = args.css;
    return { injected: true, id: args.id };
  }
}
```

---

### 2. **State Management Tools**

#### `state_inspect_zustand` (If Zustand detected)
```typescript
{
  name: 'state_inspect_zustand',
  description: 'Inspect Zustand store state',
  async execute() {
    // Find Zustand stores through React DevTools
    const stores = [];
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    
    // Traverse fiber tree looking for Zustand providers
    // Extract store state and actions
    
    return stores;
  }
}
```

#### `state_inspect_apollo`
```typescript
{
  name: 'state_inspect_apollo',
  description: 'Inspect Apollo Client cache',
  async execute() {
    // Access Apollo Client through window.__APOLLO_CLIENT__
    const client = window.__APOLLO_CLIENT__;
    if (!client) return { error: 'Apollo Client not found' };
    
    return {
      cache: client.cache.extract(),
      queries: client.queryManager.getObservableQueries(),
      mutations: client.queryManager.mutationStore
    };
  }
}
```

#### `state_inspect_context`
```typescript
{
  name: 'state_inspect_context',
  description: 'Inspect React Context values',
  async execute() {
    // This is complex - need to traverse fiber tree
    // and extract context values from providers
    const contexts = [];
    
    // Use React DevTools hook to access fiber tree
    // Find Context.Provider nodes
    // Extract their values
    
    return contexts;
  }
}
```

---

### 3. **Accessibility Tools**

#### `a11y_audit`
```typescript
{
  name: 'a11y_audit',
  description: 'Run accessibility audit',
  async execute() {
    const issues = [];
    
    // Check for missing alt text
    const images = document.querySelectorAll('img:not([alt])');
    issues.push(...Array.from(images).map(img => ({
      type: 'missing-alt',
      element: getElementPath(img)
    })));
    
    // Check color contrast
    // Check ARIA labels
    // Check keyboard navigation
    
    return issues;
  }
}
```

---

### 4. **Advanced Debugging Tools**

#### `debug_memory_leaks`
```typescript
{
  name: 'debug_memory_leaks',
  description: 'Detect potential memory leaks',
  async execute() {
    // Take heap snapshots over time
    // Compare retained objects
    // Identify growing collections
  }
}
```

#### `debug_event_listeners`
```typescript
{
  name: 'debug_event_listeners',
  description: 'List all event listeners',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string' }
    }
  },
  async execute(args) {
    // Use Chrome's getEventListeners API
    const element = document.querySelector(args.selector);
    return getEventListeners(element);
  }
}
```

---

## 📈 Implementation Priority

### Phase 1 (Immediate)
1. Fix debugger validation schemas
2. Fix React fiber detection
3. Fix performance metrics
4. Implement basic CSS inspection tools

### Phase 2 (Short-term)
1. Implement Apollo Client inspection
2. Fix storage validation
3. Add CSS animation tools
4. Implement accessibility audit

### Phase 3 (Medium-term)
1. Add Zustand/Redux detection and inspection
2. Implement memory leak detection
3. Add WebSocket monitoring
4. Implement Service Worker tools

---

## 🧪 Testing Strategy

1. **Unit Tests**: Test each tool in isolation with mock CDP client
2. **Integration Tests**: Test against real Chrome instance with test pages
3. **Framework Tests**: Create test apps for each state management library
4. **Performance Tests**: Ensure tools don't impact page performance

---

## 📝 Notes

- All new tools should follow the existing pattern in the factory classes
- Use dependency injection for all services
- Implement proper error handling and validation
- Add comprehensive logging for debugging
- Follow TypeScript strict mode requirements
- Ensure all tools work with both development and production builds