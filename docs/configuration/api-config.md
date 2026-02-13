# API Configuration

The WAF provides a REST API for managing and monitoring the firewall. This document covers API configuration (not the endpoints themselves - see [API Endpoints](../api/endpoints.md)).

## Overview

The API allows you to:
- Check WAF health
- View banned IPs
- Manually unban IPs
- Monitor jail status

## Basic Configuration

```yaml
api:
  enabled: true
  auth:
    enabled: true
    username: "admin"
    password: "your-secure-password"
```

### Fields

- **enabled**: Enable/disable the API
- **auth.enabled**: Enable/disable authentication
- **auth.username**: Username for Basic Auth
- **auth.password**: Password for Basic Auth

**Important**: These settings cannot be configured via environment variables (YAML only).

## Enabling the API

To enable the API:

```yaml
api:
  enabled: true
  auth:
    enabled: false  # Not recommended for production
```

**Access without auth**:
```bash
curl http://localhost:3000/waf/healthz
curl http://localhost:3000/waf/jail-manager/baned-users
```

## Enabling Authentication (Recommended)

Always enable authentication in production:

```yaml
api:
  enabled: true
  auth:
    enabled: true
    username: "admin"
    password: "MySecurePassword123!"
```

**Access with auth**:
```bash
curl -u admin:MySecurePassword123! http://localhost:3000/waf/healthz
curl -u admin:MySecurePassword123! http://localhost:3000/waf/jail-manager/baned-users
```

## Authentication

The API uses HTTP Basic Authentication:

```
Authorization: Basic base64(username:password)
```

### Endpoints Requiring Auth

When `auth.enabled: true`, authentication is required for:
- `GET /waf/jail-manager/baned-users`
- `DELETE /waf/jail-manager/baned-users`

### Public Endpoints

These endpoints never require authentication:
- `GET /waf/healthz`

## Password Security

**Important security considerations**:

### Strong Passwords

Use strong, unique passwords:

**Bad**:
```yaml
api:
  auth:
    password: "admin"      # Never use!
    password: "password"   # Never use!
    password: "12345"      # Never use!
```

**Good**:
```yaml
api:
  auth:
    password: "X7#mK9$pL2@nQ4vB"  # Strong, random
```

### Password Generation

Generate secure passwords:

```bash
# Linux/Mac
openssl rand -base64 32

# Or
pwgen -s 32 1

# Or
head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32
```

### Store Securely

**Don't commit passwords to git**:

```yaml
# Bad - password in git
api:
  auth:
    password: "MyPassword123"
```

**Better - use environment variable**:

While the config itself can't use env vars for API auth, you can generate the config file dynamically:

```bash
# generate-config.sh
cat > config.yaml <<EOF
api:
  enabled: true
  auth:
    enabled: true
    username: "${API_USERNAME}"
    password: "${API_PASSWORD}"
# ... rest of config
EOF
```

**Best - use secrets management**:

Use tools like:
- HashiCorp Vault
- AWS Secrets Manager
- Kubernetes Secrets
- Docker Secrets

## Configuration Examples

### Development (No Auth)

```yaml
api:
  enabled: true
  auth:
    enabled: false
```

**Use for**: Local development only. Never use in production.

### Production (With Auth)

```yaml
api:
  enabled: true
  auth:
    enabled: true
    username: "waf-admin"
    password: "X7#mK9$pL2@nQ4vB"
```

**Use for**: Production environments.

### Disabled API

```yaml
api:
  enabled: false
```

**Use for**: When API is not needed. Slightly more secure (smaller attack surface).

## Access Control

### Network-Level Restrictions

Best practice: Restrict API access at network level (firewall, security groups).

**iptables example**:
```bash
# Allow API access only from admin network
iptables -A INPUT -p tcp --dport 3000 -s 192.168.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

**AWS Security Group example**:
```
Type: Custom TCP
Port: 3000
Source: 10.0.1.0/24 (admin VPC)
```

### Reverse Proxy

Run WAF behind a reverse proxy that adds additional auth/restrictions:

```nginx
# Nginx example
location /waf/ {
    # Additional auth layer
    auth_basic "WAF Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # IP whitelist
    allow 192.168.1.0/24;
    deny all;

    proxy_pass http://waf:3000/waf/;
}
```

## Testing API

### Check Health

```bash
curl http://localhost:3000/waf/healthz
```

Expected response:
```
Hello from WAF server!
```

### Test Authentication

```bash
# Without auth (should fail if auth enabled)
curl http://localhost:3000/waf/jail-manager/baned-users
# Response: 401 Unauthorized

# With auth (should succeed)
curl -u admin:password http://localhost:3000/waf/jail-manager/baned-users
# Response: [ ... list of banned users ... ]
```

## API Clients

### curl

```bash
curl -u admin:password http://localhost:3000/waf/jail-manager/baned-users
```

### HTTPie

```bash
http -a admin:password localhost:3000/waf/jail-manager/baned-users
```

### Python

```python
import requests

auth = ('admin', 'password')
response = requests.get('http://localhost:3000/waf/jail-manager/baned-users', auth=auth)
print(response.json())
```

### JavaScript/Node.js

```javascript
const fetch = require('node-fetch');

const auth = Buffer.from('admin:password').toString('base64');

fetch('http://localhost:3000/waf/jail-manager/baned-users', {
    headers: {
        'Authorization': `Basic ${auth}`
    }
})
.then(res => res.json())
.then(data => console.log(data));
```

### Postman

1. Create new request
2. Set URL: `http://localhost:3000/waf/jail-manager/baned-users`
3. Go to Authorization tab
4. Type: Basic Auth
5. Username: `admin`
6. Password: `your-password`

## Monitoring API Usage

Enable logging to monitor API access:

### TODO

## Troubleshooting

### API not accessible

**Symptom**: `curl http://localhost:3000/waf/healthz` fails

**Causes**:
1. API disabled: Check `api.enabled: true`
2. WAF not running: Check `ps aux | grep waf`
3. Wrong port: Check `port` in config
4. Firewall blocking: Check firewall rules

### 401 Unauthorized

**Symptom**: Requests return 401

**Causes**:
1. Wrong username/password
2. Auth enabled but not providing credentials
3. Incorrect Basic Auth format

**Solution**:
```bash
# Verify credentials in config
grep -A5 "api:" config.yaml

# Test with correct creds
curl -u admin:correct-password http://localhost:3000/waf/jail-manager/baned-users
```

### API works locally but not remotely

**Cause**: Firewall blocking external access

**Solution**:
1. Check firewall rules
2. Check Docker port mapping: `-p 3000:3000`
3. Check cloud security groups

## Security Best Practices

1. **Always enable authentication** in production
2. **Use strong passwords** - At least 16 characters, random
3. **Don't commit passwords** to version control
4. **Restrict network access** - Firewall rules
5. **Use HTTPS** - Run WAF behind TLS-terminating reverse proxy
6. **Monitor API usage** - Log and alert on suspicious activity
7. **Rotate passwords** - Periodically change API password
8. **Principle of least privilege** - Only give API access to those who need it

## Related Documentation

- [API Overview](../api/README.md) - Introduction to the API
- [API Endpoints](../api/endpoints.md) - Available endpoints
- [API Examples](../api/examples.md) - Usage examples
- [Security Best Practices](../guides/security-best-practices.md) - Security hardening
