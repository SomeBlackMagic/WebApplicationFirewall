# Quick Start

Get the WAF up and running in just a few minutes.

## Prerequisites

Before starting, ensure you have:

- Node.js 22+ installed
- Downloaded GeoIP databases (see [Installation](installation.md))
- Cloned the repository and installed dependencies

## Step 1: Create Configuration

Create your configuration file from the example:

```bash
cp config.example.yaml config.yaml
```

## Step 2: Update Configuration

Edit `config.yaml` with your basic settings:

```yaml
# Operating mode
mode: audit  # Use 'audit' for testing, 'normal' for production

# Server port
port: 3000

# Client IP detection
detectClientIp:
  headers: ["x-forwarded-for", "cf-connecting-ip"]

# GeoIP databases (update paths if needed)
geoip:
  countryPath: './GeoLite2-Country.mmdb'
  cityPath: './GeoLite2-City.mmdb'

# Backend proxy (update with your backend URL)
proxy:
  enabled: true
  host: "http://localhost:8080"  # Change to your backend

# Logging
log:
  level: 'info'
  transport: 'console'

# Basic jail configuration
jailManager:
  enabled: true
  storage:
    driver: memory  # Use 'memory' for testing, 'file' for production
  filterRules: []  # Start with no rules

# Whitelist (optional)
whitelist:
  enabled: false

# Blacklist (optional)
blacklist:
  enabled: false
```

## Step 3: Start the WAF

Run the application:

```bash
npm install
node ./node_modules/.bin/ts-node src/main.ts
```

You should see output similar to:

```
[INFO] WAF starting in audit mode
[INFO] GeoIP databases loaded successfully
[INFO] Server listening on port 3000
```

## Step 4: Test the WAF

### Test health endpoint

```bash
curl http://localhost:3000/waf/healthz
```

Expected response:
```
Hello from WAF server!
```

### Test proxying

Send a request through the WAF to your backend:

```bash
curl http://localhost:3000/
```

The request should be proxied to your backend at `http://localhost:8080/`.

### Check logs

In `audit` mode, the WAF logs all activity but doesn't block requests. Check the console output to see requests being processed.

## Step 5: Add Your First Rule

Let's add a simple rate limiting rule. Edit `config.yaml`:

```yaml
jailManager:
  enabled: true
  storage:
    driver: memory
  filterRules:
    - id: test-rate-limit
      type: composite
      enabled: true
      keys: ["ip"]
      conditions: []  # Applies to all requests
      limit: 100
      period: 60  # 100 requests per 60 seconds
      duration: 300  # Ban for 5 minutes
      escalationRate: 1.5
```

Restart the WAF to apply the changes.

## Step 6: Switch to Normal Mode

Once you've tested and are satisfied with the configuration, switch to `normal` mode:

```yaml
mode: normal
```

Restart the WAF. Now it will actively block requests that violate rules.

## What's Next?

Now that you have the WAF running:

- **Add more rules** - See [Filter Rules](../configuration/filter-rules.md)
- **Configure whitelisting** - See [Static Lists](../configuration/static-lists.md)
- **Set up monitoring** - See [Prometheus Metrics](../monitoring/prometheus-metrics.md)
- **Deploy to production** - See [Deployment Guide](../deployment/docker.md)
- **Enable the API** - See [API Configuration](../configuration/api-config.md)

## Quick Start with Docker

If you prefer using Docker, see the [Running with Docker](running-with-docker.md) guide.

## Common Issues

### Port already in use

If port 3000 is already in use, change it in `config.yaml`:

```yaml
port: 3001  # Or any available port
```

### Backend not responding

Ensure your backend service is running and accessible at the configured `proxy.host` URL.

### GeoIP database errors

Verify that the database files exist and paths in `config.yaml` are correct:

```bash
ls -lh *.mmdb
```

For more troubleshooting, see the [Troubleshooting Guide](../guides/troubleshooting.md).
