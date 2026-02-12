# Core Parameters

This document describes the essential configuration parameters for the WAF.

## mode

**Type**: `string`
**Values**: `audit` | `normal`
**Default**: `audit`

The WAF operating mode:

- **`audit`**: Logs rule violations but doesn't block requests. Ideal for testing rule configurations without affecting users.
- **`normal`**: Actively blocks requests that violate rules. Use in production after testing rules in audit mode.

```yaml
mode: normal
```

**Recommendation**: Always test new rules in `audit` mode first to avoid accidentally blocking legitimate traffic.

## port

**Type**: `number`
**Default**: `3000`
**Cannot be changed via environment variables**

The port on which the WAF server listens.

```yaml
port: 3000
```

**Note**: If running multiple WAF instances on the same host, each must use a different port.

## geoip

**Type**: `object`
**Required**
**Cannot be configured via environment variables**

Paths to MaxMind GeoIP2 database files for geolocation.

### geoip.countryPath

**Type**: `string`
**Required**

Path to the `GeoLite2-Country.mmdb` database file.

```yaml
geoip:
  countryPath: './GeoLite2-Country.mmdb'
```

### geoip.cityPath

**Type**: `string`
**Required**

Path to the `GeoLite2-City.mmdb` database file.

```yaml
geoip:
  cityPath: './GeoLite2-City.mmdb'
```

**Example with custom path**:

```yaml
geoip:
  countryPath: '/opt/geoip/GeoLite2-Country.mmdb'
  cityPath: '/opt/geoip/GeoLite2-City.mmdb'
```

**Important Notes**:
- These files must exist at the specified paths
- WAF will fail to start if files are missing or invalid
- Download from [MaxMind](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) or [P3TERX/GeoLite.mmdb](https://github.com/P3TERX/GeoLite.mmdb)

## sentry (Optional)

**Type**: `object`

Sentry error tracking integration.

### sentry.dsn

**Type**: `string`
**Can also be set via `SENTRY_DSN` environment variable**

Sentry DSN (Data Source Name) for error reporting.

```yaml
sentry:
  dsn: "https://your-sentry-dsn@sentry.io/project-id"
```

**Via environment variable**:

```bash
export SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
```

The environment variable takes precedence over the YAML configuration.

## Complete Example

```yaml
# Operating mode
mode: normal

# Server port
port: 3000

# GeoIP databases
geoip:
  countryPath: './geoip_data/GeoLite2-Country.mmdb'
  cityPath: './geoip_data/GeoLite2-City.mmdb'

# Sentry integration (optional)
sentry:
  dsn: "https://your-sentry-dsn@sentry.io/project-id"
```

## Mode Comparison

| Aspect | Audit Mode | Normal Mode |
|--------|------------|-------------|
| **Blocks Requests** | No | Yes |
| **Logs Violations** | Yes | Yes |
| **Adds to Jail** | No | Yes |
| **Use Case** | Testing, Development | Production |
| **Safety** | Safe, no impact | Can block legitimate users if misconfigured |

## Best Practices

1. **Start with Audit Mode**: Always test your configuration in `audit` mode first
2. **Monitor Logs**: Review logs in audit mode to identify false positives
3. **Gradual Rollout**: Switch to normal mode gradually, monitoring for issues
4. **Keep GeoIP Updated**: Regularly update GeoIP databases for accuracy
5. **Use Sentry**: Enable Sentry in production to track errors

## Troubleshooting

### WAF fails to start with GeoIP error

```
Error: ENOENT: no such file or directory, open './GeoLite2-Country.mmdb'
```

**Solution**: Ensure GeoIP database files exist at the specified paths:

```bash
ls -lh GeoLite2-Country.mmdb GeoLite2-City.mmdb
```

Download them if missing (see [Installation](../getting-started/installation.md)).

### Port already in use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**: Change the port in configuration or stop the service using port 3000:

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process (replace PID)
kill -9 PID
```

### Sentry not receiving events

- Verify DSN is correct
- Check network connectivity to Sentry
- Ensure errors are actually occurring (Sentry only reports errors)

## Related Configuration

- [Logging](logging.md) - Configure application logging
- [Metrics](metrics.md) - Enable Prometheus metrics
- [Environment Variables](environment-variables.md) - Environment-based configuration
