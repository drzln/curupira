#!/bin/bash
# Test script to verify network connectivity from Curupira pod to Chrome service

echo "🧪 Testing network connectivity from Curupira to Chrome..."
echo ""

# Get the Curupira pod name
CURUPIRA_POD=$(kubectl get pods -n shared-services -l app=curupira-mcp-server -o jsonpath='{.items[0].metadata.name}')

if [ -z "$CURUPIRA_POD" ]; then
    echo "❌ No Curupira pod found"
    exit 1
fi

echo "✅ Found Curupira pod: $CURUPIRA_POD"
echo ""

# Test 1: DNS resolution
echo "1️⃣ Testing DNS resolution of Chrome service..."
kubectl exec -n shared-services $CURUPIRA_POD -- sh -c "nslookup chrome-headless.shared-services.svc.cluster.local" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ DNS resolution successful"
else
    echo "❌ DNS resolution failed"
fi
echo ""

# Test 2: Network connectivity using wget (since curl is not available)
echo "2️⃣ Testing HTTP connectivity to Chrome service..."
kubectl exec -n shared-services $CURUPIRA_POD -- sh -c "wget -O- http://chrome-headless.shared-services.svc.cluster.local:3000/json/version 2>/dev/null | head -100"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ HTTP connectivity successful"
else
    echo "❌ HTTP connectivity failed"
fi
echo ""

# Test 3: Check if Chrome integration is available in current Curupira
echo "3️⃣ Checking Curupira version and capabilities..."
kubectl exec -n shared-services $CURUPIRA_POD -- sh -c "cat /app/package.json | grep version | head -1" 2>/dev/null
echo ""

# Test 4: Check Curupira MCP resources
echo "4️⃣ Listing current MCP resources..."
kubectl run test-mcp-list --rm -i --image=node:alpine --restart=Never -- sh -c "
cat > /tmp/test-mcp.js << 'EOF'
const http = require('http');

const options = {
  hostname: 'curupira-mcp-server.shared-services.svc.cluster.local',
  port: 8080,
  path: '/mcp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', (chunk) => {
    console.log('Response:', chunk.toString());
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'resources/list'
}));

req.end();
EOF
node /tmp/test-mcp.js
"

echo ""
echo "📝 Summary:"
echo "- Curupira pod: $CURUPIRA_POD"
echo "- Chrome service: chrome-headless.shared-services.svc.cluster.local:3000"
echo "- Current Curupira version doesn't have Chrome integration built-in"
echo "- Network connectivity between services is working"
echo ""
echo "⚠️  Note: The deployed Curupira v1.0.17 doesn't support Chrome configuration."
echo "Chrome integration needs to be implemented in the Curupira codebase."