# Curupira Configuration Guide

Curupira follows the Nexus configuration hierarchy pattern:

1. **Base YAML** → 2. **Environment YAML** → 3. **Environment Variables**

## Configuration Hierarchy

```
config/
├── base.yaml         # Default values for all environments
├── development.yaml  # Development overrides
├── staging.yaml      # Staging overrides
└── production.yaml   # Production overrides
```

## MinIO/S3 Storage Configuration

Curupira can store large responses (screenshots, PDFs) in MinIO or S3-compatible storage instead of returning them directly via MCP.

### YAML Configuration

```yaml
# config/base.yaml or environment-specific YAML
storage:
  minio:
    enabled: false                    # Enable/disable MinIO storage
    endPoint: "localhost"             # MinIO/S3 endpoint
    port: 9000                        # Port (9000 for MinIO, 443 for S3)
    useSSL: false                     # Use SSL/TLS
    accessKey: "minioadmin"           # Access key
    secretKey: "minioadmin"           # Secret key
    bucket: "curupira-screenshots"    # Bucket name
    region: "us-east-1"               # Region (required for S3)
    signedUrlExpiry: 3600             # Signed URL expiry in seconds
```

### Environment Variable Overrides

Environment variables always override YAML values:

```bash
# Enable MinIO storage
export STORAGE_MINIO_ENABLED=true

# Configure MinIO endpoint
export STORAGE_MINIO_ENDPOINT=minio.example.com
export STORAGE_MINIO_PORT=9000
export STORAGE_MINIO_USE_SSL=true

# Set credentials (recommended for production)
export STORAGE_MINIO_ACCESS_KEY=your-access-key
export STORAGE_MINIO_SECRET_KEY=your-secret-key

# Configure bucket and region
export STORAGE_MINIO_BUCKET=curupira-production
export STORAGE_MINIO_REGION=us-west-2
```

## Example Configurations

### Local Development with MinIO

```yaml
# config/development.yaml
storage:
  minio:
    enabled: true
    endPoint: "localhost"
    port: 9000
    useSSL: false
    bucket: "curupira-dev"
```

### Production with AWS S3

```yaml
# config/production.yaml
storage:
  minio:
    enabled: true
    endPoint: "s3.amazonaws.com"
    port: 443
    useSSL: true
    region: "us-west-2"
    bucket: "my-company-curupira"
    # accessKey and secretKey via environment variables
```

### PLO Cluster MinIO (from Host)

```yaml
# config/staging.yaml or production.yaml
storage:
  minio:
    enabled: true
    endPoint: "minio.infrastructure.plo.quero.local"
    port: 31900  # NodePort for host access
    useSSL: false
    bucket: "curupira-staging"
```

**Note**: When running Curupira from the host (not inside Kubernetes), use the NodePort endpoint:
- MinIO API: `http://minio.infrastructure.plo.quero.local:31900`
- MinIO Console: `http://minio-console.infrastructure.plo.quero.local`

## How It Works

When MinIO storage is enabled:

1. **Screenshot/PDF capture** → Stored in MinIO
2. **MCP response** → Returns MinIO signed URL
3. **Client access** → Downloads from MinIO URL

Benefits:
- Reduced MCP message size
- Better performance for large files
- Direct download links with expiry
- Scalable storage backend

## Testing MinIO Configuration

1. Start MinIO locally:
   ```bash
   docker run -p 9000:9000 -p 9001:9001 \
     -e MINIO_ROOT_USER=minioadmin \
     -e MINIO_ROOT_PASSWORD=minioadmin \
     minio/minio server /data --console-address ":9001"
   ```

2. Configure Curupira:
   ```bash
   export STORAGE_MINIO_ENABLED=true
   export STORAGE_MINIO_ENDPOINT=localhost
   npm run start
   ```

3. Take a screenshot via MCP - it will return a MinIO URL instead of base64 data.