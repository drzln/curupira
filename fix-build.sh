#!/bin/bash

# Fix import paths
find mcp-server/src -name "*.ts" -exec sed -i 's|@curupira/shared/src/utils/cdp.js|@curupira/shared/utils|g' {} \;
find mcp-server/src -name "*.ts" -exec sed -i 's|@curupira/shared/src/utils/index.js|@curupira/shared/utils|g' {} \;
find mcp-server/src -name "*.ts" -exec sed -i 's|@curupira/shared/src/utils/data-structures.js|@curupira/shared/utils|g' {} \;

# Add missing types to shared CDP types
cat >> shared/src/types/cdp.ts << 'EOF'

  export interface Cookie {
    name: string
    value: string
    domain?: string
    path?: string
    expires?: number
    httpOnly?: boolean
    secure?: boolean
    sameSite?: string
  }

  export interface CookieParam {
    name: string
    value: string
    url?: string
    domain?: string
    path?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: string
    expires?: number
  }

  export type ResourceType = string
  export type ErrorReason = string
  export interface Initiator {
    type: string
  }
  
  export interface ServiceWorkerRouterInfo {
    ruleId?: number
  }
  
  export interface ResourceTiming {
    requestTime?: number
  }
EOF

echo "Build fixes applied"