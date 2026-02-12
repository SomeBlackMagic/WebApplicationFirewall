# Environment Variables

While most WAF configuration is done via the YAML file, several environment variables can influence behavior, configuration loading, and external integrations.

## Overview

Environment variables are useful for:
- Changing configuration source without modifying code
- Deploying same codebase across environments
- Keeping secrets out of version control
- Container/cloud deployments (Docker, Kubernetes)

## Configuration Loading

### WAF_CONFIG_TYPE

**Type**: `string`
**Values**: `file` | `link`
**Default**: `file`

Specifies where to load the configuration from.

```bash
export WAF_CONFIG_TYPE=file
```

**Values**:
- `file`: Load from local filesystem
- `link`: Load from HTTP/HTTPS URL

### WAF_CONFIG_SOURCE

**Type**: `string`
**Default**: `./config.yaml` (when `WAF_CONFIG_TYPE=file`)

Path to configuration file or URL to configuration.

**For file**:

```bash
export WAF_CONFIG_TYPE=file
export WAF_CONFIG_SOURCE=/etc/waf/config.yaml
```

**For URL**:
```bash
export WAF_CONFIG_TYPE=link
export WAF_CONFIG_SOURCE=https://config.example.com/waf-config.yaml
```

**Use cases**:
- Centralized configuration management
- Dynamic configuration updates
- Environment-specific configs
- Secrets management integration

**Example - Load from S3** (via presigned URL):
```bash
export WAF_CONFIG_TYPE=link
export WAF_CONFIG_SOURCE=https://my-bucket.s3.amazonaws.com/waf/prod-config.yaml?signature=...
```

## Error Tracking

### SENTRY_DSN

**Type**: `string`
**Default**: None

Sentry DSN (Data Source Name) for error tracking integration.

```bash
export SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789012
```

This environment variable takes precedence over the YAML configuration:

```yaml
# config.yaml
sentry:
  dsn: "will-be-overridden"
```

**Use case**: Keep DSN out of config files (secret management).

## Application Metadata

### APP_VERSION

**Type**: `string`
**Default**: `dev-dirty`

Application version tag used in logs and Sentry reports.

```bash
export APP_VERSION=v1.2.3
```

**Use case**: Tag logs and errors with release version for easier tracking.

**Example with Git**:
```bash
export APP_VERSION=$(git describe --tags --always)
npm start
```

**Docker**:
```dockerfile
ARG VERSION=latest
ENV APP_VERSION=$VERSION
```

```bash
docker build --build-arg VERSION=v1.2.3 -t waf:1.2.3 .
```

## Legacy Audit Mode

**Note**: These are legacy settings. The new `mode: audit` in YAML is recommended.

### WAF_AUDIT

**Type**: `boolean` (string "true" or "false")
**Default**: `false`

Enable legacy request/response audit logging.

```bash
export WAF_AUDIT=true
```

When enabled, the WAF logs additional debugging information about requests and responses.

### WAF_AUDIT_REQUEST

**Type**: `boolean`
**Default**: `false`
**Requires**: `WAF_AUDIT=true`

Log incoming request details (headers, body, etc.) when audit is enabled.

```bash
export WAF_AUDIT=true
export WAF_AUDIT_REQUEST=true
```

**Warning**: May log sensitive data (auth headers, request bodies).

### WAF_AUDIT_RESPONSE

**Type**: `boolean`
**Default**: `false`
**Requires**: `WAF_AUDIT=true`

Log outgoing response details (headers, body, etc.) when audit is enabled.

```bash
export WAF_AUDIT=true
export WAF_AUDIT_RESPONSE=true
```

**Note**: Prefer using `mode: audit` in YAML for modern audit mode.

## Configuration Precedence

When both YAML and environment variables are set:

| Setting | YAML | Environment Variable | Precedence |
|---------|------|---------------------|------------|
| **Config source** | N/A | `WAF_CONFIG_TYPE`, `WAF_CONFIG_SOURCE` | Env only |
| **Sentry DSN** | `sentry.dsn` | `SENTRY_DSN` | **Env wins** |
| **App version** | N/A | `APP_VERSION` | Env only |
| **Audit mode** | `mode: audit` | `WAF_AUDIT` | YAML recommended |
| **Port** | `port: 3000` | N/A | **YAML only** |
| **GeoIP paths** | `geoip.countryPath` | N/A | **YAML only** |
| **API auth** | `api.auth.*` | N/A | **YAML only** |

**Cannot be set via environment variables**:
- Port (`port`)
- GeoIP database paths (`geoip.countryPath`, `geoip.cityPath`)
- API authentication (`api.auth.username`, `api.auth.password`)
- Logging configuration (`log.*`)
- Metrics configuration (`metrics.*`)
- All rule configurations
- Proxy settings
- Whitelist/Blacklist settings

## Complete Example

### Development

```bash
#!/bin/bash
# dev-start.sh

export WAF_CONFIG_TYPE=file
export WAF_CONFIG_SOURCE=./config-dev.yaml
export APP_VERSION=dev
export WAF_AUDIT=true
export WAF_AUDIT_REQUEST=true

npm start
```

### Production

```bash
#!/bin/bash
# prod-start.sh

export WAF_CONFIG_TYPE=link
export WAF_CONFIG_SOURCE=https://secrets.example.com/waf-config.yaml
export SENTRY_DSN=$(cat /run/secrets/sentry-dsn)
export APP_VERSION=$(cat VERSION)

npm start
```

### Docker

**Dockerfile**:
```dockerfile
FROM node:22-alpine

ARG VERSION=latest
ENV APP_VERSION=$VERSION

COPY . /app
WORKDIR /app

RUN npm install --production

CMD ["node", "dist/main.js"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  waf:
    image: waf:latest
    environment:
      - WAF_CONFIG_TYPE=file
      - WAF_CONFIG_SOURCE=/app/config.yaml
      - SENTRY_DSN=${SENTRY_DSN}
      - APP_VERSION=1.2.3
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./geoip:/app/geoip:ro
    ports:
      - "3000:3000"
```

**.env file** (for docker-compose):
```env
SENTRY_DSN=https://abc123@sentry.io/789012
```

### Kubernetes

**ConfigMap** (for config file):
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: waf-config
data:
  config.yaml: |
    mode: normal
    port: 3000
    # ... rest of config
```

**Secret** (for sensitive data):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: waf-secrets
type: Opaque
stringData:
  sentry-dsn: "https://abc123@sentry.io/789012"
```

**Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: waf
spec:
  replicas: 3
  selector:
    matchLabels:
      app: waf
  template:
    metadata:
      labels:
        app: waf
    spec:
      containers:
      - name: waf
        image: waf:1.2.3
        env:
        - name: WAF_CONFIG_TYPE
          value: "file"
        - name: WAF_CONFIG_SOURCE
          value: "/etc/waf/config.yaml"
        - name: SENTRY_DSN
          valueFrom:
            secretKeyRef:
              name: waf-secrets
              key: sentry-dsn
        - name: APP_VERSION
          value: "1.2.3"
        volumeMounts:
        - name: config
          mountPath: /etc/waf
          readOnly: true
        - name: geoip
          mountPath: /app/geoip
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: waf-config
      - name: geoip
        hostPath:
          path: /var/lib/waf/geoip
```

## Security Considerations

### Secrets in Environment Variables

**Risk**: Environment variables can be exposed via:
- Process listings (`ps aux | grep WAF`)
- Container inspect (`docker inspect`)
- Kubernetes API
- Logs (if accidentally logged)

**Best practices**:

1. **Use secrets management**:
   - Docker Secrets
   - Kubernetes Secrets
   - HashiCorp Vault
   - AWS Secrets Manager

2. **Don't log environment variables**:
```javascript
// Bad
console.log(process.env);

// Good
console.log('Starting WAF...');
```

3. **Limit access**:
   - Container: Run as non-root user
   - Kubernetes: RBAC policies
   - AWS: IAM roles

4. **Rotate secrets regularly**:
```bash
# Update Sentry DSN
kubectl delete secret waf-secrets
kubectl create secret generic waf-secrets --from-literal=sentry-dsn=new-dsn
kubectl rollout restart deployment/waf
```

### Configuration URL Security

When using `WAF_CONFIG_TYPE=link`:

1. **Use HTTPS**: Never HTTP for remote config
2. **Validate source**: Only load from trusted domains
3. **Authentication**: Use presigned URLs or auth headers
4. **Integrity**: Verify checksum if possible

**Bad**:
```bash
export WAF_CONFIG_SOURCE=http://untrusted.com/config.yaml  # NO!
```

**Good**:
```bash
export WAF_CONFIG_SOURCE=https://trusted-internal.example.com/config.yaml
```

## Troubleshooting

### Config not loading from URL

**Symptom**: WAF fails to start with config fetch error.

**Causes**:
1. `WAF_CONFIG_TYPE` not set to `link`
2. URL not accessible
3. Invalid HTTPS certificate
4. Network firewall blocking

**Debug**:
```bash
# Test URL manually
curl "$WAF_CONFIG_SOURCE"

# Check environment variables
env | grep WAF_

# Start with debug logging
export WAF_AUDIT=true
npm start
```

### Environment variable not taking effect

**Cause**: YAML config taking precedence (for settings that support both).

**Solution**: Check [Configuration Precedence](#configuration-precedence).

For settings like `SENTRY_DSN`, env should override YAML. If not working:
1. Verify variable is set: `echo $SENTRY_DSN`
2. Check for typos in variable name
3. Restart WAF after setting variable

### Secrets exposed in logs

**Symptom**: Sentry DSN or other secrets appearing in logs.

**Cause**: Logging environment or config accidentally.

**Solution**:
- Review logging code
- Don't log full config or env
- Redact sensitive values in logs

## Best Practices

1. **Use env vars for secrets** - Keep DSNs, passwords out of config files
2. **Use YAML for config** - Structure is clearer than env vars
3. **Document required vars** - In README or deployment guide
4. **Validate at startup** - Check required env vars are set
5. **Use defaults** - Provide sensible defaults when possible
6. **Separate dev/prod** - Different env files for environments
7. **Use secrets management** - Vault, AWS Secrets Manager, etc.
8. **Audit env vars** - Review what's set in production

## Related Documentation

- [Core Parameters](core-parameters.md) - YAML configuration
- [Configuration Loading](README.md) - How config is loaded
- [Deployment](../deployment/docker.md) - Container deployments
- [Security Best Practices](../guides/security-best-practices.md) - Secrets management
