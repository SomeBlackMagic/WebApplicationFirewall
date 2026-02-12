# Metrics Configuration

The WAF can export metrics in Prometheus format for monitoring and alerting. This document covers metrics configuration.

## Overview

When enabled, the WAF exposes metrics at a configurable HTTP endpoint. These metrics can be scraped by Prometheus for:
- Monitoring WAF health and performance
- Tracking blocked requests
- Analyzing attack patterns
- Creating dashboards (Grafana)
- Setting up alerts

## Basic Configuration

```yaml
metrics:
  enabled: true
  path: '/metrics'
```

### Fields

- **enabled**: Enable/disable metrics collection and export
- **path**: HTTP path where metrics are exposed

**Note**: Metrics configuration is only available via YAML (cannot be set via environment variables).

## Enabling Metrics

```yaml
metrics:
  enabled: true
  path: '/metrics'
```

Access metrics:
```bash
curl http://localhost:3000/metrics
```

## Disabling Metrics

```yaml
metrics:
  enabled: false
```

When disabled, metrics are not collected and the metrics endpoint returns 404.

## Metrics Endpoint

The metrics endpoint is publicly accessible (no authentication required) to allow Prometheus to scrape it.

**URL**: `http://<waf-host>:<port><path>`

**Example**: `http://localhost:3000/metrics`

**Format**: Prometheus text format

**Example output**:

```
# HELP waf_middleware_requests_total Total number of requests processed
# TYPE waf_middleware_requests_total counter
waf_middleware_requests_total{status="allowed"} 15234
waf_middleware_requests_total{status="blocked"} 452

# HELP waf_jail_banned_ips_total Total number of IPs banned
# TYPE waf_jail_banned_ips_total counter
waf_jail_banned_ips_total{rule="rate-limit"} 125
waf_jail_banned_ips_total{rule="login-bruteforce"} 43

# HELP waf_jail_storage_size Current number of banned IPs in storage
# TYPE waf_jail_storage_size gauge
waf_jail_storage_size 38

# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 45.23

# HELP nodejs_heap_size_total_bytes Total heap size
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes 52428800
```

## Available Metrics

See [Prometheus Metrics](../monitoring/prometheus-metrics.md) for a complete list of available metrics.

**Key metrics**:

### Request Metrics

- `waf_middleware_requests_total` - Total requests (allowed/blocked)
- `waf_middleware_whitelist_matches_total` - Whitelist hits
- `waf_middleware_blacklist_matches_total` - Blacklist hits
- `http_request_duration_seconds` - Request duration histogram

### Jail Metrics

- `waf_jail_banned_ips_total` - Total bans by rule
- `waf_jail_storage_size` - Current number of banned IPs
- `waf_jail_unban_operations_total` - Unban operations

### System Metrics

- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_heap_size_total_bytes` - Node.js heap size
- `nodejs_eventloop_lag_seconds` - Event loop lag

## Custom Metrics Path

Change the metrics endpoint path:

```yaml
metrics:
  enabled: true
  path: '/internal/metrics'
```

Access at: `http://localhost:3000/internal/metrics`

**Use cases**:
- Security through obscurity (not recommended as primary security)
- Compliance with internal URL standards
- Avoid conflicts with backend metrics endpoints

## Securing Metrics Endpoint

### Option 1: Network-Level Restriction

Best practice: Restrict access via firewall/security groups.

**iptables example**:
```bash
# Allow metrics access only from Prometheus server
iptables -A INPUT -p tcp --dport 3000 -s 10.0.1.10 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

**AWS Security Group**:
```
Type: Custom TCP
Port: 3000
Source: 10.0.1.10/32 (Prometheus server)
```

### Option 2: Reverse Proxy with Auth

Use Nginx to add authentication:

```nginx
location /metrics {
    auth_basic "Metrics";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://waf:3000/metrics;
}
```

Configure Prometheus with credentials:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'waf'
    basic_auth:
      username: 'prometheus'
      password: 'secret'
    static_configs:
      - targets: ['waf.example.com:443']
```

### Option 3: Internal Network Only

Run metrics on a separate internal interface:

```yaml
# Not directly configurable in current WAF
# Use reverse proxy or firewall rules
```

## Prometheus Configuration

Configure Prometheus to scrape WAF metrics:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'waf'
    scrape_interval: 15s
    static_configs:
      - targets: ['waf-1:3000', 'waf-2:3000', 'waf-3:3000']
        labels:
          environment: 'production'
```

**For Docker**:

```yaml
scrape_configs:
  - job_name: 'waf'
    dns_sd_configs:
      - names: ['tasks.waf']  # Docker Swarm service discovery
        type: 'A'
        port: 3000
```

**For Kubernetes**:

```yaml
scrape_configs:
  - job_name: 'waf'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: waf
      - source_labels: [__meta_kubernetes_pod_ip]
        action: replace
        target_label: __address__
        replacement: ${1}:3000
```

## Grafana Integration

See [Grafana Dashboard](../monitoring/grafana-dashboard.md) for details on:
- Importing the pre-built dashboard
- Creating custom dashboards
- Visualizing metrics

## Alerting

Set up alerts in Prometheus:

```yaml
# alerts.yml
groups:
  - name: waf
    interval: 30s
    rules:
      # High number of blocked requests
      - alert: HighBlockedRequests
        expr: rate(waf_middleware_requests_total{status="blocked"}[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High number of blocked requests"
          description: "WAF is blocking {{ $value }} requests per second"

      # Many banned IPs
      - alert: ManyBannedIPs
        expr: waf_jail_storage_size > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Many IPs in jail"
          description: "{{ $value }} IPs are currently banned"

      # WAF down
      - alert: WAFDown
        expr: up{job="waf"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "WAF is down"
          description: "WAF instance {{ $labels.instance }} is not reachable"

      # High memory usage
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes{job="waf"} > 2000000000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "WAF is using {{ humanize $value }} bytes of memory"
```

## Performance Considerations

### Overhead

Metrics collection has minimal performance impact:
- CPU overhead: <1%
- Memory overhead: ~10-20MB
- No I/O overhead (metrics stored in memory)

### Cardinality

**Important**: Avoid high-cardinality labels (labels with many unique values).

**Bad** (high cardinality):
```
waf_requests_total{ip="1.2.3.4"}  # Unique label per IP!
waf_requests_total{url="/api/users/123"}  # Unique label per URL!
```

This would create millions of time series, causing memory issues.

**Good** (low cardinality):
```
waf_requests_total{status="allowed"}  # Only 2 values: allowed, blocked
waf_jail_banned_ips_total{rule="rate-limit"}  # Limited number of rules
```

WAF metrics are designed with low cardinality in mind.

## Metrics Retention

Metrics are stored in Prometheus, not in the WAF:

**Prometheus retention**:

```bash
# prometheus.yml or command line
--storage.tsdb.retention.time=15d  # Retain 15 days of data
--storage.tsdb.retention.size=50GB  # Or max 50GB
```

## Troubleshooting

### Metrics endpoint returns 404

**Cause**: Metrics disabled.

**Solution**:
```yaml
metrics:
  enabled: true
```

### Prometheus can't scrape metrics

**Cause**: Network issue or wrong target.

**Check**:
```bash
# From Prometheus server, test connectivity
curl http://waf-host:3000/metrics

# Should return metrics in Prometheus format
```

**Solutions**:
- Check firewall rules
- Verify WAF is running: `curl http://waf-host:3000/waf/healthz`
- Check Prometheus target configuration

### Metrics show old data

**Cause**: Prometheus not scraping or WAF restarted (counters reset).

**Solution**: Counters reset on WAF restart. Use rate queries in Prometheus:

```promql
# Don't use raw counter
waf_middleware_requests_total

# Use rate
rate(waf_middleware_requests_total[5m])
```

### High memory usage from metrics

**Cause**: Too many unique label combinations (high cardinality).

**This shouldn't happen with WAF** (metrics are designed with low cardinality).

If it does occur, check for custom metric additions or bugs.

## Example Configurations

### Development

```yaml
metrics:
  enabled: true
  path: '/metrics'
```

### Production

```yaml
metrics:
  enabled: true
  path: '/metrics'  # Or custom path
```

### Disabled

```yaml
metrics:
  enabled: false
```

## Best Practices

1. **Enable in production** - Essential for monitoring
2. **Secure the endpoint** - Use firewall rules
3. **Set up alerts** - Don't just collect metrics
4. **Use Grafana** - Visualize metrics effectively
5. **Monitor the metrics** - Set up Prometheus alerts
6. **Regular review** - Check dashboards weekly
7. **Correlate with logs** - Use metrics + logs together

## Related Documentation

- [Prometheus Metrics](../monitoring/prometheus-metrics.md) - Complete metrics list
- [Grafana Dashboard](../monitoring/grafana-dashboard.md) - Visualization
- [Alerting](../monitoring/alerting.md) - Setting up alerts
- [Performance Tuning](../guides/performance-tuning.md) - Optimization
