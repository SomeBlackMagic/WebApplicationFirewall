# First Configuration

This guide walks you through creating your first WAF configuration from scratch, explaining each section and its purpose.

## Starting from the Example

The project includes `config.example.yaml` which demonstrates all available options. We'll build a basic configuration step by step.

## Minimal Configuration

Here's the absolute minimum required configuration:

```yaml
mode: audit
port: 3000

geoip:
  countryPath: './GeoLite2-Country.mmdb'
  cityPath: './GeoLite2-City.mmdb'

log:
  level: 'info'
  transport: 'console'

proxy:
  enabled: true
  host: "http://localhost:8080"
```

This configuration:
- Runs in `audit` mode (logs only, no blocking)
- Listens on port 3000
- Uses local GeoIP databases
- Logs to console at INFO level
- Proxies requests to `localhost:8080`

## Step-by-Step Configuration

### 1. Core Settings

Start by defining basic operational parameters:

```yaml
# Operating mode: 'audit' for testing, 'normal' for production
mode: audit

# Port to listen on
port: 3000
```

**Recommendation**: Always start with `audit` mode to test your rules before enforcing them.

### 2. Logging

Configure how the WAF logs information:

```yaml
log:
  level: 'info'  # Options: trace, debug, info, warn, error, fatal
  transport: 'console'
  transportConfig: {}
```

### 3. GeoIP Databases

Specify paths to MaxMind GeoLite2 databases:

```yaml
geoip:
  countryPath: './GeoLite2-Country.mmdb'
  cityPath: './GeoLite2-City.mmdb'
```

**Important**: These files must exist at the specified paths. Download them as described in the [Installation Guide](installation.md).

### 4. Client IP Detection

Configure how to detect the real client IP (important if behind a proxy):

```yaml
detectClientIp:
  headers:
    - "x-forwarded-for"
    - "cf-connecting-ip"  # Add if using Cloudflare
```

The WAF checks headers in order. If not found, it falls back to `req.ip`.

### 5. Proxy Configuration

Set up reverse proxy to your backend:

```yaml
proxy:
  enabled: true
  host: "http://your-backend:8080"
  config: {}  # Optional http-proxy-middleware options
```

Replace `http://your-backend:8080` with your actual backend URL.

### 6. Jail System (Optional but Recommended)

Configure IP banning:

```yaml
jailManager:
  enabled: true
  storage:
    driver: memory  # Use 'memory' for testing, 'file' for production
  syncInterval: 5000
  syncAlways: false
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

### 7. Add Your First Rule

Let's add a simple rate limiting rule:

```yaml
jailManager:
  enabled: true
  storage:
    driver: memory
  filterRules:
    # Limit requests from any IP
    - id: global-rate-limit
      type: composite
      enabled: true
      keys: ["ip"]
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

### 8. Whitelist (Optional)

Allow trusted IPs to bypass all checks:

```yaml
whitelist:
  enabled: true
  ips:
    - "192.168.1.0/24"  # Local network
    - "10.0.0.1"        # Specific IP
  countries: []  # e.g., ["US", "GB"]
  cities: []
```

### 9. API Configuration (Optional)

Enable the management API:

```yaml
api:
  enabled: true
  auth:
    enabled: true
    username: "admin"
    password: "change-this-password"
```

**Security**: Always enable auth and use a strong password!

### 10. Metrics (Optional)

Enable Prometheus metrics:

```yaml
metrics:
  enabled: true
  path: '/metrics'
```

## Complete Example Configuration

Putting it all together:

```yaml
# Core settings
mode: audit
port: 3000

# Client IP detection
detectClientIp:
  headers:
    - "x-forwarded-for"

# GeoIP
geoip:
  countryPath: './GeoLite2-Country.mmdb'
  cityPath: './GeoLite2-City.mmdb'

# Proxy
proxy:
  enabled: true
  host: "http://localhost:8080"

# Logging
log:
  level: 'info'
  transport: 'console'

# Metrics
metrics:
  enabled: true
  path: '/metrics'

# API
api:
  enabled: true
  auth:
    enabled: true
    username: "admin"
    password: "secure-password-here"

# Whitelist
whitelist:
  enabled: true
  ips:
    - "127.0.0.1"
    - "192.168.1.0/24"

# Jail system
jailManager:
  enabled: true
  storage:
    driver: memory
  filterRules:
    # Global rate limit
    - id: global-rate-limit
      type: composite
      enabled: true
      keys: ["ip"]
      conditions: []
      limit: 1000
      period: 60
      duration: 300
      escalationRate: 1.5
```

## Testing Your Configuration

1. **Start the WAF**:
   ```bash
   npm start
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
   curl -u admin:secure-password-here http://localhost:3000/waf/jail-manager/baned-users
   ```

## Next Steps

Now that you have a working configuration:

- **Add more rules** - See [Filter Rules](../configuration/filter-rules.md)
- **Switch to normal mode** - When ready for production
- **Configure geolocation rules** - See [Geolocation](../configuration/geolocation.md)
- **Set up monitoring** - See [Prometheus Metrics](../monitoring/prometheus-metrics.md)

## Common Mistakes

1. **Forgetting to download GeoIP databases** - WAF will fail to start
2. **Wrong backend URL** - Requests won't be proxied correctly
3. **Starting in normal mode** - Test in audit mode first!
4. **Weak API passwords** - Always use strong, unique passwords
5. **Not configuring IP detection** - May ban wrong IPs if behind a proxy

For more help, see the [Troubleshooting Guide](../guides/troubleshooting.md).
