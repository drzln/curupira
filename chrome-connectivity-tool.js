#!/usr/bin/env node
/**
 * Chrome Connectivity Evaluation Tool for Curupira MCP
 * 
 * This tool evaluates and tests connectivity to Chrome instances,
 * which is essential for Curupira's debugging capabilities.
 */

import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.cyan}${colors.bright}\n=== ${msg} ===${colors.reset}`)
};

class ChromeConnectivityTool {
  constructor() {
    this.defaultPorts = [9222, 9223, 9224, 9225];
    this.testResults = [];
  }

  async evaluate() {
    log.header('Chrome Connectivity Evaluation for Curupira MCP');
    
    console.log('This tool evaluates Chrome instance connectivity for debugging capabilities.\n');

    // Step 1: Check for running Chrome instances
    await this.checkRunningChromeInstances();
    
    // Step 2: Test Chrome DevTools Protocol ports
    await this.testDevToolsPorts();
    
    // Step 3: Test Chrome launch with debug flags
    await this.testChromeLaunch();
    
    // Step 4: Test WebSocket connections
    await this.testWebSocketConnections();
    
    // Step 5: Test MCP server connectivity
    await this.testMCPServerConnectivity();
    
    // Step 6: Generate recommendations
    this.generateRecommendations();
  }

  async checkRunningChromeInstances() {
    log.header('Checking Running Chrome Instances');
    
    try {
      const result = await this.execCommand('pgrep -f "chrome.*remote-debugging"');
      
      if (result.stdout.trim()) {
        const pids = result.stdout.trim().split('\n');
        log.success(`Found ${pids.length} Chrome instance(s) with remote debugging enabled`);
        
        for (const pid of pids) {
          const cmdline = await this.execCommand(`ps -p ${pid} -o args=`);
          log.info(`PID ${pid}: ${cmdline.stdout.trim()}`);
        }
        
        this.testResults.push({
          test: 'chrome_instances',
          status: 'pass',
          details: `${pids.length} instances found`
        });
      } else {
        log.warning('No Chrome instances with remote debugging found');
        this.testResults.push({
          test: 'chrome_instances',
          status: 'warning',
          details: 'No debug-enabled Chrome instances'
        });
      }
    } catch (error) {
      log.error(`Failed to check Chrome instances: ${error.message}`);
      this.testResults.push({
        test: 'chrome_instances',
        status: 'fail',
        details: error.message
      });
    }
  }

  async testDevToolsPorts() {
    log.header('Testing Chrome DevTools Protocol Ports');
    
    for (const port of this.defaultPorts) {
      try {
        const response = await this.httpRequest(`http://localhost:${port}/json/version`);
        
        if (response) {
          const data = JSON.parse(response);
          log.success(`Port ${port}: ${data.Browser} (${data['V8-Version']})`);
          
          this.testResults.push({
            test: `port_${port}`,
            status: 'pass',
            details: `${data.Browser} available`
          });
        }
      } catch (error) {
        log.warning(`Port ${port}: Not available`);
        this.testResults.push({
          test: `port_${port}`,
          status: 'fail',
          details: 'Port not accessible'
        });
      }
    }
  }

  async testChromeLaunch() {
    log.header('Testing Chrome Launch with Debug Flags');
    
    const chromeCommands = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];

    let chromeFound = false;
    
    for (const cmd of chromeCommands) {
      try {
        const result = await this.execCommand(`which ${cmd}`);
        if (result.stdout.trim()) {
          log.success(`Found Chrome binary: ${cmd}`);
          chromeFound = true;
          
          // Test launching Chrome with debug flags
          await this.testChromeLaunchWithFlags(cmd);
          break;
        }
      } catch (error) {
        // Command not found, continue
      }
    }
    
    if (!chromeFound) {
      log.error('No Chrome binary found in PATH');
      this.testResults.push({
        test: 'chrome_binary',
        status: 'fail',
        details: 'Chrome not found in PATH'
      });
    }
  }

  async testChromeLaunchWithFlags(chromeBinary) {
    log.info('Testing Chrome launch with debug flags...');
    
    const testPort = 9222;
    const chromeArgs = [
      '--headless',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      `--remote-debugging-port=${testPort}`,
      '--remote-debugging-address=0.0.0.0',
      'about:blank'
    ];

    try {
      const chromeProcess = spawn(chromeBinary, chromeArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Wait for Chrome to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test if the debug port is accessible
      try {
        const response = await this.httpRequest(`http://localhost:${testPort}/json/version`);
        if (response) {
          log.success('Chrome successfully launched with debug flags');
          this.testResults.push({
            test: 'chrome_launch',
            status: 'pass',
            details: 'Chrome can be launched with debug flags'
          });
        }
      } catch (error) {
        log.error('Chrome launched but debug port not accessible');
        this.testResults.push({
          test: 'chrome_launch',
          status: 'fail',
          details: 'Debug port not accessible after launch'
        });
      }

      // Clean up
      chromeProcess.kill('SIGTERM');
      
    } catch (error) {
      log.error(`Failed to launch Chrome: ${error.message}`);
      this.testResults.push({
        test: 'chrome_launch',
        status: 'fail',
        details: `Launch failed: ${error.message}`
      });
    }
  }

  async testWebSocketConnections() {
    log.header('Testing WebSocket Connections');
    
    for (const port of this.defaultPorts) {
      try {
        // First get the list of targets
        const targets = await this.httpRequest(`http://localhost:${port}/json`);
        if (targets) {
          const targetList = JSON.parse(targets);
          const pageTarget = targetList.find(t => t.type === 'page');
          
          if (pageTarget && pageTarget.webSocketDebuggerUrl) {
            log.success(`Port ${port}: WebSocket endpoint available`);
            
            // Test WebSocket connection (simplified)
            log.info(`WebSocket URL: ${pageTarget.webSocketDebuggerUrl}`);
            
            this.testResults.push({
              test: `websocket_${port}`,
              status: 'pass',
              details: 'WebSocket endpoint available'
            });
          } else {
            log.warning(`Port ${port}: No page targets found`);
            this.testResults.push({
              test: `websocket_${port}`,
              status: 'warning',
              details: 'No page targets available'
            });
          }
        }
      } catch (error) {
        log.warning(`Port ${port}: WebSocket test failed`);
        this.testResults.push({
          test: `websocket_${port}`,
          status: 'fail',
          details: 'WebSocket test failed'
        });
      }
    }
  }

  async testMCPServerConnectivity() {
    log.header('Testing MCP Server Connectivity');
    
    const mcpServerPath = path.join(__dirname, 'mcp-server/dist/cli-stdio.js');
    
    try {
      // Check if MCP server exists
      await this.execCommand(`test -f ${mcpServerPath}`);
      log.success('MCP server binary found');
      
      // Test MCP server startup
      const mcpProcess = spawn('node', [mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, LOG_LEVEL: 'error' }
      });

      let mcpStarted = false;
      let startupTimeout;

      // Wait for server to start
      const startupPromise = new Promise((resolve) => {
        mcpProcess.stdout.on('data', (data) => {
          if (data.toString().includes('MCP server connected')) {
            mcpStarted = true;
            resolve(true);
          }
        });

        startupTimeout = setTimeout(() => {
          resolve(false);
        }, 5000);
      });

      const started = await startupPromise;
      clearTimeout(startupTimeout);

      if (started) {
        log.success('MCP server started successfully');
        
        // Test resource listing
        const resourceRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'resources/list'
        };

        mcpProcess.stdin.write(JSON.stringify(resourceRequest) + '\n');
        
        // Wait for response
        const responsePromise = new Promise((resolve) => {
          mcpProcess.stdout.on('data', (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.id === 1 && response.result) {
                resolve(response);
              }
            } catch (e) {
              // Ignore parsing errors
            }
          });

          setTimeout(() => resolve(null), 3000);
        });

        const response = await responsePromise;
        
        if (response && response.result && response.result.resources) {
          const resourceCount = response.result.resources.length;
          log.success(`MCP server responding: ${resourceCount} resources available`);
          
          this.testResults.push({
            test: 'mcp_server',
            status: 'pass',
            details: `${resourceCount} resources available`
          });
        } else {
          log.warning('MCP server started but not responding to resource requests');
          this.testResults.push({
            test: 'mcp_server',
            status: 'warning',
            details: 'Server not responding to requests'
          });
        }
      } else {
        log.error('MCP server failed to start within timeout');
        this.testResults.push({
          test: 'mcp_server',
          status: 'fail',
          details: 'Startup timeout'
        });
      }

      // Clean up
      mcpProcess.kill('SIGTERM');

    } catch (error) {
      log.error(`MCP server test failed: ${error.message}`);
      this.testResults.push({
        test: 'mcp_server',
        status: 'fail',
        details: error.message
      });
    }
  }

  generateRecommendations() {
    log.header('Recommendations and Setup Instructions');
    
    const passedTests = this.testResults.filter(r => r.status === 'pass').length;
    const totalTests = this.testResults.length;
    
    console.log(`\nTest Results: ${passedTests}/${totalTests} passed\n`);
    
    // Analyze results and provide recommendations
    const failedTests = this.testResults.filter(r => r.status === 'fail');
    const warningTests = this.testResults.filter(r => r.status === 'warning');
    
    if (failedTests.length === 0 && warningTests.length === 0) {
      log.success('All tests passed! Chrome connectivity is properly configured.');
      console.log('\n📋 Your system is ready for Curupira MCP debugging.');
      return;
    }

    console.log('📋 Setup recommendations:\n');

    // Check if Chrome needs to be launched with debug flags
    const chromeIssues = failedTests.filter(r => r.test.includes('chrome') || r.test.includes('port'));
    if (chromeIssues.length > 0) {
      console.log('🔧 Chrome Configuration:');
      console.log('  • Launch Chrome with debug flags:');
      console.log('    google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0');
      console.log('  • Or use headless mode:');
      console.log('    google-chrome --headless --remote-debugging-port=9222 --disable-gpu');
      console.log();
    }

    // Check WebSocket issues
    const websocketIssues = failedTests.filter(r => r.test.includes('websocket'));
    if (websocketIssues.length > 0) {
      console.log('🔌 WebSocket Configuration:');
      console.log('  • Ensure Chrome allows WebSocket connections');
      console.log('  • Check firewall settings for ports 9222-9225');
      console.log('  • Verify no other applications are using these ports');
      console.log();
    }

    // Check MCP server issues
    const mcpIssues = failedTests.filter(r => r.test.includes('mcp'));
    if (mcpIssues.length > 0) {
      console.log('🔧 MCP Server Configuration:');
      console.log('  • Build the MCP server: npm run build');
      console.log('  • Check Node.js version (requires >= 20.0.0)');
      console.log('  • Install dependencies: npm install');
      console.log();
    }

    // Docker setup recommendation
    console.log('🐳 Docker Setup (Recommended):');
    console.log('  • Use the official Curupira Docker image:');
    console.log('    docker run -p 9222:9222 -p 8080:8080 curupira/mcp-server');
    console.log('  • This provides a pre-configured Chrome + MCP environment');
    console.log();

    // Usage instructions
    console.log('📖 Usage Instructions:');
    console.log('  1. Start Chrome with debug flags');
    console.log('  2. Start the Curupira MCP server');
    console.log('  3. Connect Claude Code to the MCP server');
    console.log('  4. Navigate to your web application in Chrome');
    console.log('  5. Use MCP resources to inspect your application');
    console.log();

    console.log('For detailed documentation, visit: https://github.com/drzln/curupira#readme');
  }

  // Utility methods
  async execCommand(command) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => stdout += data);
      child.stderr.on('data', (data) => stderr += data);
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  async httpRequest(url) {
    return new Promise((resolve, reject) => {
      const http = require('http');
      const urlObj = new URL(url);
      
      const req = http.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: 3000
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const tool = new ChromeConnectivityTool();
  tool.evaluate().catch(console.error);
}

export { ChromeConnectivityTool };