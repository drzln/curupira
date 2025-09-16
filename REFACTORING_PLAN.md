# Curupira Refactoring Plan

Based on analysis of the codebase and Nexus best practices, here are the identified issues and refactoring tasks:

## 🚨 Critical Violations Found

### 1. File Size Violations (>500 lines)
- `mcp-server/src/mcp/resources/index.ts` - 1019 lines ❌
- `mcp-server/src/server.ts` - 829 lines ❌
- `mcp-server/src/mcp/tools/enhanced.ts` - 819 lines ❌
- `mcp-server/src/chrome/client.ts` - 644 lines ❌
- `mcp-server/src/mcp/tools/comprehensive.ts` - 608 lines ❌
- `mcp-server/src/mcp/discovery/index.ts` - 585 lines ❌
- `mcp-server/src/mcp/resources/providers/state.ts` - 560 lines ❌
- `mcp-server/src/tools/performance-tool.ts` - 552 lines ❌
- `mcp-server/src/mcp/resources/providers/connectivity.ts` - 551 lines ❌

### 2. Type Safety Issues
- 301 occurrences of `any` type across 43 files ❌
- Missing branded types in many places
- Implicit type conversions

### 3. Test Coverage
- Only 3 test files for entire mcp-server ❌
- Missing unit tests for core functionality
- No integration tests for enhanced features

### 4. Code Organization Issues
- Duplicated CDP client implementations
- Mixed concerns in resource providers
- Inconsistent error handling patterns

## 📋 Refactoring Tasks

### Phase 1: File Size Reduction (Priority: High)

#### Task 1.1: Split `mcp/resources/index.ts` (1019 lines)
- [ ] Extract each resource type to separate files
- [ ] Create a registry pattern for resource management
- [ ] Move resource utilities to dedicated utils file

#### Task 1.2: Split `server.ts` (829 lines)
- [ ] Extract transport setup to `server/transport-setup.ts`
- [ ] Extract MCP initialization to `server/mcp-setup.ts`
- [ ] Extract middleware setup to `server/middleware-setup.ts`
- [ ] Keep main server orchestration under 300 lines

#### Task 1.3: Split `mcp/tools/enhanced.ts` (819 lines)
- [ ] Group tools by domain (CDP, React, State, Performance)
- [ ] Create separate handler files for each domain
- [ ] Use composition pattern to combine handlers

#### Task 1.4: Split `chrome/client.ts` (644 lines)
- [ ] Extract domain-specific methods to domain handlers
- [ ] Create connection management module
- [ ] Separate event handling logic

### Phase 2: Type Safety Improvements (Priority: High)

#### Task 2.1: Replace `any` with proper types
- [ ] Create `unknown` type guards for dynamic data
- [ ] Define explicit types for CDP responses
- [ ] Add branded types for all IDs and tokens

#### Task 2.2: Implement exhaustive type checking
- [ ] Add exhaustive switch statements
- [ ] Remove default cases where possible
- [ ] Use discriminated unions for variants

### Phase 3: Test Coverage (Priority: High)

#### Task 3.1: Unit Tests for Core Modules
- [ ] Chrome client tests with mocked CDP
- [ ] Resource provider tests
- [ ] Tool handler tests
- [ ] Security module tests

#### Task 3.2: Integration Tests
- [ ] MCP protocol integration tests
- [ ] Chrome connection integration tests
- [ ] Framework detection tests

#### Task 3.3: E2E Tests
- [ ] Complete debugging flow tests
- [ ] Performance benchmark tests
- [ ] Error handling tests

### Phase 4: Code Quality Improvements (Priority: Medium)

#### Task 4.1: Consistent Error Handling
- [ ] Create centralized error types
- [ ] Implement error recovery strategies
- [ ] Add proper error context

#### Task 4.2: Pure Function Extraction
- [ ] Identify and extract pure functions
- [ ] Remove side effects from core logic
- [ ] Create functional utilities

#### Task 4.3: Documentation
- [ ] Add TSDoc to all public APIs
- [ ] Create architecture diagrams
- [ ] Document MCP protocol extensions

### Phase 5: Architecture Improvements (Priority: Medium)

#### Task 5.1: Implement Proper Dependency Hierarchy
- [ ] Enforce Level 0-4 architecture
- [ ] Remove circular dependencies
- [ ] Create clear module boundaries

#### Task 5.2: State Management
- [ ] Implement XState for connection management
- [ ] Remove any remaining stateful singletons
- [ ] Create proper state machines

## 📊 Success Metrics

- [ ] All files under 500 lines
- [ ] Zero `any` types
- [ ] >80% test coverage
- [ ] Zero circular dependencies
- [ ] All public APIs documented
- [ ] Clean dependency hierarchy

## 🚀 Execution Order

1. **Week 1**: File size reduction (Phase 1)
2. **Week 2**: Type safety improvements (Phase 2)
3. **Week 3**: Test coverage (Phase 3)
4. **Week 4**: Code quality and architecture (Phase 4 & 5)