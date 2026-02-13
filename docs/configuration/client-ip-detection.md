# Client IP Detection

Detecting the real client IP address is critical for the WAF to function correctly, especially when running behind proxies or load balancers.

## Overview

When the WAF runs behind a reverse proxy (Nginx, Apache, Cloudflare, etc.), the direct connection IP is the proxy's IP, not the client's. The `detectClientIp` configuration tells the WAF which HTTP headers to check for the real client IP.

## Configuration

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "x-forwarded-for"
    - "cf-connecting-ip"
    - "x-real-ip"
```

### headers

**Type**: `array of strings`
**Default**: `["x-forwarded-for"]` if not specified

List of HTTP headers to check for the client IP, in order of priority.

The WAF checks headers in the specified order and uses the first one found. If none of the specified headers are present, it falls back to:
1. The first IP from `x-forwarded-for` header
2. `req.ip` (Express.js request IP)

## Common Header Values

### x-forwarded-for

Standard header used by most proxies and load balancers.

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "x-forwarded-for"
```

Format: `client-ip, proxy1-ip, proxy2-ip`

The WAF extracts the first (leftmost) IP as the client IP.

**Example header value**:
```
X-Forwarded-For: 203.0.113.195, 198.51.100.178
```
Detected IP: `203.0.113.195`

### cf-connecting-ip

Cloudflare-specific header containing the real client IP.

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "cf-connecting-ip"
```

**Recommended when using Cloudflare** as it's more reliable than `x-forwarded-for`.

### x-real-ip

Commonly set by Nginx when proxying.

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "x-real-ip"
```

**Nginx configuration example**:
```nginx
location / {
    proxy_pass http://waf:3000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### true-client-ip

Used by some CDNs (Akamai, Cloudflare Enterprise).

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "true-client-ip"
```

## Priority and Fallback

The WAF checks headers in the order specified. Example:

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "cf-connecting-ip"      # Check first (Cloudflare)
    - "x-forwarded-for"       # Check second (standard)
    - "x-real-ip"             # Check third (Nginx)
```

**Fallback behavior**:
1. Check `cf-connecting-ip` → If found, use it
2. If not found, check `x-forwarded-for` → If found, use first IP
3. If not found, check `x-real-ip` → If found, use it
4. If none found, use `x-forwarded-for` anyway (first IP if present)
5. Final fallback: use `req.ip`

## Configuration Examples

### Behind Nginx

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "x-real-ip"
    - "x-forwarded-for"
```

### Behind Cloudflare

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "cf-connecting-ip"
```

### Behind AWS ALB/ELB

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "x-forwarded-for"
```

### Multiple Proxy Layers

When behind multiple proxies (e.g., Cloudflare → Nginx → WAF):

```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "cf-connecting-ip"  # Cloudflare's header
    - "x-forwarded-for"   # Fallback
```

### No Proxy (Direct)

If the WAF receives connections directly from clients:

```yaml
# Can omit this section entirely, or use:
wafMiddleware:
  detectClientIp:
    headers: []
```

The WAF will use `req.ip` directly.

## Verification

To verify IP detection is working correctly:

1. **Send a test request** with different headers:

```bash
curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:3000/
```

2. **Check the logs** - the WAF logs the detected IP:

```
[INFO] Request from IP: 1.2.3.4
```

3. **Use the API** to check banned IPs include the correct client IP:

```bash
curl -u admin:password http://localhost:3000/waf/jail-manager/baned-users
```

## Security Considerations

### Header Spoofing

**Problem**: Clients can send fake headers:

```bash
curl -H "X-Forwarded-For: 127.0.0.1" http://your-waf/
```

**Solution**: Only trust headers set by YOUR proxy, not by clients.

**Best practice**:
- Configure your reverse proxy to **strip** client-sent headers
- Have your proxy **set** the headers with real values

**Example Nginx configuration**:
```nginx
location / {
    proxy_pass http://waf:3000;
    # Remove any client-sent X-Forwarded-For
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Trusting the Wrong Header

If using Cloudflare but checking `x-forwarded-for` first, clients can spoof:

**Bad**:
```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "x-forwarded-for"  # Can be spoofed
    - "cf-connecting-ip" # Never checked
```

**Good**:
```yaml
wafMiddleware:
  detectClientIp:
    headers:
    - "cf-connecting-ip" # Checked first, set by Cloudflare
    - "x-forwarded-for"  # Fallback only
```

## Troubleshooting

### Wrong IPs being banned

**Symptom**: Proxy IP (e.g., `127.0.0.1` or proxy's IP) is being banned instead of client IP.

**Cause**: IP detection not configured correctly.

**Solution**:
1. Enable audit mode to see debug information:
   ```yaml
   wafMiddleware:
     mode: audit
   ```
2. Check what headers your proxy sets by reviewing the logs
3. Configure `wafMiddleware.detectClientIp.headers` accordingly

### All requests show same IP

**Symptom**: All clients appear to have the same IP (proxy IP).

**Cause**: Proxy not sending client IP headers.

**Solution**: Configure your reverse proxy to send headers. See [Reverse Proxy](../deployment/reverse-proxy.md).

### IPv6 addresses showing as IPv4

This is expected behavior. IPv6 addresses are supported and logged as-is.

## Related Configuration

- [Reverse Proxy Setup](../deployment/reverse-proxy.md) - Configuring Nginx/Apache
- [Jail System](jail-system.md) - IP banning configuration
- [Whitelist](static-lists.md) - Whitelisting trusted IPs

## Testing

Create a test script to verify IP detection:

```bash
#!/bin/bash

# Test various headers
echo "Testing X-Forwarded-For:"
curl -H "X-Forwarded-For: 1.1.1.1" http://localhost:3000/waf/healthz

echo "Testing CF-Connecting-IP:"
curl -H "CF-Connecting-IP: 2.2.2.2" http://localhost:3000/waf/healthz

echo "Testing X-Real-IP:"
curl -H "X-Real-IP: 3.3.3.3" http://localhost:3000/waf/healthz

# Check logs to see which IP was detected
```

Review WAF logs to confirm the correct IP was extracted.
