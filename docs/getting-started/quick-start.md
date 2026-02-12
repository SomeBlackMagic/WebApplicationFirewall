# Quick Start

Get the WAF up and running in just a few minutes using Docker.

## Prerequisites

- **Docker** installed (for Option 1)
- Downloaded GeoIP databases (see below)
- A backend service to protect

## Step 1: Download GeoIP Databases

Download the required GeoIP databases:

```bash
# Create directory
mkdir -p geoip_data && cd geoip_data

# Download databases
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb

cd ..
```

## Step 2: Create Configuration

Create your configuration file:

```bash
# Create config.yaml
cat > config.yaml <<'EOF'
proxy:
  host: "http://localhost:8080"  # Change to your backend URL

api:
  auth:
    enabled: false
    username: 'admin'
    password: 'admin'

metrics:
  enabled: true
  auth:
    enabled: false
    username: 'admin'
    password: 'admin'

wafMiddleware:
  mode: audit  # Use 'audit' for testing, 'normal' for production

  detectClientIp:
    headers:
      - "x-forwarded-for"

  detectClientCountry:
    method: geoip

  detectClientCity:
    method: geoip

jailManager:
  enabled: true
  storage:
    driver: memory
  filterRules:
    - name: "global-rate-limit"
      type: "composite"
      uniqueClientKey: ["ip"]
      conditions: []
      period: 60
      limit: 100
      duration: 300
      escalationRate: 1.5

sentry:
  enabled: false
  dsn: ''
  debug: false
EOF
```

**Note**: See [Configuration Examples](../configuration/examples/) for production-ready configurations.

## Step 3: Choose Your Deployment Method

### Option 1: Docker (Recommended)

The easiest way to run WAF is using Docker:

```bash
# Pull latest image
docker pull ghcr.io/someblackmagic/web-application-firewall:latest

# Create data directory
mkdir -p data

# Run WAF
docker run -d \
  --name waf \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -v $(pwd)/geoip_data:/app/geoip_data:ro \
  -v $(pwd)/data:/app/data \
  ghcr.io/someblackmagic/web-application-firewall:latest

# Check logs
docker logs -f waf
```

You should see output similar to:

```
[INFO] WAF starting in audit mode
[INFO] GeoIP databases loaded successfully
[INFO] Server listening on port 3000
```

See [Running with Docker](running-with-docker.md) for more details.

### Option 2: Binary from GitHub Releases

Download pre-built binaries from GitHub releases:

```bash
# Download latest release (Linux x64 example)
wget https://github.com/SomeBlackMagic/WebApplicationFirewall/releases/latest/download/waf-linux-x64
chmod +x waf-linux-x64

# Run
./waf-linux-x64
```

**Note**: Check [Releases page](https://github.com/SomeBlackMagic/WebApplicationFirewall/releases) for available platforms (Linux, macOS, Windows).

### Option 3: From Source (For Developers)

For development and testing:

```bash
# Clone repository
git clone https://github.com/SomeBlackMagic/WebApplicationFirewall.git
cd WebApplicationFirewall

# Install dependencies
npm install

# Copy config
cp config.example.yaml config.yaml

# Download GeoIP databases to project root
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb

# Run
npm start
```

See [Development Setup](../development/setup.md) for detailed instructions.

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

The request should be proxied to your backend.

### Check logs

**For Docker**:
```bash
docker logs waf
```

**For binary/source**:
Check console output

In `audit` mode, the WAF logs all activity but doesn't block requests.

## Step 5: Add Your First Rule

Let's add a simple rate limiting rule. Edit `config.yaml`:

```yaml
jailManager:
  enabled: true
  storage:
    driver: memory
  filterRules:
    - name: "test-rate-limit"
      type: "composite"
      uniqueClientKey: ["ip"]
      conditions: []  # Applies to all requests
      period: 60      # 60 seconds
      limit: 100      # 100 requests per period
      duration: 300   # Ban for 5 minutes
      escalationRate: 1.5
```

### Restart WAF

**For Docker**:
```bash
docker restart waf
```

**For binary**:
Press Ctrl+C and restart: `./waf-linux-x64`

**For source**:
Press Ctrl+C and restart: `npm start`

## Step 6: Switch to Normal Mode

Once you've tested and are satisfied with the configuration, switch to `normal` mode:

Edit `config.yaml`:
```yaml
wafMiddleware:
  mode: normal
```

Restart the WAF. Now it will actively block requests that violate rules.

**For Docker**:
```bash
docker restart waf
```

## Step 7: Test Rate Limiting

Send multiple requests to trigger the rate limit:

```bash
# Send 110 requests (exceeds limit of 100)
for i in {1..110}; do curl -s http://localhost:3000/ > /dev/null && echo "Request $i"; done
```

After 100 requests, you should see 429 responses (Too Many Requests).

## What's Next?

Now that you have the WAF running:

- **Add more rules** - See [Filter Rules](../configuration/filter-rules.md)
- **Configure whitelisting** - See [Static Lists](../configuration/static-lists.md)
- **Set up monitoring** - See [Prometheus Metrics](../monitoring/prometheus-metrics.md)
- **Deploy to production** - See [Docker Compose](../deployment/docker-compose.md)
- **Enable the API** - See [API Configuration](../configuration/api-config.md)

## Production Deployment

For production, use:
- **Docker Compose** - [Docker Compose Guide](../deployment/docker-compose.md)
- **File-based storage** - For persistent bans
- **Strong API passwords** - If enabling the API
- **Normal mode** - After testing in audit mode

**Example production Docker command**:

```bash
docker run -d \
  --name waf \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -v $(pwd)/geoip_data:/app/geoip_data:ro \
  -v $(pwd)/data:/app/data \
  -e SENTRY_DSN=your-sentry-dsn \
  ghcr.io/someblackmagic/web-application-firewall:latest
```

## Common Issues

### Port already in use

If port 3000 is already in use:

**For Docker**:
```bash
docker run -d \
  --name waf \
  -p 3001:3000 \  # Map to different host port
  ...
```

### Backend not responding

Ensure your backend service is running and accessible:

```bash
# Test backend directly
curl http://localhost:8080/

# For Docker, use host.docker.internal instead of localhost
# Update config.yaml:
# proxy:
#   host: "http://host.docker.internal:8080"
```

### GeoIP database errors

Verify that database files exist:

```bash
ls -lh geoip_data/*.mmdb
```

If missing, download them again (see Step 1).

### Docker can't access backend on host

**On Linux**: Use `172.17.0.1` (Docker bridge IP) instead of `localhost`
**On Mac/Windows**: Use `host.docker.internal` instead of `localhost`

```yaml
proxy:
  host: "http://host.docker.internal:8080"
```

For more troubleshooting, see the [Troubleshooting Guide](../guides/troubleshooting.md).

## Next Steps

- [Configuration Overview](../configuration/README.md) - Learn about all configuration options
- [Docker Deployment](running-with-docker.md) - Detailed Docker instructions
- [First Configuration](first-configuration.md) - Step-by-step configuration guide
