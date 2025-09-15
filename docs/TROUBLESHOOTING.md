# Curupira MCP Server - Troubleshooting Guide

## Table of Contents

- [Common Issues](#common-issues)
- [Connection Problems](#connection-problems)
- [Performance Issues](#performance-issues)
- [Security & Authentication](#security--authentication)
- [Debugging Curupira Itself](#debugging-curupira-itself)
- [FAQ](#faq)

## Common Issues

### 1. Cannot Connect to Chrome

**Symptoms:**
- "Failed to connect to Chrome DevTools Protocol"
- Connection timeout errors

**Solutions:**

1. **Verify Chrome is running with debugging enabled:**
   ```bash
   # Check if Chrome is listening
   curl http://localhost:9222/json/version
   
   # Start Chrome with debugging
   google-chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check
   ```

2. **Check environment variables:**
   ```bash
   echo $CURUPIRA_CDP_HOST  # Should be localhost or chrome service
   echo $CURUPIRA_CDP_PORT  # Should be 9222 or 3000 for browserless
   ```

3. **For Kubernetes deployments:**
   ```bash
   # Verify Chrome service is running
   kubectl get svc -n shared-services chrome-headless
   
   # Check connectivity
   kubectl run test-pod --rm -it --image=curlimages/curl -- \
     curl http://chrome-headless.shared-services.svc.cluster.local:3000/json/version
   ```

### 2. No React Components Found

**Symptoms:**
- Empty component tree
- "React not detected" errors

**Solutions:**

1. **Verify React DevTools is available:**
   ```javascript
   // In browser console
   window.__REACT_DEVTOOLS_GLOBAL_HOOK__
   ```

2. **Check React version compatibility:**
   - Curupira supports React 16.8+
   - React must be in development mode for full features

3. **For production React apps:**
   ```javascript
   // Some features are limited in production builds
   // Consider using React Profiler build for better debugging
   ```

### 3. State Management Not Detected

**Symptoms:**
- XState machines not found
- Zustand stores empty

**Solutions:**

1. **Ensure stores are properly exposed:**
   ```javascript
   // For Zustand
   window.__ZUSTAND_STORES__ = new Map();
   
   // For XState
   window.__XSTATE_MACHINES__ = new Map();
   ```

2. **Check if state management is initialized:**
   ```javascript
   // Verify in console
   Array.from(window.__ZUSTAND_STORES__.keys())
   ```

## Connection Problems

### WebSocket Connection Failed

**Error:** "WebSocket connection to 'ws://localhost:3000/mcp' failed"

**Solutions:**

1. **Check transport type:**
   ```bash
   # For stdio (default)
   CURUPIRA_TRANSPORT=stdio
   
   # For HTTP/SSE
   CURUPIRA_TRANSPORT=sse
   CURUPIRA_PORT=3000
   ```

2. **Verify CORS settings:**
   ```javascript
   // For browser connections
   CURUPIRA_CORS_ORIGINS=http://localhost:3000,https://myapp.com
   ```

3. **Check firewall/proxy settings:**
   - Ensure port 3000 is accessible
   - WebSocket upgrade headers must be allowed

### Authentication Failures

**Error:** "Authentication failed" or "No token provided"

**Solutions:**

1. **In development (auth disabled):**
   ```bash
   NODE_ENV=development
   ```

2. **In production (JWT required):**
   ```javascript
   // Include token in header
   Authorization: Bearer <your-jwt-token>
   
   // Or in query string for SSE
   /mcp?token=<your-jwt-token>
   ```

3. **Verify JWT configuration:**
   ```bash
   # Required environment variables
   CURUPIRA_JWT_SECRET=your-secret
   CURUPIRA_JWT_ISSUER=curupira.nexus.io
   CURUPIRA_JWT_AUDIENCE=curupira-mcp
   ```

## Performance Issues

### High Memory Usage

**Symptoms:**
- Memory usage growing over time
- Slow response times

**Solutions:**

1. **Adjust cache settings:**
   ```bash
   CURUPIRA_CACHE_SIZE=50  # Reduce from default 100
   CURUPIRA_MAX_CONSOLE_LOGS=500  # Reduce from 1000
   CURUPIRA_MAX_NETWORK_REQUESTS=250  # Reduce from 500
   ```

2. **Enable memory limits:**
   ```yaml
   # In Kubernetes
   resources:
     limits:
       memory: "512Mi"
   ```

3. **Monitor memory usage:**
   ```bash
   # Check metrics endpoint
   curl http://localhost:3000/metrics | grep memory
   ```

### Slow Resource Queries

**Symptoms:**
- Timeouts when reading resources
- Slow component tree traversal

**Solutions:**

1. **Optimize queries:**
   ```javascript
   // Limit component depth
   CURUPIRA_MAX_COMPONENT_DEPTH=10
   
   // Reduce detail level
   CURUPIRA_COMPONENT_DETAIL_LEVEL=basic
   ```

2. **Use caching effectively:**
   ```javascript
   // Resources are cached for better performance
   // Clear cache if stale data is an issue
   ```

## Security & Authentication

### Command Blocked by Security Policy

**Error:** "Operation blocked by security policy"

**Solutions:**

1. **Check whitelist configuration:**
   ```javascript
   // In production, certain commands are blocked
   // Review allowed commands in security policy
   ```

2. **For development/testing:**
   ```bash
   # Disable security restrictions
   NODE_ENV=development
   CURUPIRA_SECURITY_ENABLED=false
   ```

### Rate Limit Exceeded

**Error:** "Rate limit exceeded. Try again in X seconds"

**Solutions:**

1. **Check current limits:**
   ```bash
   # Response headers show limits
   X-RateLimit-Limit: 100
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: 1234567890
   ```

2. **Adjust rate limits (development):**
   ```javascript
   CURUPIRA_RATE_LIMIT_GLOBAL_MAX=1000
   CURUPIRA_RATE_LIMIT_WINDOW=1m
   ```

3. **Use authenticated requests:**
   - Authenticated users typically have higher limits

## Debugging Curupira Itself

### Enable Debug Logging

```bash
# Verbose logging
CURUPIRA_LOG_LEVEL=debug
CURUPIRA_LOG_PRETTY=true

# View specific components
DEBUG=curupira:* npm start
```

### Check Health Status

```bash
# Health endpoint
curl http://localhost:3000/health

# Expected response
{
  "status": "healthy",
  "checks": {
    "chrome": { "connected": true },
    "memory": { "heapUsed": 50000000 }
  }
}
```

### Common Log Messages

```
INFO: Starting Curupira MCP server
INFO: Connected to Chrome DevTools Protocol
WARN: Chrome connection lost, attempting reconnect...
ERROR: Failed to execute tool: dom/click
```

### Using Chrome DevTools

1. **Inspect WebSocket traffic:**
   - Open Chrome DevTools > Network > WS
   - Filter for MCP messages

2. **Monitor CDP commands:**
   ```javascript
   // Enable CDP logging
   CURUPIRA_CDP_DEBUG=true
   ```

## FAQ

### Q: Why can't I see all React components?

**A:** In production builds, React removes some debugging information. For full debugging:
1. Use React development builds
2. Enable React Profiler builds
3. Some internal components may be hidden

### Q: How do I debug Curupira in a container?

**A:** Use these techniques:
```bash
# View logs
docker logs curupira-container

# Execute commands inside container
docker exec -it curupira-container sh

# Enable debug mode
docker run -e CURUPIRA_LOG_LEVEL=debug ...
```

### Q: Can I use Curupira with Chrome extensions?

**A:** Yes, but with limitations:
- Extensions run in isolated contexts
- Some CDP commands may not work
- Use extension debugging mode

### Q: How do I handle large applications?

**A:** For apps with many components:
1. Increase memory limits
2. Use filtered queries
3. Enable pagination for large result sets
4. Consider sampling instead of full traversal

### Q: What's the performance impact?

**A:** Typical overhead:
- Memory: 50-100MB base + cache
- CPU: <5% during active debugging
- Network: Minimal (local WebSocket)

### Q: Can I use Curupira in production?

**A:** Yes, with precautions:
1. Enable authentication
2. Use security policies
3. Set appropriate rate limits
4. Monitor resource usage
5. Consider read-only access

## Getting Help

### 1. Check Logs
```bash
# Curupira logs
CURUPIRA_LOG_LEVEL=debug npm start 2>&1 | tee debug.log

# Chrome logs
google-chrome --enable-logging --v=1
```

### 2. Diagnostic Commands
```bash
# Test Chrome connection
curl http://localhost:9222/json/version

# Test Curupira health
curl http://localhost:3000/health

# List available resources
curl http://localhost:3000/mcp \
  -X POST \
  -d '{"method": "resources/list"}'
```

### 3. Report Issues

Include:
- Curupira version
- Chrome version
- Node.js version
- Environment (OS, Docker, K8s)
- Error messages and logs
- Steps to reproduce

GitHub Issues: https://github.com/drzln/curupira/issues