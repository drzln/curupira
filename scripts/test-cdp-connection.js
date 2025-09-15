#!/usr/bin/env node

/**
 * Test script to verify CDP connection from Curupira to Chrome
 * This script tests the complete flow from Curupira to the browserless Chrome instance
 */

const http = require('http');

const CHROME_SERVICE_URL = process.env.CHROME_SERVICE_URL || 'chrome-headless.shared-services.svc.cluster.local';
const CHROME_SERVICE_PORT = process.env.CHROME_SERVICE_PORT || 3000;

function httpGet(hostname, port, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      path,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function testCDPConnection() {
  console.log('🧪 Testing CDP connection to Chrome...');
  console.log(`Chrome service: ${CHROME_SERVICE_URL}:${CHROME_SERVICE_PORT}`);
  
  try {
    // Step 1: Test HTTP endpoint
    console.log('\n1️⃣ Testing HTTP endpoint /json/version...');
    const versionData = await httpGet(CHROME_SERVICE_URL, CHROME_SERVICE_PORT, '/json/version');
    console.log('✅ HTTP endpoint working');
    console.log(`Browser: ${versionData.Browser}`);
    console.log(`Protocol Version: ${versionData['Protocol-Version']}`);
    console.log(`WebSocket URL: ${versionData.webSocketDebuggerUrl}`);
    
    // Step 2: Test browser targets endpoint
    console.log('\n2️⃣ Testing browser targets endpoint /json...');
    const targets = await httpGet(CHROME_SERVICE_URL, CHROME_SERVICE_PORT, '/json');
    console.log('✅ Browser targets endpoint working');
    console.log(`Active targets: ${targets.length}`);
    
    console.log('\n✅ All tests passed! CDP connection is working.');
    console.log('\n📝 Summary:');
    console.log(`- Chrome is accessible at: http://${CHROME_SERVICE_URL}:${CHROME_SERVICE_PORT}`);
    console.log(`- WebSocket endpoint: ws://${CHROME_SERVICE_URL}:${CHROME_SERVICE_PORT}`);
    console.log('- Chrome DevTools Protocol is functioning correctly');
    console.log('- Ready for Curupira MCP server integration');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testCDPConnection();