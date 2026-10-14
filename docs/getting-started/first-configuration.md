# First Configuration

This guide walks you through creating your first WAF configuration from scratch, explaining each section and its purpose.

## Starting from the Example

The project includes `config.example.yaml` which demonstrates all available options. We'll build a basic configuration step by step.

## Minimal Configuration

Here's the absolute minimum required configuration:

```yaml
proxy:
  host: "http://localhost:8080"

geoip:
  dbCountryPath: './geoip_data/GeoLite2-Country.mmdb'
  dbCityPath: './geoip_data/GeoLite2-City.mmdb'

wafMiddleware:
  mode: audit
```

This configuration:
- Runs in `audit` mode (rules are evaluated and IPs added to jail, but requests are not blocked)
- Proxies requests to `localhost:8080`

## Step-by-Step Configuration

### 1. Core Settings

Start by defining basic operational parameters:

```yaml
wafMiddleware:
  mode: audit  # 'audit' for testing, 'normal' for production
```

**Recommendation**: Always start with `audit` mode to test your rules before enforcing them.

### 2. Client IP Detection

Configure how to detect the real client IP (important if behind a proxy):

```yaml
wafMiddleware:
  detectClientIp:
    headers:
      - "x-forwarded-for"
      - "cf-connecting-ip"  # Add if using Cloudflare
```

The WAF checks headers in order. If not found, it falls back to the connection IP.

### 3. Proxy Configuration

Set up reverse proxy to your backend:

```yaml
proxy:
  host: "http://your-backend:8080"
```

Replace `http://your-backend:8080` with your actual backend URL.

### 4. Jail System (Optional but Recommended)

Configure IP banning:

```yaml
jailManager:
  enabled: true
  storage:
    driver: memory  # Use 'memory' for testing, 'file' for production
  filterRules: []  # Rules added in next step
```

For production, use file-based storage:

```yaml
jailManager:
  enabled: true
  storage:
    driver: file
    driverConfig:
      filePath: './data/blocked_ips.json'
      locker:
        enabled: true
        config:
          retries: 3
  filterRules: []
```

### 5. Add Your First Rule

Let's add a simple rate limiting rule:

```yaml
jailManager:
  enabled: true
  storage:
    driver: memory
  filterRules:
    # Limit requests from any IP
    - name: global-rate-limit
      type: composite
      uniqueClientKey: ["ip"]
      conditions: []  # Applies to all requests
      limit: 1000
      period: 60  # 1000 requests per 60 seconds
      duration: 300  # Ban for 5 minutes if exceeded
      escalationRate: 1.5  # Increase ban time on repeat offenses
```

This rule:
- Limits any IP to 1000 requests per minute
- Bans offenders for 5 minutes
- Increases ban time by 1.5x for repeat offenders

### 6. Whitelist (Optional)

Allow trusted IPs to bypass all checks:

```yaml
wafMiddleware:
  whitelist:
    ips:
      - "10.0.0.1"        # Specific IP
    ipSubnet:
      - "192.168.1.0/24"  # Local network
    geoCountry: []  # e.g., ["US", "GB"]
    geoCity: []
```

### 7. API Configuration (Optional)

Enable the management API:

```yaml
api:
  auth:
    enabled: true
    username: "admin"
    password: "change-this-password"
```

**Security**: Always enable auth and use a strong password!

### 8. Metrics (Optional)

Enable Prometheus metrics:

```yaml
metrics:
  enabled: true
  auth:
    enabled: false
```

## Complete Example Configuration

Putting it all together:

```yaml
# Proxy to backend
proxy:
  host: "http://localhost:8080"

# GeoIP databases
geoip:
  dbCountryPath: './geoip_data/GeoLite2-Country.mmdb'
  dbCityPath: './geoip_data/GeoLite2-City.mmdb'

# API for management
api:
  auth:
    enabled: true
    username: "admin"
    password: "secure-password-here"

# Prometheus metrics
metrics:
  enabled: true
  auth:
    enabled: false

# WAF middleware configuration
wafMiddleware:
  mode: audit

  # Client IP detection
  detectClientIp:
    headers:
      - "x-forwarded-for"

  # Whitelist trusted sources
  whitelist:
    ips:
      - "127.0.0.1"
    ipSubnet:
      - "192.168.1.0/24"
    geoCountry: []
    geoCity: []

# Jail system and filter rules
jailManager:
  enabled: true
  storage:
    driver: memory
  filterRules:
    # Global rate limit
    - name: global-rate-limit
      type: composite
      uniqueClientKey: ["ip"]
      conditions: []
      limit: 1000
      period: 60
      duration: 300
      escalationRate: 1.5
```

## Testing Your Configuration

1. **Start the WAF**:
   ```bash
   # Using Docker
   docker run -v $(pwd)/config.yaml:/app/config.yaml waf

   # Or using binary
   ./waf-linux-x64
   ```

2. **Check for errors** in the console output

3. **Test the health endpoint**:
   ```bash
   curl http://localhost:3000/waf/healthz
   ```

4. **Send test requests**:
   ```bash
   # Send a normal request
   curl http://localhost:3000/

   # Send many requests to trigger rate limit (in audit mode, just logs)
   for i in {1..1100}; do curl http://localhost:3000/ & done
   ```

5. **Check the API** (if enabled):
   ```bash
   curl -u admin:secure-password-here http://localhost:3000/waf/jail-manager/banned-users
   ```

## Environment Variables

Some settings can be configured via environment variables:

- **Config source**: `WAF_CONFIG_TYPE` and `WAF_CONFIG_SOURCE`
- **Instance ID**: `WAF_INSTANCE_ID`

See [Environment Variables](../configuration/environment-variables.md) for full list.

## Next Steps

Now that you have a working configuration:

- **Add more rules** - See [Filter Rules](../configuration/filter-rules.md)
- **Switch to normal mode** - When ready for production
- **Configure geolocation rules** - See [Geolocation](../configuration/geolocation.md)
- **Set up monitoring** - See [Prometheus Metrics](../monitoring/prometheus-metrics.md)

## Common Mistakes

1. **Wrong backend URL** - Requests won't be proxied correctly
2. **Starting in normal mode** - Test in audit mode first!
3. **Weak API passwords** - Always use strong, unique passwords
4. **Not configuring IP detection** - May ban wrong IPs if behind a proxy

For more help, see the [Troubleshooting Guide](../guides/troubleshooting.md).
