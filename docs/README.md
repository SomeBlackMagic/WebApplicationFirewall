# WebApplicationFirewall Documentation

Welcome to the comprehensive documentation for the Web Application Firewall (WAF) project. This documentation is organized into several sections to help you quickly find the information you need.

## 📚 Documentation Structure

### [Getting Started](getting-started/)
Everything you need to get up and running quickly:
- [Installation](getting-started/installation.md) - System requirements and installation steps
- [Quick Start](getting-started/quick-start.md) - Get WAF running in minutes
- [Running with Docker](getting-started/running-with-docker.md) - Docker deployment guide
- [First Configuration](getting-started/first-configuration.md) - Basic configuration walkthrough

### [Configuration](configuration/)
Detailed configuration reference:
- [Configuration Overview](configuration/README.md) - How configuration works
- [Core Parameters](configuration/core-parameters.md) - Essential settings
- [Client IP Detection](configuration/client-ip-detection.md) - Detecting real client IPs
- [Geolocation](configuration/geolocation.md) - Country and city detection
- [Jail System](configuration/jail-system.md) - IP banning configuration
- [Filter Rules](configuration/filter-rules.md) - Static, Flexible, and Composite rules
- [Static Lists](configuration/static-lists.md) - Whitelist and Blacklist setup
- [Proxy Configuration](configuration/proxy.md) - Reverse proxy settings
- [API Configuration](configuration/api-config.md) - REST API setup
- [Logging](configuration/logging.md) - Log configuration
- [Metrics](configuration/metrics.md) - Prometheus metrics setup
- [Environment Variables](configuration/environment-variables.md) - Environment-based configuration
- [Configuration Examples](configuration/examples/) - Ready-to-use configuration files

### [Architecture](architecture/)
Understanding how WAF works:
- [Overview](architecture/overview.md) - High-level architecture
- [Request Flow](architecture/request-flow.md) - How requests are processed
- [Components](architecture/components.md) - Key components and their roles
- [Under Attack Module](architecture/under-attack-module.md) - Bot detection and fingerprinting

### [Core Concepts](concepts/)
Fundamental concepts explained:
- [Operating Modes](concepts/operating-modes.md) - Normal vs Audit mode
- [Jail Mechanism](concepts/jail-mechanism.md) - How IP banning works
- [Ban Escalation](concepts/ban-escalation.md) - Progressive ban duration
- [Rule Types](concepts/rule-types.md) - Static, Flexible, and Composite rules
- [Geolocation Detection](concepts/geolocation-detection.md) - GeoIP databases

### [API Reference](api/)
REST API documentation:
- [API Overview](api/README.md) - Introduction to the API
- [Authentication](api/authentication.md) - API authentication
- [Endpoints](api/endpoints.md) - Available endpoints
- [Examples](api/examples.md) - API usage examples

### [Deployment](deployment/)
Production deployment guides:
- [Docker](deployment/docker.md) - Docker deployment
- [Docker Compose](deployment/docker-compose.md) - Multi-container setup
- [Kubernetes](deployment/kubernetes.md) - Kubernetes deployment
- [Systemd Service](deployment/systemd-service.md) - Running as a system service
- [Reverse Proxy](deployment/reverse-proxy.md) - Behind Nginx/Apache
- [High Availability](deployment/high-availability.md) - HA setup

### [Monitoring](monitoring/)
Observability and monitoring:
- [Prometheus Metrics](monitoring/prometheus-metrics.md) - Available metrics
- [Grafana Dashboard](monitoring/grafana-dashboard.md) - Dashboard setup
- [Alerting](monitoring/alerting.md) - Alert configuration
- [Logging Integration](monitoring/logging-integration.md) - Log aggregation

### [Development](development/)
For contributors and developers:
- [Development Setup](development/setup.md) - Setting up development environment
- [Testing](development/testing.md) - Running tests
- [Building](development/building.md) - Build process
- [Project Structure](development/project-structure.md) - Code organization
- [Code Style](development/code-style.md) - Coding standards
- [Contributing](development/contributing.md) - How to contribute

### [Guides](guides/)
Practical guides and best practices:
- [Troubleshooting](guides/troubleshooting.md) - Common issues and solutions
- [Use Cases](guides/use-cases.md) - Practical scenarios and examples
- [Performance Tuning](guides/performance-tuning.md) - Optimization strategies
- [Security Best Practices](guides/security-best-practices.md) - Hardening guide
- [Migration Guide](guides/migration-guide.md) - Upgrading between versions

## 🚀 Quick Links

- **New to WAF?** Start with [Quick Start Guide](getting-started/quick-start.md)
- **Need to configure rules?** See [Filter Rules](configuration/filter-rules.md)
- **Having issues?** Check [Troubleshooting](guides/troubleshooting.md)
- **Want to contribute?** Read [Contributing Guide](development/contributing.md)
- **Performance problems?** See [Performance Tuning](guides/performance-tuning.md)

## 📖 Additional Resources

- [Load Testing Results](LoadTesting/LoadTest.md)
- [Grafana Dashboard JSON](waf_grafana_dashboard.json)
- [Systemd Service File](waf.service)

## 💬 Getting Help

If you can't find what you're looking for:

1. Check the [Troubleshooting Guide](guides/troubleshooting.md)
2. Search through existing [GitHub Issues](https://github.com/SomeBlackMagic/WebApplicationFirewall/issues)
3. Create a new issue with details about your problem

## 📝 Contributing to Documentation

Found a typo or want to improve the docs? Contributions are welcome! See our [Contributing Guide](development/contributing.md) for details on how to submit improvements.

---

**Version**: Latest
**Last Updated**: 2026-02-12
**License**: [GNU License](../LICENSE)
