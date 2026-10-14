# Core Parameters

This document describes the essential configuration parameters for the WAF.

## port

**Type**: `number`
**Default**: `3000`

The port on which the WAF server listens.

```yaml
port: 3000
```

**Note**: If running multiple WAF instances on the same host, each must use a different port.

## geoip

**Type**: `object`
**Optional** (has defaults)
**Cannot be configured via environment variables**

Paths to MaxMind GeoIP2 database files for geolocation.

### geoip.dbCountryPath

**Type**: `string`
**Default**: `./GeoIP2-Country.mmdb`

Path to the GeoIP Country database file.

```yaml
geoip:
  dbCountryPath: './geoip_data/GeoLite2-Country.mmdb'
```

### geoip.dbCityPath

**Type**: `string`
**Default**: `./GeoIP2-City.mmdb`

Path to the GeoIP City database file.

```yaml
geoip:
  dbCityPath: './geoip_data/GeoLite2-City.mmdb'
```

**Example with custom path**:

```yaml
geoip:
  dbCountryPath: '/opt/geoip/GeoLite2-Country.mmdb'
  dbCityPath: '/opt/geoip/GeoLite2-City.mmdb'
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
Sentry DSN (Data Source Name) for error reporting.

```yaml
sentry:
  dsn: "https://your-sentry-dsn@sentry.io/project-id"
```

## Complete Example

```yaml
# GeoIP databases
geoip:
  dbCountryPath: './geoip_data/GeoLite2-Country.mmdb'
  dbCityPath: './geoip_data/GeoLite2-City.mmdb'

# Sentry integration (optional)
sentry:
  dsn: "https://your-sentry-dsn@sentry.io/project-id"
```

## Best Practices

1. **Keep GeoIP Updated**: Regularly update GeoIP databases for accuracy
2. **Use Sentry**: Enable Sentry in production to track errors

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
