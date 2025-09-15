# Curupira MCP Server Specification

## Overview
Curupira is an MCP (Model Context Protocol) debugging tool for React applications that provides AI assistants with real-time access to browser state, React components, and debugging capabilities.

## Architecture
- **Single Server Implementation**: One unified server supporting multiple transports
- **Transport Options**: WebSocket (Chrome Extension), HTTP/SSE (Claude Code)
- **Configuration**: YAML-based configuration with environment variable overrides
- **Deployment**: Kubernetes-ready with configurable transports

## Development Tasks

### Task 1: Server Architecture Refactoring ✅
**Status**: IN PROGRESS
**Description**: Consolidate multiple server implementations into a single, configurable server

**Implementation Checklist**:
- [ ] Remove duplicate server implementations (server.ts vs server/server.ts)
- [ ] Create unified server with configurable transports
- [ ] Implement transport factory pattern
- [ ] Add YAML configuration support
- [ ] Update CLI to use new server
- [ ] Test all transport modes

**Test Requirements**:
- [ ] WebSocket transport works for Chrome extension
- [ ] HTTP/SSE transport works for Claude Code
- [ ] Health check endpoint responds correctly
- [ ] Configuration loading from YAML works
- [ ] Environment variable overrides work

### Task 2: Transport Configuration System ✅
**Status**: IN PROGRESS
**Description**: Make transports fully configurable via YAML and environment variables

**Implementation Checklist**:
- [ ] Define transport configuration schema
- [ ] Implement HTTP/SSE transport alongside WebSocket
- [ ] Create transport factory based on config
- [ ] Add transport-specific health checks
- [ ] Document transport configuration options

**Test Requirements**:
- [ ] Can enable/disable transports via config
- [ ] Transport-specific settings are applied
- [ ] Multiple transports can run simultaneously
- [ ] Each transport has independent lifecycle

### Task 3: Kubernetes Deployment Configuration ✅
**Status**: PENDING
**Description**: Configure Curupira for NovaSkyn staging with proper transport settings

**Implementation Checklist**:
- [ ] Create ConfigMap with YAML configuration
- [ ] Update deployment to mount config file
- [ ] Configure HTTP/SSE transport for Claude Code
- [ ] Remove conflicting MCP services from cluster
- [ ] Update Istio routing for all endpoints

**Test Requirements**:
- [ ] ConfigMap loads correctly in pod
- [ ] HTTP/SSE endpoints accessible via ingress
- [ ] Health checks pass
- [ ] Claude Code can connect successfully

## Progress Tracking
- Overall Progress: 20%
- Current Focus: Server refactoring
- Next Steps: Complete unified server implementation

## API Specifications

### Transport Configuration Schema
```yaml
transports:
  websocket:
    enabled: boolean
    path: string
    pingInterval: number
    pongTimeout: number
  http:
    enabled: boolean
    path: string
    timeout: number
  sse:
    enabled: boolean
    path: string
    keepAliveInterval: number
```

### Server Endpoints
- `/health` - Health check endpoint
- `/info` - Server information and capabilities
- `/mcp` - WebSocket endpoint for Chrome extension
- `/mcp` - HTTP POST endpoint for Claude Code requests
- `/mcp/sse` - Server-Sent Events endpoint for Claude Code responses

## Architecture Decisions
1. **Single Server Pattern**: Consolidate all server implementations to avoid confusion
2. **Transport Factory**: Use factory pattern to instantiate transports based on config
3. **YAML Configuration**: Use YAML for complex configuration with schema validation
4. **Environment Overrides**: Allow env vars to override YAML settings for deployment flexibility

## Security Considerations
- Authentication disabled for staging environment
- CORS configured for specific origins
- Rate limiting enabled by default
- Sensitive data sanitization before transmission

## Performance Requirements
- Support 10+ concurrent WebSocket connections
- Handle 100+ requests/second on HTTP endpoints
- Memory usage under 512MB
- Startup time under 5 seconds