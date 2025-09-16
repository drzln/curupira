# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for Curupira MCP Server
# Optimized for production deployment to Docker Hub

# Build stage
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files for better caching
COPY package*.json ./
COPY tsconfig*.json ./
COPY shared/package*.json ./shared/
COPY mcp-server/package*.json ./mcp-server/

# Install all dependencies
RUN npm ci --workspaces

# Copy source code
COPY shared/ ./shared/
COPY mcp-server/ ./mcp-server/

# Build shared and server packages
RUN npm run build --workspace=@curupira/shared && npm run build --workspace=curupira-mcp-server

# Production stage
FROM --platform=$TARGETPLATFORM node:20-alpine AS production

# Install dumb-init and security updates
RUN apk add --no-cache dumb-init ca-certificates && \
    apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/mcp-server/package*.json ./mcp-server/

# Install production dependencies only
RUN npm ci --workspaces --omit=dev && \
    npm cache clean --force

# Copy built files
COPY --from=builder --chown=nodejs:nodejs /app/shared/dist ./shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/mcp-server/dist ./mcp-server/dist

# Switch to non-root user
USER nodejs

# Expose MCP server port
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV CURUPIRA_PORT=8080
ENV CURUPIRA_HOST=0.0.0.0
ENV PORT=8080
ENV HOST=0.0.0.0

# Health check with modern approach
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:8080/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Copy package.json for dynamic version reading
COPY package.json ./

# Metadata with dynamic version
LABEL org.opencontainers.image.source="https://github.com/drzln/curupira"
LABEL org.opencontainers.image.description="Curupira MCP Server - Enhanced CDP-native MCP debugging platform with 85+ resources and 40+ tools"
LABEL org.opencontainers.image.licenses="MIT"
LABEL curupira.features="cdp,react,xstate,zustand,apollo,connectivity"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "mcp-server/dist/cli.js", "start"]