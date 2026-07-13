# Storage Configuration Guide

## Overview

The DDN RAG application stores AWS S3 and DDN INFINIA storage credentials in a persistent JSON file for convenient reuse across sessions. This guide explains where these credentials are stored and how to manage them, especially when deploying to new environments like HyperPOD.

---

## Storage Location

### Backend Persistence
Credentials are stored in a **JSON file** on the backend server:

```
backend/data/storage_config.json
```

### File Structure
```json
{
  "aws": {
    "access_key": "YOUR_AWS_ACCESS_KEY",
    "secret_key": "YOUR_AWS_SECRET_KEY",
    "bucket_name": "your-s3-bucket",
    "region": "us-east-1",
    "provider": "AWS S3"
  },
  "ddn": {
    "access_key": "YOUR_DDN_ACCESS_KEY",
    "secret_key": "YOUR_DDN_SECRET_KEY",
    "bucket_name": "your-infinia-bucket",
    "endpoint_url": "https://your-ddn-endpoint:8111",
    "region": "us-east-1",
    "provider": "DDN INFINIA"
  }
}
```

### Configuration Class
The `StorageConfig` class (`backend/app/core/config.py`) manages all credential operations:
- **Loading**: Automatically loads credentials on backend startup
- **Saving**: Persists credentials to disk after every update
- **Validation**: Validates required fields before use
- **Reset**: Clears credentials when requested

---

## Using the Configuration Page

### Initial Setup
1. Navigate to the **Configuration** page in the web UI
2. Enter credentials for AWS S3 and/or DDN INFINIA
3. Click **Save Configuration** to persist the credentials
4. Click **Test** to verify the connection

### Testing Connections
- Use the **Test** button on each provider card to verify credentials
- Use the **Test Connections** button at the top to test both providers at once
- Status indicators show connection health in real-time

### Resetting Credentials
When deploying to a new environment (e.g., HyperPOD), you can reset stored credentials:

1. Click the **Reset** button (trash icon) on the provider card
2. Confirm the reset action in the dialog
3. The credentials will be cleared from both memory and the JSON file
4. Re-enter new credentials for the new environment

---

## Deployment to HyperPOD (GPU-based Ubuntu)

### Pre-Deployment Checklist

Before deploying to a HyperPOD cluster, ensure you understand the credential management workflow:

#### Option 1: Reset Via UI (Recommended)
1. **Access the application** in your HyperPOD environment
2. **Navigate to Configuration** page
3. **Click Reset** on both AWS S3 and DDN INFINIA cards
4. **Enter new credentials** specific to your HyperPOD environment
5. **Test connections** to verify

#### Option 2: Manual File Deletion
If you have direct file system access:
```bash
# Navigate to the backend data directory
cd backend/data/

# Delete the configuration file
rm storage_config.json

# Restart the backend service
# The application will create an empty config file on startup
```

#### Option 3: Environment Variables (Production-Grade)
For production deployments, consider using environment variables or AWS Secrets Manager:

1. **Set environment variables** in your HyperPOD launch configuration:
   ```bash
   export AWS_ACCESS_KEY_ID="your_key"
   export AWS_SECRET_ACCESS_KEY="your_secret"
   export DDN_ACCESS_KEY="your_ddn_key"
   export DDN_SECRET_KEY="your_ddn_secret"
   ```

2. **Modify backend code** to read from environment variables as fallback (future enhancement)

---

## API Endpoints

### Configuration Endpoints

#### Save AWS Configuration
```http
POST /api/config/aws
Content-Type: application/json

{
  "access_key": "string",
  "secret_key": "string",
  "bucket_name": "string",
  "region": "string"
}
```

#### Save DDN INFINIA Configuration
```http
POST /api/config/ddn
Content-Type: application/json

{
  "access_key": "string",
  "secret_key": "string",
  "bucket_name": "string",
  "endpoint_url": "string",
  "region": "string"
}
```

#### Get Current Configuration (Safe - No Secrets)
```http
GET /api/config/current

Response:
{
  "aws": {
    "configured": true,
    "bucket_name": "my-bucket",
    "region": "us-east-1"
  },
  "ddn": {
    "configured": true,
    "bucket_name": "infinia-bucket",
    "endpoint_url": "https://ddn-endpoint:8111",
    "region": "us-east-1"
  }
}
```

#### Test Connection
```http
GET /api/config/test/{provider}

Parameters:
  provider: "aws" | "ddn_infinia"

Response:
{
  "provider": "aws",
  "success": true,
  "message": "Successfully connected to AWS S3",
  "latency_ms": 45.2
}
```

#### Reset Configuration
```http
DELETE /api/config/reset/{provider}

Parameters:
  provider: "aws" | "ddn_infinia" | "all"

Response:
{
  "success": true,
  "message": "AWS S3 configuration has been reset",
  "provider": "aws"
}
```

---

## Security Considerations

### Current Implementation
⚠️ **WARNING**: Credentials are currently stored in **plain text** in the JSON file.

### Security Recommendations

#### For Development/Testing
- Current file-based storage is acceptable
- Ensure `backend/data/` is excluded from version control (add to `.gitignore`)
- Limit file system access to authorized users

#### For Production/HyperPOD
1. **Use Environment Variables**:
   - Store credentials in environment variables
   - Read from environment at runtime
   - Never commit credentials to version control

2. **Use AWS Secrets Manager or Parameter Store**:
   - Store credentials in AWS Secrets Manager
   - Retrieve at application startup
   - Automatic rotation support

3. **Use IAM Roles** (for AWS):
   - Assign IAM roles to EC2 instances or containers
   - No need to store AWS credentials at all
   - Most secure option for AWS deployments

4. **Encrypt Configuration File**:
   - Encrypt `storage_config.json` at rest
   - Use encryption keys from AWS KMS
   - Decrypt at runtime

---

## Architecture Details

### Persistence Flow

```
┌─────────────────┐
│   Frontend UI   │
│  (React/TSX)    │
└────────┬────────┘
         │
         │ POST /api/config/aws
         │ POST /api/config/ddn
         ▼
┌─────────────────┐
│  FastAPI Routes │
│  (routes.py)    │
└────────┬────────┘
         │
         │ storage_config.update_aws_config()
         │ storage_config.update_ddn_config()
         ▼
┌─────────────────┐
│ StorageConfig   │
│  (config.py)    │
└────────┬────────┘
         │
         │ _save_config()
         ▼
┌─────────────────┐
│  JSON File      │
│  storage_       │
│  config.json    │
└─────────────────┘
```

### Loading Flow

```
┌─────────────────┐
│  Application    │
│  Startup        │
└────────┬────────┘
         │
         │ StorageConfig.__init__()
         ▼
┌─────────────────┐
│  _load_config() │
│  reads JSON file│
└────────┬────────┘
         │
         │ Updates in-memory config
         ▼
┌─────────────────┐
│  Configuration  │
│  Available in   │
│  Memory         │
└─────────────────┘
```

---
## Summary

- **Storage**: Credentials are saved in `backend/data/storage_config.json`
- **Reset**: Use the trash icon button on the Configuration page
- **Security**: Plain text storage is acceptable for development; use secrets management for production
- **HyperPOD**: Reset credentials when deploying to new environments
- **API**: Full REST API available for programmatic configuration management
