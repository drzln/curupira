#!/usr/bin/env tsx
/**
 * MCP E2E Test Runner
 * Executes all MCP scenarios against the enhanced Curupira server
 */

import { WebSocket } from 'ws'
import { runAllScenarios, generateTestReport } from './mcp-scenarios.js'

class MCPTestClient {
  private ws: WebSocket | null = null
  private requestId = 0
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>()
  
  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)
      
      this.ws.on('open', () => {
        console.log('✅ Connected to MCP server')
        resolve()
      })
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error)
        reject(error)
      })
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          
          if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id)!
            this.pendingRequests.delete(message.id)
            
            if (message.error) {
              reject(new Error(message.error.message))
            } else {
              resolve(message.result)
            }
          }
        } catch (error) {
          console.error('Failed to parse message:', error)
        }
      })
    })
  }
  
  async request(method: string, params?: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to MCP server')
    }
    
    const id = ++this.requestId
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params
      }
      
      this.ws!.send(JSON.stringify(message))
      
      // Add timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request timeout for ${method}`))
        }
      }, 30000) // 30 second timeout
    })
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

async function main() {
  console.log('🚀 Starting Curupira MCP E2E Tests\n')
  
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'ws://localhost:8000/mcp'
  const client = new MCPTestClient()
  
  try {
    // Connect to MCP server
    console.log(`Connecting to MCP server at ${mcpServerUrl}...`)
    await client.connect(mcpServerUrl)
    
    // Initialize session (if needed)
    console.log('Initializing test session...')
    // Note: In real implementation, we'd need to create a Chrome session first
    
    // Run all scenarios
    console.log('\nRunning test scenarios...\n')
    const results = await runAllScenarios(client)
    
    // Generate report
    const report = generateTestReport(results)
    console.log('\n' + report)
    
    // Save report to file
    const fs = await import('fs/promises')
    const reportPath = './test-report.md'
    await fs.writeFile(reportPath, report)
    console.log(`\n📄 Test report saved to ${reportPath}`)
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0)
    
  } catch (error) {
    console.error('❌ Test execution failed:', error)
    process.exit(1)
  } finally {
    client.disconnect()
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}