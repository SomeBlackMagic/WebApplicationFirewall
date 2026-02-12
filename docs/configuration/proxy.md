# Proxy Configuration

The WAF can act as a reverse proxy, forwarding validated requests to your backend service. This is the primary deployment mode.

## Overview

When proxy mode is enabled:
1. Requests arrive at the WAF
2. WAF applies all security checks (whitelist, blacklist, rules, jail)
3. Valid requests are proxied to the backend
4. Backend responses are returned to the client
5. Invalid requests receive error responses from WAF

## Basic Configuration

```yaml
proxy:
  enabled: true
  host: "http://your-backend:8080"
  config: {}
```

### Fields

- **enabled**: Enable/disable proxy mode
- **host**: URL of your backend service
- **config**: Additional options for `http-proxy-middleware` (optional)

## Enabling the Proxy

```yaml
proxy:
  enabled: true
  host: "http://localhost:8080"
```

**Important**: The `host` must be a complete URL including protocol (`http://` or `https://`).

## Backend URL Examples

### Local backend

```yaml
proxy:
  enabled: true
  host: "http://localhost:8080"
```

### Backend on same network

```yaml
proxy:
  enabled: true
  host: "http://app-server:3000"
```

### Backend on different server

```yaml
proxy:
  enabled: true
  host: "http://192.168.1.100:8080"
```

### HTTPS backend

```yaml
proxy:
  enabled: true
  host: "https://secure-backend.internal:443"
```

## Docker Networking

When WAF and backend are in Docker:

### Same Docker network

```yaml
proxy:
  enabled: true
  host: "http://backend-container:8080"
```

### Backend on host machine

```yaml
proxy:
  enabled: true
  host: "http://host.docker.internal:8080"
```

**Note**: `host.docker.internal` works on Mac/Windows. On Linux, use `172.17.0.1` or create a bridge network.

## Advanced Configuration

The `config` object accepts options from `http-proxy-middleware`.

### Custom headers

Forward additional headers to backend:

```yaml
proxy:
  enabled: true
  host: "http://backend:8080"
  config:
    headers:
      X-Forwarded-By: "WAF"
      X-WAF-Version: "1.0.0"
```

### Path rewriting

Rewrite request paths before proxying:

```yaml
proxy:
  enabled: true
  host: "http://backend:8080"
  config:
    pathRewrite:
      "^/api": "/v1"  # /api/users → /v1/users
```

### Change origin

```yaml
proxy:
  enabled: true
  host: "http://backend:8080"
  config:
    changeOrigin: true
```

Set to `true` when proxying to a virtual hosted site.

### WebSocket support

Enable WebSocket proxying:

```yaml
proxy:
  enabled: true
  host: "http://backend:8080"
  config:
    ws: true
```

### Timeout configuration

```yaml
proxy:
  enabled: true
  host: "http://backend:8080"
  config:
    proxyTimeout: 30000  # 30 seconds
```

### Complete advanced example

```yaml
proxy:
  enabled: true
  host: "http://backend:8080"
  config:
    changeOrigin: true
    ws: true
    headers:
      X-Forwarded-By: "WAF"
    pathRewrite:
      "^/api/v1": "/api"
    proxyTimeout: 60000
    logLevel: "warn"
```

## Request Headers

The WAF automatically forwards important headers to the backend:

- Original request headers (cookies, auth, etc.)
- `X-Forwarded-For` - Client IP chain
- `X-Forwarded-Proto` - Original protocol (http/https)
- `X-Forwarded-Host` - Original host header

Your backend can use these to identify the real client.

**Backend example (Express.js)**:

```javascript
app.get('/api/user', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.ip;
  console.log(`Request from ${clientIp}`);
  // ...
});
```

## Running Without Proxy

You can run WAF without proxy mode for testing or special use cases:

```yaml
proxy:
  enabled: false
```

In this mode:
- WAF still enforces all security checks
- Blocked requests receive error responses
- Allowed requests receive a success response from WAF itself (not proxied)
- Useful for testing WAF rules without a backend

## Multiple Backends

Currently, WAF supports proxying to a single backend host. For multiple backends:

### Option 1: Run multiple WAF instances

Each WAF instance proxies to a different backend.

### Option 2: Use path-based routing in a reverse proxy

Place Nginx/HAProxy in front of multiple WAF instances:

```
Client → Nginx → WAF-1 → Backend-1
               → WAF-2 → Backend-2
```

## SSL/TLS Termination

The WAF can proxy to HTTPS backends:

```yaml
proxy:
  enabled: true
  host: "https://secure-backend:443"
```

**Best practice**: Terminate SSL/TLS at a reverse proxy (Nginx) in front of the WAF:

```
Client ←TLS→ Nginx ←HTTP→ WAF ←HTTP→ Backend
```

This simplifies certificate management and offloads encryption from the WAF.

## Health Checks

The WAF includes a health endpoint that doesn't proxy to the backend:

```
GET /waf/healthz
```

Use this for load balancer health checks, not the backend's health endpoint.

## Monitoring

### Metrics

If metrics are enabled, proxy-related metrics are exposed:

```
http_request_duration_seconds{method="GET",status="200"}
```

See [Prometheus Metrics](../monitoring/prometheus-metrics.md).

### Logging

Proxy requests are logged:

```
[INFO] Proxying request: GET /api/users → http://backend:8080/api/users
```

## Troubleshooting

### Backend not responding

**Error**: `ECONNREFUSED` or `503 Service Unavailable`

**Cause**: Backend is down or unreachable.

**Solutions**:
1. Verify backend is running: `curl http://backend:8080/`
2. Check network connectivity
3. Verify firewall rules
4. Check backend logs

### Wrong backend URL

**Symptom**: Requests proxied to wrong location

**Cause**: Incorrect `host` configuration

**Solution**: Verify `host` URL:
```bash
# Test backend directly
curl http://your-backend:8080/

# Should work before proxying
```

### Timeout errors

**Error**: `504 Gateway Timeout`

**Cause**: Backend taking too long to respond

**Solutions**:
1. Increase `proxyTimeout` in config
2. Optimize backend performance
3. Check backend for slow queries/operations

### Docker networking issues

**Error**: `ENOTFOUND backend-container`

**Cause**: Containers not on same network

**Solution**:

```bash
# Create network
docker network create waf-network

# Run both containers on same network
docker run --network waf-network --name backend ...
docker run --network waf-network --name waf ...
```

### Headers not forwarded

**Symptom**: Backend doesn't see client IP or other headers

**Cause**: Proxy not forwarding headers

**Solution**: Headers are forwarded automatically. Ensure backend reads from `X-Forwarded-For`:

```javascript
// Backend code
const clientIp = req.headers['x-forwarded-for'] || req.ip;
```

### WebSocket connection fails

**Symptom**: WebSocket connections don't work through WAF

**Solution**: Enable WebSocket support:

```yaml
proxy:
  enabled: true
  host: "http://backend:8080"
  config:
    ws: true
```

## Performance Considerations

### Latency

WAF adds minimal latency (~1-5ms) for security checks. Proxy itself adds negligible overhead.

### Throughput

WAF can handle thousands of requests per second. Bottleneck is usually the backend, not the WAF.

### Connection Pooling

The proxy reuses connections to the backend for better performance.

## Best Practices

1. **Use HTTP between WAF and backend** - Simpler and faster on internal networks
2. **Terminate TLS upstream** - Use Nginx/HAProxy for SSL termination
3. **Monitor backend health** - Don't rely solely on WAF health checks
4. **Set appropriate timeouts** - Match backend expected response time
5. **Use same network** - Deploy WAF and backend on same network for low latency
6. **Enable WebSocket if needed** - Only if backend uses WebSocket
7. **Log proxy errors** - Monitor for backend connection issues

## Security Considerations

### Backend Exposure

**Important**: The backend should NOT be directly accessible from the internet. Only the WAF should accept external traffic.

**Firewall example**:
```bash
# Allow WAF to access backend
iptables -A INPUT -s <waf-ip> -p tcp --dport 8080 -j ACCEPT

# Block all other access to backend
iptables -A INPUT -p tcp --dport 8080 -j DROP
```

### Trusted Headers

Backend should trust headers from WAF (since WAF validates traffic). Do NOT trust client-sent headers directly.

### Backend Authentication

Even behind WAF, backend should implement authentication. WAF blocks malicious traffic, but doesn't replace application-level auth.

## Related Configuration

- [Client IP Detection](client-ip-detection.md) - Detecting real client IP behind proxies
- [Reverse Proxy Setup](../deployment/reverse-proxy.md) - Nginx/Apache in front of WAF
- [High Availability](../deployment/high-availability.md) - Load balancing multiple WAF instances
