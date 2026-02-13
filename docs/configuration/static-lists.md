# Static Lists (Whitelist & Blacklist)

Static lists allow you to explicitly allow or block traffic based on IP addresses, subnets, countries, or cities. These checks happen before filter rules are evaluated.

## Overview

Two types of static lists are supported:

- **Whitelist**: Allowed traffic that bypasses all other checks
- **Blacklist**: Blocked traffic that is immediately rejected

## Processing Order

1. **Whitelist** check (if configured) → Allow and skip all other checks
2. **Blacklist** check (if configured) → Block immediately
3. Filter rules and jail checks (if not whitelisted/blacklisted)

## Whitelist Configuration

```yaml
wafMiddleware:
  whitelist:
    ips: []
    ipSubnet: []
    geoCountry: []
    geoCity: []
```

### Fields

- **ips**: Array of specific IP addresses
- **ipSubnet**: Array of CIDR subnet ranges
- **geoCountry**: Array of country codes (ISO 3166-1 alpha-2)
- **geoCity**: Array of city names

### Examples

**Whitelist specific IPs and subnets**:

```yaml
wafMiddleware:
  whitelist:
    ips:
      - "10.0.0.1"            # Specific IP
    ipSubnet:
      - "192.168.1.0/24"      # Local network
      - "203.0.113.0/24"      # Office network
    geoCountry: []
    geoCity: []
```

**Whitelist by country**:

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

**Whitelist by city**:

```yaml
wafMiddleware:
  whitelist:
    ips: []
    ipSubnet: []
    geoCountry: []
    geoCity:
      - "London"
      - "New York"
      - "San Francisco"
```

## Blacklist Configuration

```yaml
wafMiddleware:
  blacklist:
    ips: []
    ipSubnet: []
    geoCountry: []
    geoCity: []
```

### Fields

Same as whitelist:
- **ips**: Array of IP addresses to block
- **ipSubnet**: Array of CIDR subnets to block
- **geoCountry**: Array of country codes to block
- **geoCity**: Array of city names to block

### Examples

**Block specific IPs**:

```yaml
wafMiddleware:
  blacklist:
    ips:
      - "192.0.2.1"
    ipSubnet:
      - "198.51.100.0/24"
    geoCountry: []
    geoCity: []
```

**Block by country**:

```yaml
wafMiddleware:
  blacklist:
    ips: []
    ipSubnet: []
    geoCountry:
      - "CN"
      - "RU"
      - "KP"
    geoCity: []
```

## CIDR Notation

Both whitelist and blacklist support CIDR notation for subnet ranges.

**Examples**:
- `192.168.1.0/24` - Matches 192.168.1.0 to 192.168.1.255 (256 addresses)
- `10.0.0.0/8` - Matches 10.0.0.0 to 10.255.255.255 (16,777,216 addresses)
- `172.16.0.0/12` - Matches 172.16.0.0 to 172.31.255.255 (1,048,576 addresses)

**Calculator**: Use tools like https://www.ipaddressguide.com/cidr to calculate CIDR ranges.

## Whitelist vs Blacklist Priority

**Whitelist takes precedence** over blacklist.

Example:
```yaml
wafMiddleware:
  whitelist:
    ips: ["1.2.3.4"]

  blacklist:
    ips: ["1.2.3.4"]
```

Result: `1.2.3.4` is **allowed** (whitelist wins).

## Use Cases

### Internal Network Access

Allow all requests from internal networks:

```yaml
wafMiddleware:
  whitelist:
    ips: []
    ipSubnet:
      - "192.168.0.0/16"
      - "10.0.0.0/8"
      - "172.16.0.0/12"
    geoCountry: []
    geoCity: []
```

### Geo-Fencing

Only allow traffic from specific countries:

```yaml
wafMiddleware:
  whitelist:
    ips: []
    ipSubnet: []
    geoCountry:
      - "US"
      - "CA"
      - "MX"
    geoCity: []
```

### Known Attackers

Block known malicious IPs:

```yaml
wafMiddleware:
  blacklist:
    ips:
      - "192.0.2.1"
      - "198.51.100.50"
    ipSubnet:
      - "203.0.113.0/24"
    geoCountry: []
    geoCity: []
```

**Note**: For dynamic threat feeds from external sources, use [Static Filter Rules](filter-rules.md#static-rules) which support loading IPs from URLs.

### Office/VPN Access Only

Whitelist office and VPN IPs for admin access:

```yaml
wafMiddleware:
  whitelist:
    ips:
      - "198.51.100.50"   # VPN endpoint
    ipSubnet:
      - "203.0.113.0/24"  # Office
    geoCountry: []
    geoCity: []
```

Then use a flexible rule to block all other admin access:

```yaml
jailManager:
  filterRules:
    - name: block-admin-non-whitelisted
      type: flexible
      conditions:
        - field: url
          check:
            - method: equals
              values: ["/admin"]
```

Since whitelisted IPs bypass all rules, office/VPN can access admin, but others are blocked.

### Country-Based Restrictions

Block high-risk countries:

```yaml
wafMiddleware:
  blacklist:
    ips: []
    ipSubnet: []
    geoCountry:
      - "CN"
      - "RU"
      - "KP"
      - "IR"
    geoCity: []
```

**Caution**: Legitimate users may use VPNs, causing false negatives.

## Complete Example

```yaml
wafMiddleware:
  # Whitelist trusted sources
  whitelist:
    ips:
      - "10.0.0.1"            # Admin IP
    ipSubnet:
      - "192.168.1.0/24"      # Local network
      - "203.0.113.0/24"      # Office network
    geoCountry:
      - "US"                  # Only allow US (if needed)
    geoCity: []

  # Blacklist known threats
  blacklist:
    ips:
      - "192.0.2.1"           # Known attacker
    ipSubnet: []
    geoCountry:
      - "KP"                  # High-risk country
    geoCity: []
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

1. Verify IP format (use CIDR for ranges)
2. Ensure IP detection is configured correctly (see [Client IP Detection](client-ip-detection.md))
3. Check logs for detected IP: `[INFO] Request from IP: x.x.x.x`

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
2. **Use CIDR notation** - More efficient than listing individual IPs
3. **Monitor metrics** - Track whitelist/blacklist effectiveness
4. **Document entries** - Comment why each IP/range is listed
5. **Regular review** - Remove obsolete entries
6. **Combine with rules** - Layer defenses (whitelist + filter rules)
7. **Be cautious with country blocks** - Can affect legitimate users

## Security Considerations

### Whitelist Security

- **Don't over-whitelist** - Each whitelisted IP bypasses ALL security
- **Regularly audit** - Remove unused entries
- **Use specific IPs** - Avoid /8 or /16 ranges unless necessary

### Blacklist Security

- **Combine with other methods** - Blacklist alone isn't sufficient
- **Consider false positives** - Shared IPs (VPNs, proxies) may block legitimate users

### Dynamic IP Lists

For loading IP lists from external URLs (e.g., threat intelligence feeds), use [Static Filter Rules](filter-rules.md#static-rules) instead of whitelist/blacklist. Static rules support `linkUrl` and `updateInterval` for dynamic updates.

## Related Configuration

- [Client IP Detection](client-ip-detection.md) - Correctly detecting IPs
- [Geolocation](geolocation.md) - Country/city detection
- [Filter Rules](filter-rules.md) - Additional filtering (including static rules for external feeds)
