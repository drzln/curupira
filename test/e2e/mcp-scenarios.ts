/**
 * End-to-End MCP Testing Scenarios
 * 
 * These scenarios validate the complete MCP flow with Claude Code
 */

export interface TestScenario {
  name: string
  description: string
  steps: TestStep[]
  expectedResults: ExpectedResult[]
  verification: (result: any) => boolean
}

export interface TestStep {
  action: 'resources/list' | 'resources/read' | 'tools/list' | 'tools/call' | 'prompts/list' | 'prompts/get'
  params?: any
  description: string
}

export interface ExpectedResult {
  step: number
  contains?: string[]
  type?: string
  status?: 'success' | 'failure'
}

export const scenarios: TestScenario[] = [
  {
    name: "Basic Connection Test",
    description: "Verify MCP server is accessible and responding",
    steps: [
      {
        action: 'resources/list',
        description: 'List all available resources'
      },
      {
        action: 'tools/list',
        description: 'List all available tools'
      },
      {
        action: 'prompts/list',
        description: 'List all available prompts'
      }
    ],
    expectedResults: [
      {
        step: 0,
        contains: ['browser://', 'react://', 'xstate://', 'zustand://', 'network://'],
        status: 'success'
      },
      {
        step: 1,
        contains: ['dom/', 'runtime/', 'network/', 'performance/'],
        status: 'success'
      },
      {
        step: 2,
        contains: ['debug-react-component', 'debug-state-issue'],
        status: 'success'
      }
    ],
    verification: (result) => {
      return result.resources?.length > 0 && 
             result.tools?.length > 0 && 
             result.prompts?.length > 0
    }
  },

  {
    name: "Inspect React Component Tree",
    description: "Read and analyze React component hierarchy",
    steps: [
      {
        action: 'resources/read',
        params: { uri: 'react://components' },
        description: 'Read React component tree'
      },
      {
        action: 'resources/read',
        params: { uri: 'react://component/1' },
        description: 'Read specific component details'
      }
    ],
    expectedResults: [
      {
        step: 0,
        type: 'application/json',
        contains: ['components', 'total', 'reactVersion']
      },
      {
        step: 1,
        type: 'application/json',
        contains: ['id', 'name', 'props', 'hooks']
      }
    ],
    verification: (result) => {
      const components = JSON.parse(result.content)
      return components.components?.length > 0 &&
             components.components[0].name !== undefined
    }
  },

  {
    name: "Debug Cart State",
    description: "Inspect and manipulate shopping cart state",
    steps: [
      {
        action: 'resources/read',
        params: { uri: 'zustand://stores' },
        description: 'Read all Zustand stores'
      },
      {
        action: 'tools/call',
        params: {
          name: 'runtime/evaluate',
          arguments: {
            expression: 'window.__ZUSTAND_STORES__.get("useCartStore")?.getState()',
            returnByValue: true
          }
        },
        description: 'Get cart store state directly'
      },
      {
        action: 'tools/call',
        params: {
          name: 'runtime/evaluate',
          arguments: {
            expression: 'window.__ZUSTAND_STORES__.get("useCartStore")?.getState().addItem({id: "test-123", name: "Test Product", price: 9.99})',
            awaitPromise: true
          }
        },
        description: 'Add item to cart'
      },
      {
        action: 'resources/read',
        params: { uri: 'zustand://stores' },
        description: 'Verify cart state changed'
      }
    ],
    expectedResults: [
      {
        step: 0,
        contains: ['stores', 'useCartStore']
      },
      {
        step: 1,
        contains: ['items', 'total']
      },
      {
        step: 2,
        status: 'success'
      },
      {
        step: 3,
        contains: ['test-123']
      }
    ],
    verification: (result) => {
      const finalState = JSON.parse(result.content)
      const cartStore = finalState.stores?.find((s: any) => s.name === 'useCartStore')
      return cartStore?.state?.items?.some((item: any) => item.id === 'test-123')
    }
  },

  {
    name: "Browser Console Monitoring",
    description: "Check console logs for errors and warnings",
    steps: [
      {
        action: 'resources/read',
        params: { uri: 'browser://console/logs' },
        description: 'Read console logs'
      },
      {
        action: 'tools/call',
        params: {
          name: 'runtime/consoleLog',
          arguments: {
            level: 'info',
            message: 'Test message from Curupira',
            args: ['additional', 'data']
          }
        },
        description: 'Add custom console log'
      },
      {
        action: 'resources/read',
        params: { uri: 'browser://console/logs' },
        description: 'Verify custom log appears'
      }
    ],
    expectedResults: [
      {
        step: 0,
        type: 'application/json',
        contains: ['logs', 'total']
      },
      {
        step: 1,
        status: 'success'
      },
      {
        step: 2,
        contains: ['Test message from Curupira']
      }
    ],
    verification: (result) => {
      const logs = JSON.parse(result.content)
      return logs.logs?.some((log: any) => 
        log.text?.includes('Test message from Curupira')
      )
    }
  },

  {
    name: "Network Request Analysis",
    description: "Monitor and analyze network traffic",
    steps: [
      {
        action: 'resources/read',
        params: { uri: 'network://requests' },
        description: 'Get recent network requests'
      },
      {
        action: 'tools/call',
        params: {
          name: 'network/setCacheDisabled',
          arguments: { disabled: true }
        },
        description: 'Disable browser cache'
      },
      {
        action: 'tools/call',
        params: {
          name: 'runtime/evaluate',
          arguments: {
            expression: 'fetch("/api/test").then(r => r.json())',
            awaitPromise: true
          }
        },
        description: 'Make test API call'
      },
      {
        action: 'resources/read',
        params: { uri: 'network://requests' },
        description: 'Check for new request'
      }
    ],
    expectedResults: [
      {
        step: 0,
        contains: ['requests', 'stats']
      },
      {
        step: 1,
        status: 'success'
      },
      {
        step: 2,
        status: 'success'
      },
      {
        step: 3,
        contains: ['/api/test']
      }
    ],
    verification: (result) => {
      const network = JSON.parse(result.content)
      return network.requests?.some((req: any) => 
        req.url?.includes('/api/test')
      )
    }
  },

  {
    name: "DOM Manipulation",
    description: "Find and interact with DOM elements",
    steps: [
      {
        action: 'tools/call',
        params: {
          name: 'dom/querySelector',
          arguments: {
            selector: 'button.add-to-cart',
            all: false
          }
        },
        description: 'Find add to cart button'
      },
      {
        action: 'tools/call',
        params: {
          name: 'dom/highlight',
          arguments: {
            selector: 'button.add-to-cart',
            color: '#00ff00',
            duration: 2000
          }
        },
        description: 'Highlight the button'
      },
      {
        action: 'tools/call',
        params: {
          name: 'dom/click',
          arguments: {
            selector: 'button.add-to-cart'
          }
        },
        description: 'Click the button'
      }
    ],
    expectedResults: [
      {
        step: 0,
        contains: ['found', 'elements']
      },
      {
        step: 1,
        status: 'success'
      },
      {
        step: 2,
        status: 'success'
      }
    ],
    verification: (result) => {
      return result.clicked === true || result.success === true
    }
  },

  {
    name: "Performance Profiling",
    description: "Capture and analyze performance metrics",
    steps: [
      {
        action: 'tools/call',
        params: {
          name: 'performance/captureMetrics',
          arguments: {
            categories: ['paint', 'layout', 'script', 'memory']
          }
        },
        description: 'Capture performance metrics'
      },
      {
        action: 'resources/read',
        params: { uri: 'react://performance' },
        description: 'Get React performance data'
      },
      {
        action: 'tools/call',
        params: {
          name: 'performance/analyzeLongTasks',
          arguments: {
            threshold: 50
          }
        },
        description: 'Find long-running tasks'
      }
    ],
    expectedResults: [
      {
        step: 0,
        contains: ['metrics', 'timestamp']
      },
      {
        step: 1,
        contains: ['slowComponents', 'averageRenderTime']
      },
      {
        step: 2,
        contains: ['tasks', 'duration']
      }
    ],
    verification: (result) => {
      return result.metrics?.paint?.firstPaint !== undefined ||
             result.slowComponents !== undefined ||
             result.tasks !== undefined
    }
  },

  {
    name: "XState Machine Inspection",
    description: "Inspect state machine status and transitions",
    steps: [
      {
        action: 'resources/read',
        params: { uri: 'xstate://machines' },
        description: 'List all XState machines'
      },
      {
        action: 'tools/call',
        params: {
          name: 'runtime/evaluate',
          arguments: {
            expression: 'window.__XSTATE_MACHINES__?.size || 0',
            returnByValue: true
          }
        },
        description: 'Count active machines'
      }
    ],
    expectedResults: [
      {
        step: 0,
        contains: ['machines']
      },
      {
        step: 1,
        type: 'number'
      }
    ],
    verification: (result) => {
      return Array.isArray(result.machines) || typeof result === 'number'
    }
  },

  {
    name: "Debug Prompt Usage",
    description: "Use pre-configured debugging prompts",
    steps: [
      {
        action: 'prompts/get',
        params: {
          name: 'debug-react-component',
          arguments: {
            componentName: 'ProductList'
          }
        },
        description: 'Get component debugging prompt'
      },
      {
        action: 'prompts/get',
        params: {
          name: 'debug-cart-state',
          arguments: {}
        },
        description: 'Get cart debugging prompt'
      }
    ],
    expectedResults: [
      {
        step: 0,
        contains: ['ProductList', 'inspect', 'props', 'state']
      },
      {
        step: 1,
        contains: ['cart', 'Zustand', 'items']
      }
    ],
    verification: (result) => {
      return typeof result.prompt === 'string' && result.prompt.length > 0
    }
  },

  {
    name: "Storage Inspection",
    description: "Check browser storage (localStorage, sessionStorage, cookies)",
    steps: [
      {
        action: 'resources/read',
        params: { uri: 'browser://storage/all' },
        description: 'Read all browser storage'
      },
      {
        action: 'tools/call',
        params: {
          name: 'runtime/evaluate',
          arguments: {
            expression: 'localStorage.setItem("curupira-test", "test-value"); "set"',
            returnByValue: true
          }
        },
        description: 'Set test localStorage value'
      },
      {
        action: 'resources/read',
        params: { uri: 'browser://storage/all' },
        description: 'Verify storage updated'
      }
    ],
    expectedResults: [
      {
        step: 0,
        contains: ['localStorage', 'sessionStorage', 'cookies']
      },
      {
        step: 1,
        status: 'success'
      },
      {
        step: 2,
        contains: ['curupira-test']
      }
    ],
    verification: (result) => {
      const storage = JSON.parse(result.content)
      return storage.localStorage?.['curupira-test'] === 'test-value'
    }
  }
]

// Helper function to run a scenario
export async function runScenario(
  scenario: TestScenario,
  mcpClient: any
): Promise<{ 
  passed: boolean
  scenario: string
  results: any[]
  errors: string[]
}> {
  const results: any[] = []
  const errors: string[] = []
  let passed = true

  console.log(`\n🧪 Running scenario: ${scenario.name}`)
  console.log(`   ${scenario.description}`)

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i]
    console.log(`\n   Step ${i + 1}: ${step.description}`)
    
    try {
      let result
      switch (step.action) {
        case 'resources/list':
          result = await mcpClient.listResources()
          break
        case 'resources/read':
          result = await mcpClient.readResource(step.params)
          break
        case 'tools/list':
          result = await mcpClient.listTools()
          break
        case 'tools/call':
          result = await mcpClient.callTool(step.params)
          break
        case 'prompts/list':
          result = await mcpClient.listPrompts()
          break
        case 'prompts/get':
          result = await mcpClient.getPrompt(step.params)
          break
      }

      results.push(result)
      console.log(`   ✓ Success`)

      // Check expected results
      const expected = scenario.expectedResults.find(e => e.step === i)
      if (expected) {
        if (expected.contains) {
          const resultStr = JSON.stringify(result)
          for (const substr of expected.contains) {
            if (!resultStr.includes(substr)) {
              errors.push(`Step ${i}: Expected to contain "${substr}"`)
              passed = false
            }
          }
        }
        if (expected.status) {
          if (!result || result.error) {
            errors.push(`Step ${i}: Expected status ${expected.status} but got error`)
            passed = false
          }
        }
      }
    } catch (error) {
      console.log(`   ✗ Failed: ${error}`)
      errors.push(`Step ${i}: ${error}`)
      results.push({ error })
      passed = false
    }
  }

  // Run final verification
  if (scenario.verification && results.length > 0) {
    const lastResult = results[results.length - 1]
    if (!scenario.verification(lastResult)) {
      errors.push('Final verification failed')
      passed = false
    }
  }

  console.log(`\n   Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
  if (errors.length > 0) {
    console.log('   Errors:')
    errors.forEach(err => console.log(`   - ${err}`))
  }

  return {
    passed,
    scenario: scenario.name,
    results,
    errors
  }
}

// Run all scenarios
export async function runAllScenarios(mcpClient: any) {
  console.log('🚀 Starting Curupira MCP End-to-End Tests')
  console.log('=' .repeat(50))

  const results = []
  let totalPassed = 0
  let totalFailed = 0

  for (const scenario of scenarios) {
    const result = await runScenario(scenario, mcpClient)
    results.push(result)
    
    if (result.passed) {
      totalPassed++
    } else {
      totalFailed++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Test Summary')
  console.log(`   Total scenarios: ${scenarios.length}`)
  console.log(`   ✅ Passed: ${totalPassed}`)
  console.log(`   ❌ Failed: ${totalFailed}`)
  console.log(`   Success rate: ${((totalPassed / scenarios.length) * 100).toFixed(1)}%`)

  return {
    totalScenarios: scenarios.length,
    passed: totalPassed,
    failed: totalFailed,
    results
  }
}