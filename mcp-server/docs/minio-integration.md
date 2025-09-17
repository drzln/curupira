# MinIO Integration for Screenshot Storage

## Overview

Curupira now supports storing large responses (screenshots, PDFs) in MinIO or any S3-compatible storage instead of returning them as base64 data through MCP. This significantly reduces message size and improves performance.

## Architecture

```
Browser → CDP Screenshot → Curupira → MinIO Storage → Signed URL → MCP Response
                                    ↓
                                 Buffer Data
```

## Implementation Details

### 1. MinIO Service (`src/infrastructure/storage/minio.service.ts`)
- Implements `IMinIOService` interface with dependency injection
- Methods:
  - `store()`: Upload buffer to MinIO
  - `getSignedUrl()`: Generate pre-signed URLs
  - `delete()`: Remove objects
  - `checkConnection()`: Validate MinIO connectivity

### 2. Screenshot Tool Updates
- Modified all screenshot tools to use MinIO when available
- Falls back to base64 data if MinIO is not configured
- Returns signed URLs instead of raw image data

### 3. Configuration System
- Follows Nexus configuration hierarchy: YAML → Environment Variables
- Supports both MinIO and S3-compatible services
- Environment-specific configurations (development, staging, production)

## Configuration

### YAML Configuration
```yaml
storage:
  minio:
    enabled: true
    endPoint: "minio.infrastructure.plo.quero.local"
    port: 31900
    useSSL: false
    accessKey: "minioadmin"
    secretKey: "minioadmin"
    bucket: "curupira-screenshots"
    region: "us-east-1"
    signedUrlExpiry: 3600
```

### Environment Variables
```bash
STORAGE_MINIO_ENABLED=true
STORAGE_MINIO_ENDPOINT=minio.infrastructure.plo.quero.local
STORAGE_MINIO_PORT=31900
STORAGE_MINIO_ACCESS_KEY=your-access-key
STORAGE_MINIO_SECRET_KEY=your-secret-key
```

## MCP Response Format

### With MinIO Enabled
```json
{
  "success": true,
  "data": {
    "url": "http://minio.example.com/bucket/screenshots/1234.png?signature=...",
    "format": "png",
    "size": 145236,
    "stored": true,
    "timestamp": "2024-01-20T10:30:00Z"
  }
}
```

### Without MinIO (Fallback)
```json
{
  "success": true,
  "data": {
    "image": "base64-encoded-data...",
    "format": "png",
    "stored": false,
    "timestamp": "2024-01-20T10:30:00Z"
  }
}
```

## Benefits

1. **Reduced Message Size**: Screenshots are ~100KB-5MB, URLs are ~200 bytes
2. **Better Performance**: Faster MCP message transmission
3. **Direct Downloads**: Clients can download images directly from MinIO
4. **Scalability**: MinIO handles storage, not the MCP protocol
5. **Expiry Control**: Signed URLs expire after configured time

## Testing

1. Start MinIO locally:
```bash
docker run -p 9000:9000 -p 9001:9001 \
  minio/minio server /data --console-address ":9001"
```

2. Configure environment:
```bash
export STORAGE_MINIO_ENABLED=true
export STORAGE_MINIO_ENDPOINT=localhost
```

3. Take screenshot via MCP tools - response will contain MinIO URL

## PLO Cluster Access

When running from host (not in Kubernetes):
- MinIO API: `http://minio.infrastructure.plo.quero.local:31900`
- MinIO Console: `http://minio-console.infrastructure.plo.quero.local`

## Future Enhancements

- [ ] Automatic cleanup of old screenshots
- [ ] Support for multiple storage backends
- [ ] Compression before storage
- [ ] Metadata search capabilities