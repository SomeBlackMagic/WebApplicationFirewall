# Installation

This guide covers installing the WAF on a Linux server as a production service.

## System Requirements

**Minimum:**
- Linux (x64)
- RAM: 512MB
- CPU: 1 core
- Disk: 100MB

**Recommended for production:**
- RAM: 2GB or more
- CPU: 2 cores or more
- Disk: 1GB (for logs and ban storage)

## Installation Methods

### Method 1: Binary from GitHub Releases (Recommended)

Download the pre-built binary:

```bash
# Download latest release
wget https://github.com/SomeBlackMagic/WebApplicationFirewall/releases/latest/download/waf-linux-x64
chmod +x waf-linux-x64

# Move to system path
sudo mv waf-linux-x64 /usr/local/bin/waf
```

### Method 2: Docker

```bash
docker pull ghcr.io/someblackmagic/web-application-firewall:latest
```

See [Running with Docker](running-with-docker.md) for details.

## Setup

### 1. Create Directories

```bash
sudo mkdir -p /etc/waf
sudo mkdir -p /var/lib/waf/geoip_data
sudo mkdir -p /var/lib/waf/data
```

### 2. Download GeoIP Databases

```bash
sudo wget -O /var/lib/waf/geoip_data/GeoLite2-Country.mmdb \
  https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb

sudo wget -O /var/lib/waf/geoip_data/GeoLite2-City.mmdb \
  https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb
```

You can also obtain databases from [MaxMind](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) (requires free account).

### 3. Create Configuration File

```bash
sudo cat > /etc/waf/config.yaml <<'EOF'
proxy:
  host: "http://localhost:8080"  # Change to your backend URL

geoip:
  dbCountryPath: "/var/lib/waf/geoip_data/GeoLite2-Country.mmdb"
  dbCityPath: "/var/lib/waf/geoip_data/GeoLite2-City.mmdb"

api:
  auth:
    enabled: true
    username: "admin"
    password: "CHANGE-THIS-PASSWORD"

metrics:
  enabled: true
  auth:
    enabled: false

wafMiddleware:
  mode: audit

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
    driver: file
    driverConfig:
      filePath: "/var/lib/waf/data/blocked_ips.json"
      locker:
        enabled: true
        config:
          retries: 3
  filterRules:
    - name: "global-rate-limit"
      type: "composite"
      uniqueClientKey: ["ip"]
      conditions: []
      period: 60
      limit: 1000
      duration: 300
      escalationRate: 1.5

sentry:
  enabled: false
  dsn: ''
  debug: false
EOF
```

See [Configuration Guide](../configuration/README.md) for all available options.

### 4. Create Environment File (Optional)

```bash
sudo cat > /etc/waf/env_vars <<'EOF'
WAF_CONFIG_SOURCE=/etc/waf/config.yaml
# WAF_INSTANCE_ID=waf-node-1
EOF
```

### 5. Set Up systemd Service

```bash
sudo cat > /etc/systemd/system/waf.service <<'EOF'
[Unit]
Description=WAF Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/waf
WorkingDirectory=/var/lib/waf
EnvironmentFile=/etc/waf/env_vars
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable waf
sudo systemctl start waf
```

### 6. Verify

```bash
# Check service status
sudo systemctl status waf

# Check logs
sudo journalctl -u waf -f

# Test health endpoint
curl http://localhost:3000/waf/healthz
```

Expected response:
```
Hello from WAF server!
```

## Managing the Service

```bash
# Start/stop/restart
sudo systemctl start waf
sudo systemctl stop waf
sudo systemctl restart waf

# View logs
sudo journalctl -u waf -f
sudo journalctl -u waf --since "10 minutes ago"
```

## Updating

### Binary update

```bash
sudo systemctl stop waf
sudo wget -O /usr/local/bin/waf \
  https://github.com/SomeBlackMagic/WebApplicationFirewall/releases/latest/download/waf-linux-x64
sudo chmod +x /usr/local/bin/waf
sudo systemctl start waf
```

### GeoIP database update

```bash
sudo wget -O /var/lib/waf/geoip_data/GeoLite2-Country.mmdb \
  https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
sudo wget -O /var/lib/waf/geoip_data/GeoLite2-City.mmdb \
  https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb
sudo systemctl restart waf
```

**Recommendation**: Update GeoIP databases monthly. Set up a cron job:

```bash
# /etc/cron.monthly/update-geoip
#!/bin/bash
wget -q -O /var/lib/waf/geoip_data/GeoLite2-Country.mmdb https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
wget -q -O /var/lib/waf/geoip_data/GeoLite2-City.mmdb https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb
systemctl restart waf
```

## Next Steps

- [Quick Start](quick-start.md) - Test your setup
- [First Configuration](first-configuration.md) - Detailed configuration guide
- [Running with Docker](running-with-docker.md) - Docker deployment
- For development setup, see [Development Setup](../development/setup.md)
