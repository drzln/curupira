#!/bin/bash
# Test MCP server endpoints

set -e

BASE_URL="http://localhost:8080"

echo "🔍 Testing Curupira MCP Server..."
echo

# Health check
echo "1. Health Check:"
curl -s "$BASE_URL/health" | jq .
echo

# Ready check
echo "2. Ready Check:"
curl -s "$BASE_URL/ready" | jq .
echo

# Server info
echo "3. Server Info:"
curl -s "$BASE_URL/info" | jq .
echo

# Test WebSocket connection
echo "4. Testing WebSocket connection..."
echo "Connecting to ws://localhost:8080/mcp"

# Use wscat if available
if command -v wscat &> /dev/null; then
    echo "Send this test message: {\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"resources/list\"}"
    wscat -c ws://localhost:8080/mcp
else
    echo "wscat not found. Install with: npm install -g wscat"
    echo "Or test manually with: wscat -c ws://localhost:8080/mcp"
fi