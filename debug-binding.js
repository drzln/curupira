// Debug script to test binding
import { DOMToolProvider } from './mcp-server/src/mcp/tools/providers/dom-tools.js';

const provider = new DOMToolProvider();

console.log('Provider:', provider);
console.log('getSessionId method:', provider.getSessionId);
console.log('executeScript method:', provider.executeScript);
console.log('checkLibraryAvailable method:', provider.checkLibraryAvailable);

// Try to access via any
console.log('getSessionId via any:', (provider).getSessionId);
console.log('executeScript via any:', (provider).executeScript);
console.log('checkLibraryAvailable via any:', (provider).checkLibraryAvailable);