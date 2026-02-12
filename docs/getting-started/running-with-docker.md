# Running with Docker

This guide explains how to run the WAF using Docker, both for development and production environments.

## Docker Images

The project includes two Dockerfiles:

- **`.docker/dev.Dockerfile`** - Development image with `ts-node-dev` for hot-reloading
- **`.docker/prod.Dockerfile`** - Production image with compiled JavaScript

## Quick Start with Docker

### Option 1: Using Pre-built Image

Pull and run the latest image from GitHub Container Registry:

```bash
docker pull ghcr.io/someblackmagic/web-application-firewall:latest

docker run -d --name waf \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/geoip_data:/app/geoip_data \
  ghcr.io/someblackmagic/web-application-firewall:latest
```

### Option 2: Building Locally

Build the production image:

```bash
docker build -t my-waf -f .docker/prod.Dockerfile .
```

Run the container:

```bash
docker run -d --name waf \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/geoip_data:/app/geoip_data \
  my-waf
```

## Production Deployment

### 1. Prepare Configuration and Data

Create necessary directories and files on the host:

```bash
# Create directories
mkdir -p config geoip_data data

# Copy configuration
cp config.example.yaml config/config.yaml

# Download GeoIP databases
cd geoip_data
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb
cd ..
```

### 2. Update Configuration

Edit `config/config.yaml` to use container paths:

```yaml
geoip:
  countryPath: '/app/geoip_data/GeoLite2-Country.mmdb'
  cityPath: '/app/geoip_data/GeoLite2-City.mmdb'

jailManager:
  storage:
    driver: file
    driverConfig:
      filePath: '/app/data/blocked_ips.json'
```

### 3. Run Production Container

```bash
docker run -d \
  --name waf \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/config/config.yaml:/app/config.yaml:ro \
  -v $(pwd)/geoip_data:/app/geoip_data:ro \
  -v $(pwd)/data:/app/data \
  ghcr.io/someblackmagic/web-application-firewall:latest
```

**Volume explanations:**
- `/app/config.yaml` - Configuration file (read-only)
- `/app/geoip_data` - GeoIP databases (read-only)
- `/app/data` - Persistent storage for banned IPs (read-write)

## Development with Docker

For development with automatic reloading:

```bash
# Build dev image
docker build -t waf-dev -f .docker/dev.Dockerfile .

# Run with source code mounted
docker run -it --rm \
  --name waf-dev \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/geoip_data:/app/geoip_data \
  -v $(pwd)/src:/app/src \
  waf-dev
```

Code changes in `src/` will automatically reload the application.

## Docker Compose

For easier management, use Docker Compose. See [Docker Compose Guide](../deployment/docker-compose.md) for details.

## Environment Variables

You can override configuration using environment variables:

```bash
docker run -d \
  --name waf \
  -p 3000:3000 \
  -e WAF_CONFIG_TYPE=link \
  -e WAF_CONFIG_SOURCE=https://example.com/config.yaml \
  -e SENTRY_DSN=your-sentry-dsn \
  -v $(pwd)/geoip_data:/app/geoip_data \
  ghcr.io/someblackmagic/web-application-firewall:latest
```

Available environment variables:
- `WAF_CONFIG_TYPE` - Configuration source type (`file` or `link`)
- `WAF_CONFIG_SOURCE` - Path or URL to configuration
- `SENTRY_DSN` - Sentry error tracking DSN
- `APP_VERSION` - Application version tag

For complete list, see [Environment Variables](../configuration/environment-variables.md).

## Health Checks

Docker health check example:

```bash
docker run -d \
  --name waf \
  --health-cmd="curl -f http://localhost:3000/waf/healthz || exit 1" \
  --health-interval=30s \
  --health-timeout=3s \
  --health-retries=3 \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/geoip_data:/app/geoip_data \
  ghcr.io/someblackmagic/web-application-firewall:latest
```

Check health status:

```bash
docker ps
# Look for "healthy" in STATUS column
```

## Viewing Logs

```bash
# Follow logs
docker logs -f waf

# View last 100 lines
docker logs --tail 100 waf

# View logs since 10 minutes ago
docker logs --since 10m waf
```

## Updating the Container

```bash
# Pull latest image
docker pull ghcr.io/someblackmagic/web-application-firewall:latest

# Stop and remove old container
docker stop waf
docker rm waf

# Start new container
docker run -d \
  --name waf \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/config/config.yaml:/app/config.yaml:ro \
  -v $(pwd)/geoip_data:/app/geoip_data:ro \
  -v $(pwd)/data:/app/data \
  ghcr.io/someblackmagic/web-application-firewall:latest
```

## Resource Limits

Limit container resources:

```bash
docker run -d \
  --name waf \
  --memory="2g" \
  --cpus="2.0" \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/geoip_data:/app/geoip_data \
  ghcr.io/someblackmagic/web-application-firewall:latest
```

## Troubleshooting

### Container exits immediately

Check logs:
```bash
docker logs waf
```

Common issues:
- Configuration file not found or invalid
- GeoIP databases not mounted or not found
- Port 3000 already in use on host

### Permission issues with volumes

Ensure files are readable:
```bash
chmod 644 config.yaml
chmod 644 geoip_data/*.mmdb
chmod 755 data
```

### Container can't connect to backend

If your backend is on the host machine:
- On Linux: Use `host.docker.internal` or `172.17.0.1`
- On Mac/Windows: Use `host.docker.internal`

```yaml
proxy:
  enabled: true
  host: "http://host.docker.internal:8080"
```

Or use Docker networking:
```bash
docker network create waf-network
docker run --network waf-network --name backend your-backend
docker run --network waf-network --name waf -p 3000:3000 ...
```

Then configure:
```yaml
proxy:
  enabled: true
  host: "http://backend:8080"
```

## Next Steps

- [Docker Compose](../deployment/docker-compose.md) - Multi-container setup
- [Kubernetes](../deployment/kubernetes.md) - Kubernetes deployment
- [High Availability](../deployment/high-availability.md) - HA configuration
