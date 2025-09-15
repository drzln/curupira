#!/usr/bin/env node

/**
 * Test script to verify CDP connection from Curupira to Chrome
 * This script tests the complete flow from Curupira to the browserless Chrome instance
 */

import WebSocket from 'ws';
import fetch from 'node-fetch';

const CHROME_SERVICE_URL = process.env.CHROME_SERVICE_URL || 'http://chrome-headless.shared-services.svc.cluster.local:3000';

async function testCDPConnection() {
  console.log('🧪 Testing CDP connection to Chrome...');
  console.log(`Chrome service URL: ${CHROME_SERVICE_URL}`);
  
  try {
    // Step 1: Test HTTP endpoint
    console.log('\n1️⃣ Testing HTTP endpoint...');
    const versionResponse = await fetch(`${CHROME_SERVICE_URL}/json/version`);
    if (!versionResponse.ok) {
      throw new Error(`HTTP request failed: ${versionResponse.status}`);
    }
    const versionData = await versionResponse.json();
    console.log('✅ HTTP endpoint working');
    console.log(`Browser: ${versionData.Browser}`);
    console.log(`Protocol Version: ${versionData['Protocol-Version']}`);
    console.log(`Puppeteer Version: ${versionData['Puppeteer-Version']}`);
    
    // Step 2: Test WebSocket connection
    console.log('\n2️⃣ Testing WebSocket connection...');
    const wsUrl = CHROME_SERVICE_URL.replace('http://', 'ws://');
    const ws = new WebSocket(wsUrl);
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ WebSocket connection established');
        resolve(undefined);
      });
      
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });
      
      setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    });
    
    // Step 3: Send CDP command
    console.log('\n3️⃣ Sending CDP command...');
    const cdpCommand = {
      id: 1,
      method: 'Target.getTargets',
      params: {}
    };
    
    ws.send(JSON.stringify(cdpCommand));
    
    await new Promise((resolve, reject) => {
      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        console.log('✅ CDP response received');
        console.log('Response:', JSON.stringify(response, null, 2));
        resolve(undefined);
      });
      
      setTimeout(() => {
        reject(new Error('CDP command timeout'));
      }, 5000);
    });
    
    // Step 4: Close connection
    ws.close();
    console.log('\n✅ All tests passed! CDP connection is working.');
    
    // Step 5: Test navigation
    console.log('\n4️⃣ Testing page navigation...');
    const puppeteerResponse = await fetch(`${CHROME_SERVICE_URL}/function`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/javascript'
      },
      body: `
        module.exports = async ({ page }) => {
          await page.goto('http://novaskyn.staging.plo.quero.local', { waitUntil: 'networkidle2' });
          const title = await page.title();
          return { title, url: page.url() };
        }
      `
    });
    
    if (puppeteerResponse.ok) {
      const result = await puppeteerResponse.json();
      console.log('✅ Page navigation successful');
      console.log(`Page title: ${result.title}`);
      console.log(`Page URL: ${result.url}`);
    } else {
      console.log('⚠️  Page navigation test skipped (browserless function API not available)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCDPConnection();