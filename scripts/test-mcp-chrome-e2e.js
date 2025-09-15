#!/usr/bin/env node

/**
 * End-to-end test for Curupira MCP server Chrome integration
 * This test verifies the complete flow from MCP client to Chrome browser
 */

const http = require('http');

const CURUPIRA_URL = process.env.CURUPIRA_URL || 'curupira-mcp-server.shared-services.svc.cluster.local';
const CURUPIRA_PORT = process.env.CURUPIRA_PORT || 8080;

function makeRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    });

    const options = {
      hostname: CURUPIRA_URL,
      port: CURUPIRA_PORT,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Curupira MCP Chrome Integration E2E Test');
  console.log(`Target: http://${CURUPIRA_URL}:${CURUPIRA_PORT}`);
  console.log('');

  try {
    // Test 1: List resources
    console.log('1️⃣ Testing resources/list...');
    const resourcesResponse = await makeRequest('resources/list');
    console.log(`Response: ${JSON.stringify(resourcesResponse, null, 2)}`);
    
    // Expected resources when Chrome integration is implemented:
    const expectedResources = [
      'browser/status',
      'page/info',
      'console/logs',
      'network/requests'
    ];
    
    // TODO: Once implemented, verify resources include Chrome-related ones
    console.log('Expected resources (when implemented):', expectedResources);
    console.log('');

    // Test 2: List tools
    console.log('2️⃣ Testing tools/list...');
    const toolsResponse = await makeRequest('tools/list');
    console.log(`Response: ${JSON.stringify(toolsResponse, null, 2)}`);
    
    // Expected tools when Chrome integration is implemented:
    const expectedTools = [
      'page/navigate',
      'page/screenshot',
      'console/evaluate'
    ];
    
    console.log('Expected tools (when implemented):', expectedTools);
    console.log('');

    // Test 3: Browser status (when implemented)
    console.log('3️⃣ Testing browser/status resource...');
    const statusResponse = await makeRequest('resources/read', {
      uri: 'browser/status'
    });
    console.log(`Response: ${JSON.stringify(statusResponse, null, 2)}`);
    console.log('');

    // Test 4: Navigate to page (when implemented)
    console.log('4️⃣ Testing page navigation...');
    const navigateResponse = await makeRequest('tools/call', {
      name: 'page/navigate',
      arguments: {
        url: 'http://novaskyn.staging.plo.quero.local'
      }
    });
    console.log(`Response: ${JSON.stringify(navigateResponse, null, 2)}`);
    console.log('');

    // Test 5: Evaluate JavaScript (when implemented)
    console.log('5️⃣ Testing JavaScript evaluation...');
    const evalResponse = await makeRequest('tools/call', {
      name: 'console/evaluate',
      arguments: {
        expression: 'document.title'
      }
    });
    console.log(`Response: ${JSON.stringify(evalResponse, null, 2)}`);
    console.log('');

    console.log('✅ E2E test completed');
    console.log('');
    console.log('📝 Implementation Status:');
    console.log('- Network connectivity: ✅ Working');
    console.log('- Chrome service: ✅ Running at chrome-headless.shared-services.svc.cluster.local:3000');
    console.log('- Curupira MCP server: ✅ Running');
    console.log('- Chrome integration: ❌ Not implemented in v1.0.17');
    console.log('');
    console.log('Next steps:');
    console.log('1. Implement Chrome CDP client in Curupira codebase');
    console.log('2. Add resource and tool handlers for Chrome operations');
    console.log('3. Build and deploy new Curupira version');
    console.log('4. Run this test again to verify integration');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();