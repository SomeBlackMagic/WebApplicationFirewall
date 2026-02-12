# Configuration Overview

WAF configuration is managed via a YAML file (default `config.yaml` in the project root) or through environment variables that control how the configuration is loaded.

## Configuration Loading

### Default Behavior

By default, WAF loads `config.yaml` from the current working directory.

### Environment Variables

You can control configuration loading using these environment variables:

- `WAF_CONFIG_TYPE`: Source type (`file` or `link`). Default: `file`
- `WAF_CONFIG_SOURCE`: Path to the file (if `WAF_CONFIG_TYPE=file`) or URL (if `WAF_CONFIG_TYPE=link`). Default: `./config.yaml` if `WAF_CONFIG_TYPE=file`

### Loading from URL

To load configuration from a remote URL:

```bash
export WAF_CONFIG_TYPE=link
export WAF_CONFIG_SOURCE=https://example.com/waf-config.yaml
npm start
```

## Configuration Sections

The configuration file is organized into the following sections:

### Core Settings
- **[Core Parameters](core-parameters.md)** - Essential settings like mode and port
- **[Logging](logging.md)** - Log configuration
- **[Metrics](metrics.md)** - Prometheus metrics export

### Request Processing
- **[Client IP Detection](client-ip-detection.md)** - Detecting the real client IP
- **[Geolocation](geolocation.md)** - Country and city detection
- **[Static Lists](static-lists.md)** - Whitelist and Blacklist

### Filtering & Protection
- **[Jail System](jail-system.md)** - IP banning mechanism
- **[Filter Rules](filter-rules.md)** - Rule definitions

### Integration
- **[Proxy Configuration](proxy.md)** - Reverse proxy settings
- **[API Configuration](api-config.md)** - REST API settings

### Reference
- **[Environment Variables](environment-variables.md)** - All available environment variables

## Configuration Examples

Ready-to-use configuration examples are available in the [examples/](examples/) directory:

- **basic-setup.yaml** - Minimal configuration for getting started
- **production-setup.yaml** - Recommended production configuration
- **high-traffic-setup.yaml** - Optimized for high-traffic scenarios
- **strict-security.yaml** - Maximum security settings

## Quick Example

Here's a minimal configuration to get started:

```yaml
mode: normal
port: 3000

detectClientIp:
  headers: ["x-forwarded-for"]

proxy:
  enabled: true
  host: "http://your-backend:8080"

log:
  level: 'info'
  transport: 'console'

geoip:
  countryPath: './GeoLite2-Country.mmdb'
  cityPath: './GeoLite2-City.mmdb'
```

## Validation

WAF validates the configuration on startup. If there are errors, they will be logged and the application will exit. Common validation errors:

- Missing required fields
- Invalid file paths (e.g., GeoIP databases not found)
- Invalid enum values (e.g., invalid `mode`)
- Type mismatches

## Next Steps

- Review [Core Parameters](core-parameters.md) to understand essential settings
- Learn about [Filter Rules](filter-rules.md) to set up request filtering
- Check [Configuration Examples](examples/) for complete setups
