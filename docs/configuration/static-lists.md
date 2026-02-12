# Static Lists (Whitelist & Blacklist)

Static lists allow you to explicitly allow or block traffic based on IP addresses, subnets, countries, or cities. These checks happen before filter rules are evaluated.

## Overview

Two types of static lists are supported:

- **Whitelist**: Allowed traffic that bypasses all other checks
- **Blacklist**: Blocked traffic that is immediately rejected

## Processing Order

1. **Whitelist** check (if enabled) → Allow and skip all other checks
2. **Blacklist** check (if enabled) → Block immediately
3. Filter rules and jail checks (if not whitelisted/blacklisted)

## Whitelist Configuration

```yaml
whitelist:
  enabled: true
  ips: []
  countries: []
  cities: []
  linkUrl: ""
  updateInterval: 60000
```

### Fields

- **enabled**: Enable/disable whitelist
- **ips**: Array of IP addresses or CIDR subnets
- **countries**: Array of country codes (ISO 3166-1 alpha-2)
- **cities**: Array of city names
- **linkUrl**: URL to load additional IPs from (JSON array)
- **updateInterval**: How often to refresh from linkUrl (milliseconds)

### Examples

**Whitelist specific IPs and subnets**:

```yaml
whitelist:
  enabled: true
  ips:
    - "192.168.1.0/24"      # Local network
    - "10.0.0.1"            # Specific IP
    - "203.0.113.0/24"      # Office network
  countries: []
  cities: []
```

**Whitelist by country**:

```yaml
whitelist:
  enabled: true
  ips: []
  countries:
    - "US"
    - "GB"
    - "DE"
  cities: []
```

**Whitelist by city**:

```yaml
whitelist:
  enabled: true
  ips: []
  countries: []
  cities:
    - "London"
    - "New York"
    - "San Francisco"
```

**Load additional IPs from URL**:

```yaml
whitelist:
  enabled: true
  ips:
    - "192.168.1.0/24"
  linkUrl: "https://example.com/trusted-ips.json"
  updateInterval: 3600000  # Update hourly
```

**Expected JSON format from linkUrl**:

```json
[
  "1.2.3.4",
  "5.6.7.8",
  "10.20.30.0/24"
]
```

## Blacklist Configuration

```yaml
blacklist:
  enabled: true
  ips: []
  countries: []
  cities: []
  linkUrl: ""
  updateInterval: 60000
```

### Fields

Same as whitelist:
- **enabled**: Enable/disable blacklist
- **ips**: Array of IP addresses or CIDR subnets to block
- **countries**: Array of country codes to block
- **cities**: Array of city names to block
- **linkUrl**: URL to load blocked IPs from
- **updateInterval**: Refresh interval (milliseconds)

### Examples

**Block specific IPs**:

```yaml
blacklist:
  enabled: true
  ips:
    - "192.0.2.1"
    - "198.51.100.0/24"
  countries: []
  cities: []
```

**Block by country**:

```yaml
blacklist:
  enabled: true
  ips: []
  countries:
    - "CN"
    - "RU"
    - "KP"
  cities: []
```

**Block known malicious IPs from external feed**:

```yaml
blacklist:
  enabled: true
  ips: []
  linkUrl: "https://feeds.example.com/malicious-ips.json"
  updateInterval: 3600000
```

## CIDR Notation

Both whitelist and blacklist support CIDR notation for subnet ranges.

**Examples**:
- `192.168.1.0/24` - Matches 192.168.1.0 to 192.168.1.255 (256 addresses)
- `10.0.0.0/8` - Matches 10.0.0.0 to 10.255.255.255 (16,777,216 addresses)
- `172.16.0.0/12` - Matches 172.16.0.0 to 172.31.255.255 (1,048,576 addresses)

**Calculator**: Use tools like https://www.ipaddressgui de.com/cidr to calculate CIDR ranges.

## Loading from URLs

Both whitelist and blacklist can load additional IPs from external URLs.

**Use cases**:
- Centrally managed lists
- Third-party threat feeds
- Shared lists across multiple WAF instances
- Dynamic updates without config changes

**URL format**:

The URL must return a JSON array of IP addresses/CIDR ranges:

```json
[
  "1.2.3.4",
  "5.6.7.8/32",
  "10.0.0.0/16"
]
```

**Update behavior**:
- Lists are fetched on startup
- Re-fetched every `updateInterval` milliseconds
- If fetch fails, previous list is retained
- Errors are logged but don't stop the WAF

**Security note**: Only use HTTPS URLs from trusted sources.

## Whitelist vs Blacklist Priority

**Whitelist takes precedence** over blacklist.

Example:
```yaml
whitelist:
  enabled: true
  ips: ["1.2.3.4"]

blacklist:
  enabled: true
  ips: ["1.2.3.4"]
```

Result: `1.2.3.4` is **allowed** (whitelist wins).

## Use Cases

### Internal Network Access

Allow all requests from internal networks:

```yaml
whitelist:
  enabled: true
  ips:
    - "192.168.0.0/16"
    - "10.0.0.0/8"
    - "172.16.0.0/12"
```

### Geo-Fencing

Only allow traffic from specific countries:

```yaml
whitelist:
  enabled: true
  countries:
    - "US"
    - "CA"
    - "MX"
```

### Known Attackers

Block known malicious IPs:

```yaml
blacklist:
  enabled: true
  linkUrl: "https://reputation.example.com/blocklist.json"
  updateInterval: 1800000  # Update every 30 minutes
```

### Office/VPN Access Only

Whitelist office and VPN IPs for admin access:

```yaml
whitelist:
  enabled: true
  ips:
    - "203.0.113.0/24"  # Office
    - "198.51.100.50"   # VPN endpoint
```

Then use a flexible rule to block all other admin access:

```yaml
jailManager:
  filterRules:
    - id: block-admin-non-whitelisted
      type: flexible
      enabled: true
      conditions:
        - field: url
          method: contains
          values: ["/admin"]
```

Since whitelisted IPs bypass all rules, office/VPN can access admin, but others are blocked.

### Country-Based Restrictions

Block high-risk countries:

```yaml
blacklist:
  enabled: true
  countries:
    - "CN"
    - "RU"
    - "KP"
    - "IR"
```

**Caution**: Legitimate users may use VPNs, causing false negatives.

## Complete Example

```yaml
# Whitelist trusted sources
whitelist:
  enabled: true
  ips:
    - "192.168.1.0/24"      # Local network
    - "10.0.0.1"            # Admin IP
    - "203.0.113.0/24"      # Office network
  countries:
    - "US"                  # Only allow US (if needed)
  cities: []
  linkUrl: "https://internal.example.com/trusted-ips.json"
  updateInterval: 3600000

# Blacklist known threats
blacklist:
  enabled: true
  ips:
    - "192.0.2.1"           # Known attacker
  countries:
    - "KP"                  # High-risk country
  cities: []
  linkUrl: "https://feeds.example.com/malicious-ips.json"
  updateInterval: 1800000
```

## Monitoring

### Metrics

If metrics are enabled, whitelist/blacklist expose:

```
waf_middleware_whitelist_matches_total
waf_middleware_blacklist_matches_total
```

See [Prometheus Metrics](../monitoring/prometheus-metrics.md).

### Logs

Whitelist/blacklist matches are logged:

```
[INFO] IP 192.168.1.10 matched whitelist, bypassing all checks
[WARN] IP 192.0.2.1 matched blacklist, request blocked
```

## Troubleshooting

### Whitelist not working

1. Check `enabled: true`
2. Verify IP format (use CIDR for ranges)
3. Ensure IP detection is configured correctly (see [Client IP Detection](client-ip-detection.md))
4. Check logs for detected IP: `[INFO] Request from IP: x.x.x.x`

### IPs not loading from URL

1. Check URL is accessible: `curl <url>`
2. Verify JSON format is correct (array of strings)
3. Check logs for fetch errors
4. Ensure HTTPS certificate is valid (or use HTTP for testing)

### Subnet not matching

Use a CIDR calculator to verify your subnet:

```bash
# Check if IP is in subnet
# Example: Is 192.168.1.50 in 192.168.1.0/24?
# Yes, range is 192.168.1.0 - 192.168.1.255
```

### Country/city filtering not working

1. Ensure GeoIP databases are configured (see [Geolocation](geolocation.md))
2. Check detected country in logs: `[INFO] Request from country: US`
3. Use ISO 3166-1 alpha-2 codes (e.g., "US", not "USA")
4. City names are case-sensitive

## Best Practices

1. **Whitelist sparingly** - Only trusted sources
2. **Keep lists updated** - Especially external feeds
3. **Use CIDR notation** - More efficient than listing individual IPs
4. **Monitor metrics** - Track whitelist/blacklist effectiveness
5. **Document entries** - Comment why each IP/range is listed
6. **Regular review** - Remove obsolete entries
7. **Combine with rules** - Layer defenses (whitelist + filter rules)
8. **Be cautious with country blocks** - Can affect legitimate users

## Security Considerations

### Whitelist Security

- **Don't over-whitelist** - Each whitelisted IP bypasses ALL security
- **Regularly audit** - Remove unused entries
- **Use specific IPs** - Avoid /8 or /16 ranges unless necessary

### Blacklist Security

- **Use reputable feeds** - Only trusted sources
- **Verify feed URLs** - Use HTTPS
- **Monitor updates** - Ensure feeds are current
- **Combine with other methods** - Blacklist alone isn't sufficient

### External Feed Security

- **Use HTTPS** - Prevent MITM attacks
- **Validate sources** - Only use trusted feeds
- **Monitor fetch errors** - Alerts on repeated failures
- **Backup lists** - In case feed goes down

## Related Configuration

- [Client IP Detection](client-ip-detection.md) - Correctly detecting IPs
- [Geolocation](geolocation.md) - Country/city detection
- [Filter Rules](filter-rules.md) - Additional filtering
