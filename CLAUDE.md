# Curupira Development Guide for Claude

This guide outlines the systematic approach to developing Curupira - the CDP-native MCP debugging platform for React applications.

## 🚨 CRITICAL RULES (STRICTLY HIERARCHICAL & DETERMINISTIC)

### RULE 0: **Strict Dependency Hierarchy** 🏗️

- **Level N → Level 0 to N-1 ONLY** (no upward/circular/sideways)
- **Dependency graph = DAG** (Directed Acyclic Graph)
- **Violations = build failure**

### RULE 1: **One Canonical Implementation** 🗡️

- **ONE of everything**: CDP client, resource provider, tool handler
- **Find duplicates → Delete → Update imports**
- **PR with duplicates = auto-reject**

### RULE 2: **Pure Functional Core** 🧪

- **Business logic = pure functions**
- **Components = pure** (props → same output)
- **Side effects in boundaries only** (Chrome API, MCP transport)
- **Test everything** (behavior, not implementation)

### RULE 3: **Explicit State Machines** 🎯

- **ALL state = XState machines** (useState BANNED)
- **Every state explicitly defined**
- **Illegal transitions impossible**
- **Chrome connection states managed deterministically**

### RULE 4: **Type-Driven Architecture** 📐

- **Types first, code second**
- **Branded types** (SessionId, TargetId, not string)
- **Named exports only** (testability)
- **Exhaustive matching** (no defaults)

### RULE 5: **Technology Stack Compliance** 🛠️

- **State**: XState + TypeScript strict mode
- **Testing**: Vitest + MSW + Chrome DevTools Protocol mocks
- **Chrome API**: Native Chrome DevTools Protocol over WebSocket
- **MCP**: Official @modelcontextprotocol/sdk
- **Build**: TypeScript 5.2+ with strict mode

### RULE 6: **Modular Boundaries** 📦

- **Max 500 lines/file** (200 for React components)
- **Feature folders** with index.ts exports
- **Private internals** (not exported)
- **Clear public APIs**

### RULE 7: **Dependency Injection** 📦

- **Develop for maximum testability and maintainance**

## 📊 Strict Hierarchy (Dependencies Flow DOWN Only)

```
Level 0: Foundation    → types, errors, constants, pure utils
Level 1: Chrome Core   → CDP client, connection management
Level 2: MCP Core      → resource providers, tool handlers
Level 3: Integration   → React detection, state management bridges
Level 4: Server        → transport, routing, main server
```

**RULE**: Level N imports ONLY from Level 0 to N-1

## 🔄 Implementation Process

1. **Type-First**: Define CDP/MCP types and interfaces
2. **Bottom-Up**: Build Level 0 → 4
3. **Test Each Level**: Before proceeding up
4. **Enforce Hierarchy**: No upward imports

