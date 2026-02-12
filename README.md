# Web Application Firewall (WAF) 🛡️

![Build App](https://github.com/SomeBlackMagic/WebApplicationFirewall/actions/workflows/build.yaml/badge.svg)
[![codecov](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall/graph/badge.svg?token=045DKMM46F)](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall)
[![Github Repo Size](https://img.shields.io/github/repo-size/SomeBlackMagic/WebApplicationFirewall.svg)](https://github.com/SomeBlackMagic/WebApplicationFirewall)
![GitHub License](https://img.shields.io/github/license/SomeBlackMagic/WebApplicationFirewall)
![GitHub Release](https://img.shields.io/github/v/release/SomeBlackMagic/WebApplicationFirewall)

Modular and configurable Web Application Firewall (WAF) server written in TypeScript using Express.js. Protect your web applications from attacks with flexible filtering, IP banning, geolocation-based rules, and bot detection.

## ✨ Key Features

- **⚖️ Flexible Blocking Rules** - Static IP lists, behavioral filters, and request rate limiting
- **⛔ Jail System** - Temporary IP banning with progressive escalation for repeat offenders
- **✉️ Whitelist/Blacklist** - Allow or block by IP, subnet, country, or city
- **🌍 GeoIP Detection** - Country and city-based filtering using MaxMind databases
- **🤖 Bot Detection** - Advanced bot detection and browser fingerprinting (Under Attack mode)
- **🛡️ REST API** - Manage bans and monitor status via HTTP API
- **📊 Prometheus Metrics** - Export metrics for monitoring and alerting
- **💾 Flexible Storage** - In-memory or file-based ban storage
- **🔎 Audit Mode** - Test rules safely without blocking traffic
- **⚙️ Reverse Proxy** - Proxy validated requests to your backend

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22+
- **GeoIP Databases** ([Download here](https://github.com/P3TERX/GeoLite.mmdb))

### Installation

```bash
# Clone repository
git clone https://github.com/SomeBlackMagic/WebApplicationFirewall.git
cd WebApplicationFirewall

# Install dependencies
npm install

# Create configuration
cp config.example.yaml config.yaml

# Download GeoIP databases
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb
```

### Configure

Edit `config.yaml`:

```yaml
mode: audit          # Use 'audit' for testing, 'normal' for production
port: 3000

proxy:
  enabled: true
  host: "http://localhost:8080"  # Your backend URL

geoip:
  countryPath: './GeoLite2-Country.mmdb'
  cityPath: './GeoLite2-City.mmdb'

jailManager:
  enabled: true
  storage:
    driver: memory    # Use 'file' for production
  filterRules:
    - id: rate-limit
      type: composite
      enabled: true
      keys: ["ip"]
      limit: 1000
      period: 60
      duration: 300
      escalationRate: 1.5
```

### Run

```bash
npm start
```

Access at: `http://localhost:3000`

## 📚 Documentation

**Complete documentation is available in the [docs/](docs/) directory.**

### Getting Started
- [Installation Guide](docs/getting-started/installation.md)
- [Quick Start](docs/getting-started/quick-start.md)
- [Running with Docker](docs/getting-started/running-with-docker.md)
- [First Configuration](docs/getting-started/first-configuration.md)

### Configuration
- [Configuration Overview](docs/configuration/README.md)
- [Filter Rules](docs/configuration/filter-rules.md) - Define blocking rules
- [Jail System](docs/configuration/jail-system.md) - IP banning configuration
- [Static Lists](docs/configuration/static-lists.md) - Whitelist/Blacklist
- [Geolocation](docs/configuration/geolocation.md) - Country/city detection
- [Configuration Examples](docs/configuration/examples/) - Ready-to-use configs

### Architecture & Concepts
- [Architecture Overview](docs/architecture/overview.md)
- [Request Flow](docs/architecture/request-flow.md)
- [Rule Types](docs/concepts/rule-types.md)
- [Ban Escalation](docs/concepts/ban-escalation.md)

### API & Monitoring
- [API Reference](docs/api/README.md)
- [Prometheus Metrics](docs/monitoring/prometheus-metrics.md)
- [Grafana Dashboard](docs/monitoring/grafana-dashboard.md)

### Guides
- [Troubleshooting](docs/guides/troubleshooting.md)
- [Use Cases & Examples](docs/guides/use-cases.md)
- [Performance Tuning](docs/guides/performance-tuning.md)
- [Security Best Practices](docs/guides/security-best-practices.md)

### Deployment
- [Docker Deployment](docs/deployment/docker.md)
- [Docker Compose](docs/deployment/docker-compose.md)
- [High Availability](docs/deployment/high-availability.md)

### Development
- [Development Setup](docs/development/setup.md)
- [Testing](docs/development/testing.md)
- [Contributing](docs/development/contributing.md)

## 🐳 Docker

```bash
# Pull latest image
docker pull ghcr.io/someblackmagic/web-application-firewall:latest

# Run
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/geoip_data:/app/geoip_data \
  ghcr.io/someblackmagic/web-application-firewall:latest
```

See [Docker Guide](docs/deployment/docker.md) for details.

## 🤝 Contributing

We welcome contributions! Please see:
- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md) (if available)
- [Development Setup](docs/development/setup.md)

## 📄 License

This project is licensed under the [GNU License](LICENSE).

## 🔗 Links

- [GitHub Repository](https://github.com/SomeBlackMagic/WebApplicationFirewall)
- [Issue Tracker](https://github.com/SomeBlackMagic/WebApplicationFirewall/issues)
- [Releases](https://github.com/SomeBlackMagic/WebApplicationFirewall/releases)
- [Documentation](docs/)

## 💡 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/SomeBlackMagic/WebApplicationFirewall/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SomeBlackMagic/WebApplicationFirewall/discussions)

---

**Made with ❤️ by the WAF community**
