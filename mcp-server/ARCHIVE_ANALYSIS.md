# Archive Analysis & Migration Plan

## Overview
This document maps out all functionality in the `/archive` directory and provides a systematic plan to extract useful behavior into our modern DI patterns.

## Archive Directory Structure

```
archive/
├── mcp/
│   ├── resources/
│   │   └── providers/
│   │       ├── cdp-resources.ts      - CDP/DevTools resource access
│   │       ├── cdp.ts               - CDP resource provider
│   │       ├── connectivity.ts     - Network connectivity troubleshooting
│   │       ├── react-resources.ts  - React component/state resources
│   │       ├── react.ts            - React framework provider
│   │       ├── state-resources.ts  - State management resources
│   │       └── state.ts            - State management provider
│   └── tools/
│       └── providers/
│           ├── apollo-tools.ts      - Apollo GraphQL tools
│           ├── base.ts             - Base tool provider class
│           ├── binder.ts           - Tool binding utilities
│           ├── cdp-tools.ts        - Chrome DevTools Protocol tools
│           ├── chrome-tools.ts     - Chrome discovery & connection
│           ├── console-tools.ts    - Browser console manipulation
│           ├── debugger-tools.ts   - JavaScript debugger controls
│           ├── dom-tools.ts        - DOM manipulation tools
│           ├── network-tools-typed.ts - Network tools (typed version)
│           ├── network-tools.ts    - Network request tools
│           ├── performance-tools.ts - Performance profiling tools
│           ├── react-tools.ts      - React component tools
│           ├── redux-tools.ts      - Redux DevTools integration
│           ├── state-tools.ts      - Generic state management tools
│           ├── xstate-tools.ts     - XState machine tools
│           └── zustand-tools.ts    - Zustand store tools
```

## Critical Functionality to Extract

### 1. Chrome Discovery & Connection (HIGH PRIORITY)
**File**: `chrome-tools.ts`
**Key Features**:
- Multi-port Chrome instance discovery
- Smart pattern-based app detection (React, localhost, dev servers)
- Connection health assessment
- Detailed troubleshooting recommendations
- Support for multiple Chrome instances

**Status**: ✅ STARTED - Creating `ChromeDiscoveryService`

### 2. Chrome DevTools Protocol Tools (HIGH PRIORITY)
**File**: `cdp-tools.ts`
**Key Features**:
- Direct CDP command execution
- Session management
- Target switching
- CDP event handling

**Migration Plan**: Extract to `mcp/tools/providers/cdp-tools.factory.ts`

### 3. React-Specific Tools (HIGH PRIORITY)
**File**: `react-tools.ts`
**Key Features**:
- Component inspection
- Props/state debugging
- Hook analysis
- Force re-render capabilities
- Fiber tree traversal

**Migration Plan**: Extract to `mcp/tools/providers/react-tools.factory.ts`

### 4. State Management Tools (MEDIUM PRIORITY)
**Files**: 
- `apollo-tools.ts` - GraphQL cache inspection
- `redux-tools.ts` - Redux DevTools integration
- `xstate-tools.ts` - State machine debugging
- `zustand-tools.ts` - Store inspection

**Migration Plan**: Extract to respective factory files in `mcp/tools/providers/`

### 5. DOM & Performance Tools (MEDIUM PRIORITY)
**Files**:
- `dom-tools.ts` - DOM manipulation and querying
- `performance-tools.ts` - Performance profiling
- `console-tools.ts` - Browser console interaction

**Migration Plan**: Extract to factory pattern

### 6. Network Tools (MEDIUM PRIORITY)
**Files**:
- `network-tools.ts` - Network request monitoring
- `network-tools-typed.ts` - Typed version

**Migration Plan**: Merge and extract to `network-tools.factory.ts`

### 7. Resource Providers (MEDIUM PRIORITY)
**Files**:
- `cdp-resources.ts` - CDP resource access
- `react-resources.ts` - React component resources
- `state-resources.ts` - State management resources
- `connectivity.ts` - Network troubleshooting

**Migration Plan**: Already have modern versions, extract missing features

## Migration Strategy

### Phase 1: High-Priority Extractions (This Sprint)
1. ✅ **Chrome Discovery** - Extract discovery logic to `ChromeDiscoveryService`
2. **CDP Tools** - Modern factory-based CDP tool provider
3. **React Tools** - Enhanced React debugging capabilities

### Phase 2: State Management Integration
1. **Apollo Tools** - GraphQL cache inspection
2. **Redux Tools** - Redux DevTools integration  
3. **XState Tools** - State machine debugging
4. **Zustand Tools** - Store inspection

### Phase 3: Core Browser Tools
1. **DOM Tools** - DOM manipulation and querying
2. **Performance Tools** - Performance profiling
3. **Console Tools** - Browser console interaction
4. **Network Tools** - Network request monitoring

### Phase 4: Resource Provider Enhancements
1. **CDP Resources** - Enhanced CDP resource access
2. **React Resources** - Component and state resources
3. **Connectivity Resources** - Network troubleshooting

## Key Patterns to Preserve

### 1. Smart Detection Logic
The archived tools contain sophisticated detection logic for:
- React app identification
- Development environment detection
- State management library detection
- Error pattern recognition

### 2. Comprehensive Error Handling
- Detailed error messages
- Troubleshooting recommendations
- Fallback strategies
- User-friendly guidance

### 3. Performance Optimizations
- Caching strategies
- Debouncing/throttling
- Efficient CDP usage
- Memory management

## Modern DI Patterns to Apply

### 1. Factory Pattern
```typescript
export function createChromeToolsProvider(
  chromeService: IChromeService,
  discoveryService: IChromeDiscoveryService,
  logger: ILogger
): IToolProvider
```

### 2. Configuration-Driven
```typescript
// All hardcoded values moved to YAML configuration
chrome:
  discovery:
    ports: [9222, 9223, 9224]
    patterns: ['localhost', 'react', 'vite']
```

### 3. Type Safety
```typescript
// Replace 'any' types with proper interfaces
interface ReactComponentInfo {
  name: string;
  props: Record<string, unknown>;
  state: Record<string, unknown>;
  hooks: HookInfo[];
}
```

### 4. Error Handling
```typescript
// Standardized error patterns
class CurupiraError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly troubleshooting?: string[]
  ) {
    super(message);
  }
}
```

## Implementation Checklist

### Chrome Discovery (In Progress)
- [x] Create `ChromeDiscoveryService` with DI
- [x] Add YAML configuration support
- [ ] Extract multi-port discovery logic
- [ ] Extract smart pattern detection
- [ ] Extract health assessment
- [ ] Add to DI container
- [ ] Update tool factories to use discovery service

### Chrome Tools
- [ ] Create `cdp-tools.factory.ts`
- [ ] Extract CDP command execution
- [ ] Extract session management
- [ ] Extract error handling patterns
- [ ] Add comprehensive typing

### React Tools  
- [ ] Create enhanced `react-tools.factory.ts`
- [ ] Extract component inspection logic
- [ ] Extract props/state debugging
- [ ] Extract hook analysis
- [ ] Extract force re-render capabilities

### State Management Tools
- [ ] Extract Apollo tools to factory
- [ ] Extract Redux tools to factory
- [ ] Extract XState tools to factory
- [ ] Extract Zustand tools to factory
- [ ] Unify state management interfaces

### Cleanup
- [ ] Verify all useful functionality extracted
- [ ] Remove archive directory
- [ ] Update all imports
- [ ] Update tests
- [ ] Update documentation

## Benefits of This Migration

1. **Maintainability**: All code follows modern DI patterns
2. **Configuration**: Everything configurable via YAML
3. **Type Safety**: Proper TypeScript interfaces
4. **Testing**: Proper dependency injection for mocking
5. **Performance**: Modern optimization patterns
6. **Extensibility**: Easy to add new tools/resources

## Risk Mitigation

1. **Incremental Migration**: Extract one provider at a time
2. **Parallel Development**: Keep archive until migration complete
3. **Comprehensive Testing**: Test each extracted component
4. **Feature Parity**: Ensure no functionality is lost
5. **Documentation**: Document all changes and new patterns

This migration will significantly improve code quality while preserving all the sophisticated debugging capabilities that make Curupira powerful.