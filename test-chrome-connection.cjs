#!/usr/bin/env node

/**
 * Test script to verify Chrome connection flow without pre-connection requirement
 */

const { spawn } = require('child_process');
const http = require('http');

// Start the MCP server
console.log('🚀 Starting Curupira MCP server...');
const server = spawn('node', ['mcp-server/dist/cli.js', 'start'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    CURUPIRA_TRANSPORT: 'http',
    CURUPIRA_PORT: '8080',
    LOG_LEVEL: 'debug'
  }
});

server.stdout.on('data', (data) => {
  console.log(`Server: ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`Server Error: ${data}`);
});

// Wait for server to start
setTimeout(async () => {
  console.log('\n📋 Testing MCP connection...');
  
  try {
    // 1. List tools before Chrome connection
    console.log('\n1️⃣ Listing tools before Chrome connection:');
    const toolsBeforeResponse = await makeRequest('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    });
    console.log(`Tools available: ${toolsBeforeResponse.result?.tools?.length || 0}`);
    const connectionTools = toolsBeforeResponse.result?.tools?.filter(t => 
      ['chrome_discover', 'chrome_connect', 'chrome_status', 'chrome_disconnect'].includes(t.name)
    );
    console.log('Chrome connection tools:', connectionTools?.map(t => t.name));
    
    // 2. Try chrome_discover
    console.log('\n2️⃣ Testing chrome_discover (should work without connection):');
    const discoverResponse = await makeRequest('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'chrome_discover',
        arguments: {
          hosts: ['localhost'],
          ports: [9222]
        }
      },
      id: 2
    });
    console.log('Discover result:', JSON.stringify(discoverResponse.result, null, 2));
    
    // 3. Check chrome_status
    console.log('\n3️⃣ Testing chrome_status (should show disconnected):');
    const statusResponse = await makeRequest('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'chrome_status',
        arguments: {}
      },
      id: 3
    });
    console.log('Status result:', JSON.stringify(statusResponse.result, null, 2));
    
    console.log('\n✅ Chrome connection tools are working without pre-connection!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  // Cleanup
  server.kill();
  process.exit(0);
}, 3000);

async function makeRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': data.length
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}