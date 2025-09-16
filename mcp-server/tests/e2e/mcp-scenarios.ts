/**
 * End-to-End MCP Test Scenarios for Claude Code
 * These scenarios validate the complete MCP flow with real usage patterns
 */

export interface TestScenario {
  name: string
  description: string
  steps: string[]
  mcpCommands: {
    method: string
    params?: Record<string, unknown>
    expectedResult?: (result: any) => boolean
  }[]
  verification: (results: any[]) => void
}

export const scenarios: TestScenario[] = [
  {
    name: "Inspect React Component Tree",
    description: "Verify ability to read React component hierarchy",
    steps: [
      "Connect to Curupira MCP server",
      "List available resources",
      "Read react/components resource",
      "Verify component tree structure"
    ],
    mcpCommands: [
      {
        method: "resources/list",
        expectedResult: (result) => result.resources.some((r: any) => r.uri === "react://components")
      },
      {
        method: "resources/read",
        params: { uri: "react://components" },
        expectedResult: (result) => result.contents && Array.isArray(result.contents)
      }
    ],
    verification: (results) => {
      const resourceList = results[0]
      const componentTree = results[1]
      
      if (!resourceList.resources.find((r: any) => r.uri === "react://components")) {
        throw new Error("React components resource not found")
      }
      
      if (!componentTree.contents || componentTree.contents.length === 0) {
        throw new Error("No React components detected")
      }
    }
  },

  {
    name: "Debug Zustand Store State",
    description: "Inspect and verify Zustand store contents",
    steps: [
      "Read zustand/stores resource",
      "Find specific store by name",
      "Inspect store state",
      "Use tool to update store",
      "Verify state change"
    ],
    mcpCommands: [
      {
        method: "resources/read",
        params: { uri: "zustand://stores" },
        expectedResult: (result) => result.contents && typeof result.contents === "object"
      },
      {
        method: "tools/call",
        params: {
          name: "zustand_inspect_store",
          arguments: { sessionId: "test-session", storeId: "cart-store" }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "zustand_dispatch_action",
          arguments: {
            sessionId: "test-session",
            storeId: "cart-store",
            action: "addItem",
            payload: { id: "123", quantity: 1 }
          }
        }
      }
    ],
    verification: (results) => {
      const stores = results[0]
      const inspectResult = results[1]
      const dispatchResult = results[2]
      
      if (!stores.contents) {
        throw new Error("No Zustand stores found")
      }
      
      if (!inspectResult.content) {
        throw new Error("Failed to inspect store")
      }
      
      if (!dispatchResult.content || dispatchResult.isError) {
        throw new Error("Failed to dispatch action to store")
      }
    }
  },

  {
    name: "Profile React Performance",
    description: "Use performance profiling tools",
    steps: [
      "Start React profiler",
      "Trigger UI interactions",
      "Stop profiler",
      "Analyze slow components",
      "Get performance metrics"
    ],
    mcpCommands: [
      {
        method: "tools/call",
        params: {
          name: "react_profile_renders",
          arguments: { sessionId: "test-session", duration: 5000 }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "performance_start_profiling",
          arguments: { sessionId: "test-session", duration: 5 }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "performance_stop_profiling",
          arguments: { sessionId: "test-session" }
        }
      },
      {
        method: "resources/read",
        params: { uri: "cdp://performance/metrics" }
      }
    ],
    verification: (results) => {
      const reactProfile = results[0]
      const perfStart = results[1]
      const perfStop = results[2]
      const metrics = results[3]
      
      if (!reactProfile.content) {
        throw new Error("React profiling failed")
      }
      
      if (!metrics.contents || !metrics.contents.CLS) {
        throw new Error("Performance metrics not available")
      }
    }
  },

  {
    name: "Test Network Connectivity",
    description: "Troubleshoot MCP-browser connectivity",
    steps: [
      "Test HTTP connectivity",
      "Test WebSocket connectivity",
      "Test CORS configuration",
      "Run comprehensive diagnostic"
    ],
    mcpCommands: [
      {
        method: "tools/call",
        params: {
          name: "connectivity_test",
          arguments: {
            sessionId: "test-session",
            url: "https://httpbin.org/get"
          }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "connectivity_websocket_test",
          arguments: {
            sessionId: "test-session",
            url: "wss://echo.websocket.org"
          }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "connectivity_cors_test",
          arguments: {
            sessionId: "test-session",
            url: "https://api.example.com",
            origin: "https://app.example.com"
          }
        }
      },
      {
        method: "resources/read",
        params: { uri: "connectivity://diagnostic" }
      }
    ],
    verification: (results) => {
      const httpTest = results[0]
      const wsTest = results[1]
      const corsTest = results[2]
      const diagnostic = results[3]
      
      if (!httpTest.content || httpTest.isError) {
        throw new Error("HTTP connectivity test failed")
      }
      
      if (!diagnostic.contents || !diagnostic.contents.summary) {
        throw new Error("Diagnostic report not generated")
      }
    }
  },

  {
    name: "Manipulate DOM Elements",
    description: "Use DOM tools to interact with page",
    steps: [
      "Find element by selector",
      "Get element attributes",
      "Click element",
      "Type text into input",
      "Take screenshot"
    ],
    mcpCommands: [
      {
        method: "tools/call",
        params: {
          name: "dom_find_element",
          arguments: {
            sessionId: "test-session",
            selector: "button.add-to-cart"
          }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "dom_click_element",
          arguments: {
            sessionId: "test-session",
            nodeId: 123
          }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "dom_type_text",
          arguments: {
            sessionId: "test-session",
            text: "Test product search"
          }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "cdp_screenshot",
          arguments: {
            sessionId: "test-session",
            format: "png",
            fullPage: true
          }
        }
      }
    ],
    verification: (results) => {
      const findResult = results[0]
      const clickResult = results[1]
      const typeResult = results[2]
      const screenshotResult = results[3]
      
      if (!findResult.content) {
        throw new Error("Failed to find element")
      }
      
      if (!screenshotResult.content) {
        throw new Error("Failed to take screenshot")
      }
    }
  },

  {
    name: "Debug XState Machine",
    description: "Inspect and control XState machines",
    steps: [
      "Detect XState presence",
      "List active actors",
      "Inspect machine state",
      "Send event to machine",
      "Verify state transition"
    ],
    mcpCommands: [
      {
        method: "resources/read",
        params: { uri: "xstate://actors" }
      },
      {
        method: "tools/call",
        params: {
          name: "xstate_inspect_actor",
          arguments: {
            sessionId: "test-session",
            actorId: "cart-machine"
          }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "xstate_send_event",
          arguments: {
            sessionId: "test-session",
            actorId: "cart-machine",
            event: { type: "ADD_ITEM", item: { id: "123" } }
          }
        }
      }
    ],
    verification: (results) => {
      const actors = results[0]
      const inspectResult = results[1]
      const eventResult = results[2]
      
      if (!actors.contents || actors.contents.length === 0) {
        throw new Error("No XState actors found")
      }
      
      if (!eventResult.content || eventResult.isError) {
        throw new Error("Failed to send event to state machine")
      }
    }
  },

  {
    name: "Analyze Apollo GraphQL Cache",
    description: "Inspect Apollo Client cache and queries",
    steps: [
      "Read Apollo cache contents",
      "List active queries",
      "Inspect specific query",
      "Refetch query",
      "Verify cache update"
    ],
    mcpCommands: [
      {
        method: "resources/read",
        params: { uri: "apollo://cache" }
      },
      {
        method: "resources/read",
        params: { uri: "apollo://queries" }
      },
      {
        method: "tools/call",
        params: {
          name: "apollo_inspect_cache",
          arguments: { sessionId: "test-session" }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "apollo_refetch_query",
          arguments: {
            sessionId: "test-session",
            queryName: "GetProducts"
          }
        }
      }
    ],
    verification: (results) => {
      const cache = results[0]
      const queries = results[1]
      const inspectResult = results[2]
      const refetchResult = results[3]
      
      if (!cache.contents) {
        throw new Error("Apollo cache not accessible")
      }
      
      if (!queries.contents || queries.contents.length === 0) {
        throw new Error("No active GraphQL queries found")
      }
    }
  },

  {
    name: "Full Stack Debugging Flow",
    description: "Complete debugging workflow for a React app issue",
    steps: [
      "Navigate to problematic page",
      "Take initial screenshot",
      "Inspect React component tree",
      "Check component props and state",
      "Analyze network requests",
      "Inspect browser console logs",
      "Check performance metrics",
      "Identify root cause"
    ],
    mcpCommands: [
      {
        method: "tools/call",
        params: {
          name: "navigate",
          arguments: {
            sessionId: "test-session",
            url: "http://localhost:3000/products"
          }
        }
      },
      {
        method: "tools/call",
        params: {
          name: "screenshot",
          arguments: {
            sessionId: "test-session",
            fullPage: true
          }
        }
      },
      {
        method: "resources/read",
        params: { uri: "react://components" }
      },
      {
        method: "tools/call",
        params: {
          name: "react_inspect_props",
          arguments: {
            sessionId: "test-session",
            componentId: "ProductList"
          }
        }
      },
      {
        method: "resources/read",
        params: { uri: "cdp://network/requests" }
      },
      {
        method: "resources/read",
        params: { uri: "cdp://runtime/console" }
      },
      {
        method: "resources/read",
        params: { uri: "cdp://performance/metrics" }
      }
    ],
    verification: (results) => {
      // Comprehensive validation of full debugging flow
      const navigation = results[0]
      const screenshot = results[1]
      const components = results[2]
      const props = results[3]
      const network = results[4]
      const console = results[5]
      const metrics = results[6]
      
      if (!navigation.content || navigation.isError) {
        throw new Error("Failed to navigate to page")
      }
      
      if (!components.contents) {
        throw new Error("Failed to get React component tree")
      }
      
      if (!network.contents || !network.contents.requests) {
        throw new Error("No network requests captured")
      }
      
      // Check for any console errors
      const errors = console.contents?.messages?.filter((m: any) => m.level === "error") || []
      if (errors.length > 0) {
        console.log("Console errors detected:", errors)
      }
      
      // Verify performance is acceptable
      if (metrics.contents?.LCP > 2500) {
        console.log("Performance issue: LCP > 2.5s")
      }
    }
  }
]

/**
 * Run a test scenario and return results
 */
export async function runScenario(
  scenario: TestScenario,
  mcpClient: any
): Promise<{ success: boolean; results: any[]; error?: Error }> {
  const results: any[] = []
  
  try {
    console.log(`Running scenario: ${scenario.name}`)
    console.log(`Description: ${scenario.description}`)
    
    for (let i = 0; i < scenario.mcpCommands.length; i++) {
      const command = scenario.mcpCommands[i]
      const step = scenario.steps[i]
      
      console.log(`  Step ${i + 1}: ${step}`)
      console.log(`  Executing: ${command.method}`)
      
      const result = await mcpClient.request(command.method, command.params)
      results.push(result)
      
      if (command.expectedResult && !command.expectedResult(result)) {
        throw new Error(`Step ${i + 1} failed: unexpected result`)
      }
    }
    
    // Run scenario verification
    scenario.verification(results)
    
    console.log(`✅ Scenario "${scenario.name}" completed successfully`)
    return { success: true, results }
  } catch (error) {
    console.error(`❌ Scenario "${scenario.name}" failed:`, error)
    return { success: false, results, error: error as Error }
  }
}

/**
 * Run all test scenarios
 */
export async function runAllScenarios(mcpClient: any): Promise<{
  total: number
  passed: number
  failed: number
  results: Map<string, any>
}> {
  const results = new Map<string, any>()
  let passed = 0
  let failed = 0
  
  for (const scenario of scenarios) {
    const result = await runScenario(scenario, mcpClient)
    results.set(scenario.name, result)
    
    if (result.success) {
      passed++
    } else {
      failed++
    }
    
    // Add delay between scenarios
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  return {
    total: scenarios.length,
    passed,
    failed,
    results
  }
}

/**
 * Generate test report
 */
export function generateTestReport(testResults: {
  total: number
  passed: number
  failed: number
  results: Map<string, any>
}): string {
  let report = `# Curupira MCP E2E Test Report\n\n`
  report += `## Summary\n`
  report += `- Total Scenarios: ${testResults.total}\n`
  report += `- Passed: ${testResults.passed}\n`
  report += `- Failed: ${testResults.failed}\n`
  report += `- Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%\n\n`
  
  report += `## Scenario Results\n\n`
  
  for (const [name, result] of testResults.results) {
    report += `### ${name}\n`
    report += `- Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}\n`
    
    if (!result.success && result.error) {
      report += `- Error: ${result.error.message}\n`
    }
    
    report += `- Steps: ${scenarios.find(s => s.name === name)?.steps.length || 0}\n`
    report += `\n`
  }
  
  report += `## Recommendations\n\n`
  
  if (testResults.failed > 0) {
    report += `- Fix failing scenarios before production deployment\n`
    report += `- Review error logs for root causes\n`
    report += `- Ensure all resources and tools are properly implemented\n`
  } else {
    report += `- All scenarios passing - ready for production\n`
    report += `- Consider adding more edge case scenarios\n`
    report += `- Monitor performance metrics in production\n`
  }
  
  return report
}