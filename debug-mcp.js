#!/usr/bin/env node
/**
 * Debug script to test MCP communication manually
 * This simulates what Claude Code does when connecting to your MCP server
 */

const { spawn } = require('child_process');
const path = require('path');

// Path to your MCP server
const mcpServerPath = path.join(__dirname, 'mcp-server/dist/cli-stdio.js');

console.log('🔍 Testing MCP server connection...');
console.log('📍 MCP Server Path:', mcpServerPath);

// Start the MCP server process
const child = spawn('node', [mcpServerPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { 
    ...process.env, 
    LOG_LEVEL: 'debug',
    WS_PORT: '8081'  // Use different port to avoid conflict
  }
});

// Log stderr (server logs)
child.stderr.on('data', (data) => {
  console.log('🖥️  Server Log:', data.toString().trim());
});

// Handle stdout (MCP responses)
child.stdout.on('data', (data) => {
  const response = data.toString().trim();
  console.log('📤 MCP Response:', response);
});

// Send MCP initialization request
setTimeout(() => {
  console.log('\n📨 Sending MCP initialization request...');
  
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true
        }
      },
      clientInfo: {
        name: 'debug-test',
        version: '1.0.0'
      }
    }
  };
  
  child.stdin.write(JSON.stringify(initRequest) + '\n');
}, 1000);

// Send resources/list request after initialization
setTimeout(() => {
  console.log('\n📨 Sending resources/list request...');
  
  const resourcesRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list'
  };
  
  child.stdin.write(JSON.stringify(resourcesRequest) + '\n');
}, 2000);

// Clean up after 10 seconds
setTimeout(() => {
  console.log('\n🛑 Cleaning up...');
  child.kill('SIGTERM');
  process.exit(0);
}, 10000);

child.on('error', (error) => {
  console.error('❌ Process error:', error);
});

child.on('exit', (code, signal) => {
  console.log(`\n🔚 Process exited with code ${code} and signal ${signal}`);
});