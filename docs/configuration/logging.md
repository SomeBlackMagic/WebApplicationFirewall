# Logging Configuration

The WAF uses `@elementary-lab/logger` for structured logging. This document covers log configuration.

## Basic Configuration

```yaml
log:
  level: 'info'
  transport: 'console'
  transportConfig: {}
```

### Fields

- **level**: Logging level (see [Log Levels](#log-levels))
- **transport**: Output destination (currently only `console` supported)
- **transportConfig**: Transport-specific configuration (optional)

**Note**: Logging configuration is only available via YAML (cannot be set via environment variables).

## Log Levels

The following log levels are available, from most verbose to least:

### trace

**Most verbose**. Includes all log messages including detailed trace information.

```yaml
log:
  level: 'trace'
```

**Output example**:
```
[TRACE] Checking whitelist for IP: 1.2.3.4
[TRACE] IP not in whitelist
[TRACE] Checking blacklist for IP: 1.2.3.4
[TRACE] IP not in blacklist
[DEBUG] Evaluating rule: rate-limit
[INFO] Request from IP: 1.2.3.4
```

**Use for**: Deep debugging, development only (very noisy).

### debug

Includes debug information about internal operations.

```yaml
log:
  level: 'debug'
```

**Output example**:
```
[DEBUG] Detected client IP: 1.2.3.4 from header: x-forwarded-for
[DEBUG] GeoIP lookup: 1.2.3.4 → US, New York
[DEBUG] Evaluating rule: login-bruteforce
[INFO] Request from IP: 1.2.3.4
```

**Use for**: Development, troubleshooting.

### info (Recommended)

Standard informational messages about normal operation.

```yaml
log:
  level: 'info'
```

**Output example**:
```
[INFO] WAF starting in normal mode
[INFO] GeoIP databases loaded successfully
[INFO] Server listening on port 3000
[INFO] Request from IP: 1.2.3.4
[INFO] IP 1.2.3.4 banned by rule 'rate-limit' for 300 seconds
```

**Use for**: Production (default recommendation).

### warn

Warnings about potentially problematic situations.

```yaml
log:
  level: 'warn'
```

**Output example**:
```
[WARN] IP 1.2.3.4 matched blacklist, request blocked
[WARN] Failed to fetch blocklist from https://example.com/list.json
[WARN] API authentication failed
```

**Use for**: Production if you want less verbose output.

### error

Error messages only. Does not include warnings or info.

```yaml
log:
  level: 'error'
```

**Output example**:
```
[ERROR] GeoIP database not found: ./GeoLite2-Country.mmdb
[ERROR] Failed to write ban file: Permission denied
[ERROR] Backend connection error: ECONNREFUSED
```

**Use for**: Production if you only want to see errors.

### fatal

Only fatal errors that cause the application to exit.

```yaml
log:
  level: 'fatal'
```

**Output example**:
```
[FATAL] Configuration file not found: config.yaml
[FATAL] Invalid configuration: mode must be 'audit' or 'normal'
```

**Use for**: Very quiet logging (not recommended for production).

## Log Format

Logs are output in a structured format:

```
[LEVEL] Message key=value key2=value2
```

**Example**:
```
[INFO] Request processed ip=1.2.3.4 country=US method=GET url=/api/users status=200 duration=45ms
```

This format is easy to parse for log aggregation tools.

## Transport Configuration

Currently, only `console` transport is supported.

```yaml
log:
  transport: 'console'
  transportConfig:
    colorize: true  # Enable colors (if supported)
```

### Console Transport

Logs to stdout/stderr.

```yaml
log:
  level: 'info'
  transport: 'console'
  transportConfig: {}
```

**Best practice**: Redirect stdout to a file or log aggregation system:

```bash
# Redirect to file
npm start > /var/log/waf/waf.log 2>&1

# Redirect to syslog
npm start 2>&1 | logger -t waf

# Use with Docker
docker logs waf > waf.log
```

## Log Content

### Startup Logs

```
[INFO] WAF starting in normal mode
[INFO] Loading configuration from ./config.yaml
[INFO] GeoIP databases loaded successfully
[INFO] Jail storage initialized: file (/app/data/blocked_ips.json)
[INFO] Loaded 5 filter rules
[INFO] API enabled on /waf
[INFO] Metrics enabled on /metrics
[INFO] Server listening on port 3000
```

### Request Logs

```
[INFO] Request from IP: 1.2.3.4 country=US url=/api/users method=GET
```

### Rule Trigger Logs

```
[INFO] Rule 'login-bruteforce' triggered for IP 1.2.3.4
[INFO] IP 1.2.3.4 banned by rule 'login-bruteforce' for 900 seconds
```

### Ban/Unban Logs

```
[INFO] IP 1.2.3.4 banned for 300 seconds escalation_count=0
[INFO] IP 1.2.3.4 automatically unbanned (duration expired)
[INFO] IP 1.2.3.4 manually unbanned via API by admin
```

### Error Logs

```
[ERROR] Failed to fetch blocklist from https://example.com/list.json: ENOTFOUND
[ERROR] GeoIP lookup failed for IP 1.2.3.4: Database not loaded
[ERROR] Ban file write failed: EACCES /app/data/blocked_ips.json
```

## Audit Mode Logging

In `audit` mode, additional logging shows what WOULD happen:

```yaml
mode: audit
log:
  level: 'info'
```

**Output**:
```
[INFO] [AUDIT] Rule 'rate-limit' would block IP 1.2.3.4
[INFO] [AUDIT] Would ban IP 1.2.3.4 for 300 seconds
[INFO] [AUDIT] Request allowed (audit mode, would have been blocked)
```

## Log Aggregation

### Logging to Files

**Systemd service**:

```ini
[Service]
StandardOutput=append:/var/log/waf/waf.log
StandardError=append:/var/log/waf/waf-error.log
```

**Docker**:

```yaml
# docker-compose.yml
services:
  waf:
    image: waf:latest
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
```

### Syslog Integration

Forward logs to syslog:

```bash
npm start 2>&1 | logger -t waf -p local0.info
```

### ELK Stack (Elasticsearch, Logstash, Kibana)

Parse structured logs in Logstash:

```ruby
# logstash.conf
filter {
  grok {
    match => { "message" => "\[%{LOGLEVEL:level}\] %{GREEDYDATA:message}" }
  }
  kv {
    source => "message"
  }
}
```

### Splunk

Forward Docker logs to Splunk:

```bash
docker run --log-driver=splunk \
  --log-opt splunk-url=https://splunk:8088 \
  --log-opt splunk-token=your-token \
  waf:latest
```

## Log Rotation

### Using logrotate

```bash
# /etc/logrotate.d/waf
/var/log/waf/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 waf waf
    sharedscripts
    postrotate
        systemctl reload waf || true
    endscript
}
```

### Docker Logs

Docker automatically limits log size:

```yaml
# docker-compose.yml
logging:
  options:
    max-size: "100m"
    max-file: "10"
```

## Sensitive Data

**Important**: Logs may contain sensitive information.

### Potentially Sensitive Data in Logs

- Client IPs (PII in some jurisdictions)
- Request URLs (may contain tokens, session IDs)
- User agents (fingerprinting data)

### Best Practices

1. **Secure log storage** - Restrict access to log files
2. **Encrypt logs at rest** - If logs contain PII
3. **Retention policy** - Delete old logs (e.g., 30-90 days)
4. **GDPR compliance** - Consider IP address as PII
5. **Don't log passwords** - WAF doesn't log sensitive headers by default

## Performance Considerations

### Log Level Impact

- **trace/debug**: High I/O overhead (~10-20% performance impact)
- **info**: Moderate overhead (~2-5% impact)
- **warn/error**: Minimal overhead (<1% impact)

**Recommendation**: Use `info` in production. Use `debug` only for troubleshooting.

### Asynchronous Logging

Logs are written asynchronously to minimize performance impact.

## Debugging with Logs

### Enable Debug Logging

```yaml
log:
  level: 'debug'
```

Restart WAF and observe detailed output.

### Trace Specific Issues

**IP detection issues**:
```
[DEBUG] Detected client IP: 1.2.3.4 from header: x-forwarded-for
```

**Rule evaluation**:
```
[DEBUG] Evaluating rule: login-bruteforce
[DEBUG] Rule conditions: url=/login, method=POST
[DEBUG] Request matches conditions: true
[DEBUG] Current count for IP 1.2.3.4: 4/5
```

**GeoIP lookups**:
```
[DEBUG] GeoIP lookup: 1.2.3.4 → country=US, city=New York
```

### Temporarily Increase Log Level

```bash
# Edit config
vim config.yaml
# Change level to 'debug'

# Restart WAF
systemctl restart waf

# Watch logs
tail -f /var/log/waf/waf.log

# After debugging, change back to 'info' and restart
```

## Troubleshooting

### No logs appearing

**Cause**: Logs redirected or suppressed.

**Solution**: Check systemd service or Docker logging configuration.

### Too many logs

**Cause**: Log level too verbose.

**Solution**: Change to `info` or `warn`:
```yaml
log:
  level: 'warn'
```

### Logs missing request details

**Cause**: Log level too high.

**Solution**: Lower to `info` or `debug`.

### Disk filling up

**Cause**: No log rotation.

**Solution**: Implement log rotation (see [Log Rotation](#log-rotation)).

## Example Configurations

### Development

```yaml
log:
  level: 'debug'
  transport: 'console'
```

### Production (Moderate)

```yaml
log:
  level: 'info'
  transport: 'console'
```

### Production (Quiet)

```yaml
log:
  level: 'warn'
  transport: 'console'
```

### Troubleshooting

```yaml
log:
  level: 'trace'
  transport: 'console'
```

## Related Configuration

- [Core Parameters](core-parameters.md) - Mode and other settings
- [Sentry Integration](core-parameters.md#sentry-optional) - Error tracking
- [Monitoring](../monitoring/logging-integration.md) - Log aggregation
