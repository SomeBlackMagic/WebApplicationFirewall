# Geolocation Detection

The WAF can detect the geographic location (country and city) of client IPs for use in filtering rules and whitelisting/blacklisting.

## Overview

Geolocation enables you to:
- Block or allow traffic by country
- Block or allow traffic by city
- Create geo-specific filter rules
- View geographic information in ban lists and logs
- Implement geo-based rate limiting

## Configuration

Geolocation detection is configured separately for country and city:

```yaml
wafMiddleware:
  detectClientCountry:
    method: geoip  # or 'header'
    header: ""     # only used if method is 'header'

  detectClientCity:
    method: geoip  # or 'header'
    header: ""     # only used if method is 'header'
```

## Detection Methods

### GeoIP (Recommended)

Uses local MaxMind GeoLite2 databases to lookup location by IP.

**Configuration**:
```yaml
wafMiddleware:
  detectClientCountry:
    method: geoip

  detectClientCity:
    method: geoip
```

**GeoIP Database Setup**:

GeoIP database paths are configured via environment variables or command-line arguments:

```bash
export GEOIP_COUNTRY_PATH="./GeoLite2-Country.mmdb"
export GEOIP_CITY_PATH="./GeoLite2-City.mmdb"
```

Or with Docker:
```bash
docker run \
  -e GEOIP_COUNTRY_PATH=/app/geoip_data/GeoLite2-Country.mmdb \
  -e GEOIP_CITY_PATH=/app/geoip_data/GeoLite2-City.mmdb \
  -v $(pwd)/geoip_data:/app/geoip_data:ro \
  waf
```

**Advantages**:
- No dependency on external services
- Fast lookup (local database)
- Works offline
- No privacy concerns (data stays local)

**Disadvantages**:
- Requires database files (~100MB total)
- Databases need periodic updates for accuracy
- Uses memory to load databases

### Header

Uses a value from an HTTP header set by an upstream service (e.g., CDN, proxy).

**Country detection from header**:
```yaml
wafMiddleware:
  detectClientCountry:
    method: header
    header: "CloudFront-Viewer-Country"  # Example: AWS CloudFront
```

**City detection from header**:
```yaml
wafMiddleware:
  detectClientCity:
    method: header
    header: "X-City-Name"
```

**Advantages**:
- No database files needed
- No memory overhead for databases
- CDN may provide more accurate data

**Disadvantages**:
- Depends on upstream service
- Header values must be trustworthy
- May not work in all environments

## Common Header Sources

### Cloudflare

Cloudflare sets geo headers automatically:

```yaml
wafMiddleware:
  detectClientCountry:
    method: header
    header: "CF-IPCountry"
```

Country codes use ISO 3166-1 alpha-2 format (e.g., `US`, `GB`, `DE`).

### AWS CloudFront

CloudFront can be configured to add geo headers:

```yaml
wafMiddleware:
  detectClientCountry:
    method: header
    header: "CloudFront-Viewer-Country"

  detectClientCity:
    method: header
    header: "CloudFront-Viewer-City"
```

**Note**: Requires enabling CloudFront geolocation headers in distribution settings.

### Custom Proxy

If your proxy sets custom headers:

```yaml
wafMiddleware:
  detectClientCountry:
    method: header
    header: "X-Country-Code"

  detectClientCity:
    method: header
    header: "X-City-Name"
```

**Nginx example**:
```nginx
location / {
    proxy_pass http://waf:3000;

    # Using GeoIP module
    proxy_set_header X-Country-Code $geoip2_data_country_code;
    proxy_set_header X-City-Name $geoip2_data_city_name;
}
```

## GeoIP Database Setup

### Obtaining Databases

Download from:
1. **MaxMind** (requires free account): https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
2. **P3TERX Mirror**: https://github.com/P3TERX/GeoLite.mmdb

```bash
# Download from P3TERX
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb
```

### Updating Databases

**Recommendation**: Update monthly for best accuracy.

**Automated update script** (example):
```bash
#!/bin/bash
# update-geoip.sh

cd /path/to/waf
wget -q -O GeoLite2-Country.mmdb.tmp https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
wget -q -O GeoLite2-City.mmdb.tmp https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb

# Atomic replace
mv GeoLite2-Country.mmdb.tmp GeoLite2-Country.mmdb
mv GeoLite2-City.mmdb.tmp GeoLite2-City.mmdb

# Restart WAF
systemctl restart waf
```

**Cron job** (runs monthly):
```cron
0 2 1 * * /path/to/update-geoip.sh
```

## Country Codes

Country detection returns ISO 3166-1 alpha-2 codes (2-letter codes).

**Examples**:
- `US` - United States
- `GB` - United Kingdom
- `DE` - Germany
- `FR` - France
- `CN` - China
- `RU` - Russia
- `IN` - India
- `BR` - Brazil

Full list: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2

## Using Geolocation in Rules

### Whitelist by Country

Allow traffic only from specific countries:

```yaml
wafMiddleware:
  whitelist:
    ips: []
    ipSubnet: []
    geoCountry:
      - "US"
      - "GB"
      - "DE"
    geoCity: []
```

### Blacklist by Country

Block traffic from specific countries:

```yaml
wafMiddleware:
  blacklist:
    ips: []
    ipSubnet: []
    geoCountry:
      - "CN"
      - "RU"
    geoCity: []
```

### Flexible Rule with Country Condition

Block requests from specific countries to sensitive paths:

```yaml
jailManager:
  filterRules:
    - name: block-admin-from-foreign-countries
      type: flexible
      conditions:
        - field: "url"
          check:
            - method: "equals"
              values: ["/admin"]
        - field: "country"
          check:
            - method: "equals"
              values: ["US", "GB"]  # Allow only US/GB
```

### Composite Rule per Country

Different rate limits for different countries:

```yaml
jailManager:
  filterRules:
    # Strict limit for risky countries
    - name: rate-limit-risky-countries
      type: composite
      uniqueClientKey: ["ip"]
      conditions:
        - field: "country"
          check:
            - method: "equals"
              values: ["CN", "RU"]
      limit: 10
      period: 60
      duration: 600
      escalationRate: 2.0
```

### City-Based Rules

```yaml
jailManager:
  filterRules:
    - name: block-specific-cities
      type: flexible
      conditions:
        - field: "city"
          check:
            - method: "equals"
              values: ["Moscow", "Beijing"]
```

## Validation

Test geolocation detection:

```bash
# Check detection in logs (set log level to debug)
curl http://localhost:3000/

# Check banned users API (includes country/city metadata)
curl -u admin:password http://localhost:3000/waf/jail-manager/baned-users
```

**Example banned user with geo data**:
```json
{
  "ip": "1.2.3.4",
  "unbanTime": 1678886400000,
  "escalationCount": 0,
  "metadata": {
    "ruleId": "rate-limit",
    "country": "US",
    "city": "New York",
    "requestIds": "req-123"
  }
}
```

## Troubleshooting

### Country/City shows as "Unknown"

**Causes**:
1. GeoIP database not found or invalid
2. IP is a private IP (192.168.x.x, 10.x.x.x, 127.0.0.1)
3. IP not in database (rare)

**Solution**:
- Verify database files exist: `ls -lh *.mmdb`
- Check environment variables are set correctly
- Update databases (may be outdated)
- For testing, use a public IP (not 127.0.0.1)

### Wrong country detected

**Cause**: Outdated database.

**Solution**: Update GeoIP databases.

### Header method not working

**Cause**: Upstream proxy/CDN not setting expected header.

**Debug**:
```yaml
wafMiddleware:
  mode: audit  # Enable audit mode for detailed logs
```

Check logs for header values received.

## Performance Considerations

### GeoIP Lookup Performance

- Country lookup: ~0.1-0.5ms per request
- City lookup: ~0.5-2ms per request

**Minimal impact** on overall request processing time.

### Memory Usage

- Country database: ~10-20MB in memory
- City database: ~60-80MB in memory

**Total**: ~100MB additional memory usage.

For high-traffic scenarios, this is acceptable. If memory is extremely limited, consider using the header method instead.

## Best Practices

1. **Use GeoIP method** for most scenarios (most reliable)
2. **Update databases monthly** to maintain accuracy
3. **Combine with IP whitelisting** for trusted locations
4. **Be cautious with strict geo-blocking** - VPNs and proxies can cause false positives
5. **Use geo data in logs** to understand traffic patterns
6. **Test thoroughly** before enforcing geo-based rules

## Related Configuration

- [Static Lists](static-lists.md) - Whitelist/Blacklist by country
- [Filter Rules](filter-rules.md) - Using geo data in rules
- [Environment Variables](environment-variables.md) - GeoIP database configuration
