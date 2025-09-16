# Curupira Usage Guide

This guide provides practical examples and best practices for using Curupira to debug web applications with Claude.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Browser Control](#basic-browser-control)
3. [DOM Manipulation](#dom-manipulation)
4. [React Debugging](#react-debugging)
5. [State Management Debugging](#state-management-debugging)
6. [Network Debugging](#network-debugging)
7. [Performance Analysis](#performance-analysis)
8. [Advanced Debugging](#advanced-debugging)
9. [Real-World Examples](#real-world-examples)

## Getting Started

### Prerequisites

1. Chrome running in debug mode:
```bash
google-chrome --remote-debugging-port=9222
```

2. Curupira MCP server running (automatically started by Claude Code)

### Basic Setup Verification

Ask Claude: "Can you connect to Chrome and navigate to https://example.com?"

Expected response: Claude should successfully navigate and confirm the page title.

## Basic Browser Control

### Navigation and Screenshots

```
User: Navigate to https://github.com and take a screenshot

Claude will:
1. Use the navigate tool to go to GitHub
2. Wait for page load
3. Use the screenshot tool
4. Return a base64-encoded screenshot
```

### JavaScript Evaluation

```
User: What's the current page title and URL?

Claude will use the evaluate tool:
- expression: "{ title: document.title, url: window.location.href }"
```

### Cookie Management

```
User: Show me all cookies for this domain

Claude will:
1. Use get_cookies tool
2. Format and display cookies with their properties
```

## DOM Manipulation

### Finding Elements

```
User: Find all buttons on the page and tell me their text

Claude will:
1. Use dom_query_selector_all with selector "button"
2. For each button, get the text content
3. Present a formatted list
```

### Interacting with Forms

```
User: Fill in the login form with test credentials

Claude will:
1. Find the username input: dom_query_selector('input[name="username"]')
2. Set its value using evaluate
3. Find the password input: dom_query_selector('input[name="password"]')
4. Set its value
5. Click the submit button
```

### Complex Selectors

```
User: Find all images that are lazy-loaded

Claude will use:
- Selector: 'img[loading="lazy"]'
- Or evaluate: 'document.querySelectorAll("img[data-lazy]")'
```

## React Debugging

### Component Discovery

```
User: Show me all React components on this page

Claude will:
1. Check react://version resource to verify React
2. Read react://components resource
3. Display component hierarchy with props
```

### Component Inspection

```
User: What props does the UserProfile component have?

Claude will:
1. Use react_find_component tool with componentName: "UserProfile"
2. Use react_inspect_props with the component ID
3. Display the props and their values
```

### Hook Analysis

```
User: Show me what hooks the Counter component uses

Claude will:
1. Find the Counter component
2. Read react://hooks resource
3. Display hook types and current values
```

### Performance Profiling

```
User: Profile the rendering performance of this React app for 5 seconds

Claude will:
1. Use react_profile_render tool with duration: 5000
2. Analyze the results
3. Identify slow-rendering components
4. Suggest optimizations
```

## State Management Debugging

### Redux State Inspection

```
User: Show me the current Redux state

Claude will:
1. Use redux_get_state tool
2. Format the state tree
3. Highlight any potential issues
```

### Redux Action Monitoring

```
User: Monitor Redux actions as I click around

Claude will:
1. Use redux_subscribe tool
2. Tell user to interact with the page
3. Use redux_get_action_history to show dispatched actions
```

### Zustand Store Debugging

```
User: What Zustand stores are in this app?

Claude will:
1. Use zustand_list_stores tool
2. For each store, show its state
3. Display subscriber counts
```

### XState Machine Analysis

```
User: Show me the state machines and their current states

Claude will:
1. Use xstate_list_machines for machine definitions
2. Use xstate_list_actors for active instances
3. Display state charts and current values
```

## Network Debugging

### Request Monitoring

```
User: Show me all API calls being made

Claude will:
1. Read cdp://network/requests resource
2. Filter for XHR/Fetch requests
3. Display URL, method, status, timing
```

### Request Interception

```
User: Block all analytics requests

Claude will:
1. Use network_enable_request_interception
2. Use network_block_urls with patterns: ["*google-analytics*", "*segment*"]
```

### Response Mocking

```
User: Mock the /api/users endpoint to return test data

Claude will:
1. Use network_mock_response with:
   - url: "/api/users"
   - response: { status: 200, body: JSON.stringify(testUsers) }
```

### Network Throttling

```
User: Test how the app behaves on slow 3G

Claude will:
1. Use network_set_throttling with profile: "Slow 3G"
2. Navigate or refresh the page
3. Measure load times and identify issues
```

## Performance Analysis

### Memory Profiling

```
User: Check for memory leaks

Claude will:
1. Get initial metrics with performance_get_metrics
2. Perform repeated actions
3. Force garbage collection
4. Compare memory usage
5. Identify potential leaks
```

### CPU Profiling

```
User: Find performance bottlenecks

Claude will:
1. Use performance_start_profiling
2. Have user perform actions
3. Use performance_stop_profiling
4. Analyze top functions by time spent
5. Suggest optimizations
```

### Resource Analysis

```
User: Which resources are slowing down the page?

Claude will:
1. Use performance_get_resource_timing
2. Sort by duration
3. Identify large files, slow endpoints
4. Check for render-blocking resources
```

## Advanced Debugging

### Debugging Minified Code

```
User: Set a breakpoint in the minified code where errors occur

Claude will:
1. Find error location from console
2. Use debugger_set_breakpoint_by_url with URL regex
3. When breakpoint hits, examine variables
4. Step through execution
```

### Tracing Function Calls

```
User: Trace all calls to the updateCart function

Claude will:
1. Use performance_trace_functions with functionName: "updateCart"
2. Instruct user to trigger the function
3. Show call stack and arguments
```

### Memory Leak Detection

```
User: Help me find what's causing memory leaks

Claude will:
1. Take heap snapshot (through evaluate)
2. Perform suspicious actions
3. Take another snapshot
4. Compare retained objects
5. Identify leak sources
```

## Real-World Examples

### E-commerce Debugging Session

```
User: The checkout process is broken. Help me debug it.

Claude's approach:
1. Navigate to the product page
2. Monitor network requests while adding to cart
3. Check Redux/Zustand state for cart updates
4. Follow the checkout flow
5. Identify where the process breaks
6. Check console for errors
7. Examine failed API calls
8. Suggest fixes
```

### React Performance Optimization

```
User: This React app feels sluggish. Help me optimize it.

Claude's approach:
1. Profile initial render performance
2. Identify components re-rendering unnecessarily
3. Check for missing React.memo or useMemo
4. Analyze bundle size
5. Look for large lists without virtualization
6. Check for synchronous operations in render
7. Provide optimization recommendations
```

### Authentication Flow Debugging

```
User: Users are getting logged out randomly. Help me debug.

Claude's approach:
1. Examine authentication cookies
2. Monitor auth-related network requests
3. Check token expiration in state
4. Watch for 401 responses
5. Trace logout actions
6. Identify the trigger for unwanted logouts
```

### Form Validation Issues

```
User: Form validation isn't working correctly.

Claude's approach:
1. Find form elements
2. Test various input combinations
3. Monitor validation state changes
4. Check event listeners
5. Examine validation logic
6. Test edge cases
```

## Best Practices

### 1. Always Verify Connection
Before debugging, ensure Chrome connection:
```
evaluate: "window.location.href"
```

### 2. Use Specific Selectors
Instead of: `"div"`
Use: `"div.user-profile"` or `"[data-testid='user-profile']"`

### 3. Handle Async Operations
For async operations:
```javascript
evaluate with awaitPromise: true
```

### 4. Clean Up After Debugging
- Disable request interception
- Remove breakpoints
- Clear network throttling
- Stop profiling sessions

### 5. Work with Dynamic Content
For SPAs and dynamic content:
1. Wait for elements to appear
2. Re-query DOM after updates
3. Monitor state changes

### 6. Minimize Performance Impact
- Limit profiling duration
- Use sampling intervals
- Clear large data collections
- Disable unused features

## Troubleshooting Common Issues

### "Element not found"
- Element may not be loaded yet
- Try waiting or checking element presence first
- Verify selector syntax

### "Node ID is stale"
- DOM has changed since query
- Re-query for the element
- Use stable selectors

### "Execution context destroyed"
- Page navigated or refreshed
- Re-establish context
- Rerun initialization

### "Memory issues"
- Too much console data
- Large profiling sessions
- Clear buffers periodically
- Restart Chrome if needed

## Integration with Development Workflow

### Continuous Debugging
1. Keep Chrome open in debug mode
2. Use Curupira throughout development
3. Create debugging scripts for common tasks
4. Document found issues

### Team Collaboration
1. Share debugging sessions
2. Create reproducible test cases
3. Document debugging steps
4. Build debugging playbooks

### CI/CD Integration
1. Use Curupira in headless Chrome
2. Automate performance checks
3. Validate state management
4. Check for memory leaks

## Conclusion

Curupira provides powerful debugging capabilities when used effectively. The key is understanding the available tools and applying them systematically to solve problems. Start with basic operations and gradually incorporate advanced features as needed.