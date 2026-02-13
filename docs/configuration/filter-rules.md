# Filter Rules

Filter rules define when and how the WAF should block requests and ban IP addresses. Rules are configured in the `jailManager.filterRules` section.

## Overview

The WAF supports three types of rules:

1. **Static Rules** - Block IPs from external lists
2. **Flexible Rules** - Block based on request properties
3. **Composite Rules** - Rate limiting with configurable thresholds

## Rule Structure

All rules share these common fields:

```yaml
jailManager:
  filterRules:
    - name: unique-rule-name
      type: static | flexible | composite
      # Type-specific fields...
```

### Common Fields

- **name**: Unique identifier for the rule (used in logs, metrics, ban metadata)
- **type**: Rule type (`static`, `flexible`, or `composite`)

## Rule Types

### 1. Static Rules

Block IPs from an external JSON list loaded via URL.

**Use cases**:
- Third-party threat intelligence feeds
- Centrally managed blocklists
- Shared blocklists across multiple WAF instances

**Configuration**:

```yaml
- name: static-blacklist-feed
  type: static
  linkUrl: "https://example.com/blocklist.json"
  updateInterval: 60000  # milliseconds
```

**Fields**:
- **linkUrl**: URL to a JSON file containing array of IP addresses
- **updateInterval**: How often to refresh the list (in milliseconds)

**Expected JSON format**:

```json
[
  "1.2.3.4",
  "5.6.7.8",
  "192.168.1.0/24"
]
```

**Example**:

```yaml
- name: abuse-ip-db
  type: static
  linkUrl: "https://api.abuseipdb.com/api/v2/blacklist"
  updateInterval: 3600000  # Update hourly
```

**Behavior**: If a request comes from an IP in the list, it's immediately blocked. The IP is NOT added to the jail (these are pre-existing blocks).

### 2. Flexible Rules

Block requests based on matching specific properties (URL, User-Agent, country, etc.).

**Use cases**:
- Block specific user agents (bots, scrapers)
- Block access to admin pages from foreign countries
- Block specific HTTP methods
- Block based on custom headers

**Configuration**:

```yaml
- name: block-bad-bots
  type: flexible
  conditions:
    - field: user-agent
      check:
        - method: equals
          values:
            - "bot"
            - "scraper"
            - "crawler"
```

**Fields**:
- **conditions**: Array of conditions that must ALL match (AND logic)

**Condition Fields**:
- **field**: Request property to check (see [Available Fields](#available-fields))
- **check**: Array of check methods and values
  - **method**: Comparison method (see [Comparison Methods](#comparison-methods))
  - **values**: Array of values to compare against

**Available Fields**:
- `ip` - Client IP address
- `country` - Client country code (e.g., "US", "GB")
- `city` - Client city name (e.g., "London", "New York")
- `url` - Request URL path (e.g., "/api/users")
- `user-agent` - User-Agent header value
- `method` - HTTP method (GET, POST, etc.)
- `header:<name>` - Custom header value (e.g., `header:x-api-key`)

**Comparison Methods**:
- `equals` - Exact match
- `regexp` - Regular expression match

**Examples**:

**Block access to /admin from non-US countries**:
```yaml
- name: admin-geo-block
  type: flexible
  conditions:
    - field: url
      check:
        - method: equals
          values: ["/admin"]
    - field: country
      check:
        - method: equals
          values: ["US", "GB"]
```

**Block specific user agents**:
```yaml
- name: block-scrapers
  type: flexible
  conditions:
    - field: user-agent
      check:
        - method: regexp
          values: ["(bot|crawler|spider|scraper)"]
```

**Block POST to sensitive endpoints**:
```yaml
- name: block-post-to-config
  type: flexible
  conditions:
    - field: method
      check:
        - method: equals
          values: ["POST"]
    - field: url
      check:
        - method: equals
          values: ["/config", "/settings"]
```

**Behavior**: Requests matching ALL conditions are immediately blocked. The IP is NOT added to the jail.

### 3. Composite Rules

Rate limiting with request counting and threshold-based banning.

**Use cases**:
- Prevent brute force attacks (login, API)
- Rate limit API endpoints
- Prevent scraping/crawling
- Mitigate DDoS attacks
- Protect against credential stuffing

**Configuration**:

```yaml
- name: api-rate-limit
  type: composite
  uniqueClientKey: ["ip"]
  conditions: []
  limit: 100
  period: 60
  duration: 300
  escalationRate: 1.5
```

**Fields**:
- **uniqueClientKey**: Fields to group requests by (see [Grouping Keys](#grouping-keys))
- **conditions**: Optional conditions to narrow the scope (same as Flexible rules)
- **limit**: Maximum requests allowed within the period
- **period**: Time window in seconds
- **duration**: Ban duration in seconds when limit is exceeded
- **escalationRate**: Multiplier for repeat offenses (1.0 = no escalation)

**Grouping Keys**:

Keys determine how requests are counted. Multiple keys create unique combinations.

Available keys:
- `ip` - Count per IP address
- `country` - Count per country
- `city` - Count per city
- `url` - Count per URL
- `user-agent` - Count per User-Agent
- `method` - Count per HTTP method
- `header:<name>` - Count per custom header value

**Examples**:

**Simple IP-based rate limit**:
```yaml
- name: global-rate-limit
  type: composite
  uniqueClientKey: ["ip"]
  conditions: []
  limit: 1000
  period: 60  # 1000 requests per 60 seconds
  duration: 300  # Ban for 5 minutes
  escalationRate: 1.5
```

**Login brute force protection**:
```yaml
- name: login-bruteforce
  type: composite
  uniqueClientKey: ["ip"]
  conditions:
    - field: url
      check:
        - method: equals
          values: ["/api/login", "/auth/login"]
    - field: method
      check:
        - method: equals
          values: ["POST"]
  limit: 5
  period: 300  # 5 login attempts per 5 minutes
  duration: 900  # Ban for 15 minutes
  escalationRate: 2.0
```

**API endpoint protection per IP**:
```yaml
- name: api-per-endpoint-limit
  type: composite
  uniqueClientKey: ["ip", "url"]  # Separate limits per IP+URL combination
  conditions:
    - field: url
      check:
        - method: regexp
          values: ["^/api/"]
  limit: 100
  period: 60
  duration: 600
  escalationRate: 1.5
```

**Strict country-based limit**:
```yaml
- name: risky-country-limit
  type: composite
  uniqueClientKey: ["ip"]
  conditions:
    - field: country
      check:
        - method: equals
          values: ["CN", "RU"]
  limit: 10
  period: 60
  duration: 3600
  escalationRate: 3.0
```

**Behavior**:
1. Requests matching conditions are counted per uniqueClientKey combination
2. When limit is exceeded within period, IP is added to jail
3. Subsequent violations increase ban time via escalation

## Rule Priority and Order

Rules are evaluated in this order:

1. **Whitelist** (if configured) - Bypasses all rules
2. **Blacklist** (if configured) - Immediately blocks
3. **Static rules** - Blocks from external lists
4. **Jail check** - Blocks if IP is already banned
5. **Flexible rules** - Blocks based on conditions
6. **Composite rules** - Counts requests and bans if limit exceeded

Rules within each type are evaluated in the order defined in configuration.

## Complete Example

```yaml
jailManager:
  enabled: true
  storage:
    driver: file
    driverConfig:
      filePath: './data/blocked_ips.json'
  filterRules:
    # External threat feed
    - name: threat-intelligence
      type: static
      linkUrl: "https://feeds.example.com/malicious-ips.json"
      updateInterval: 3600000

    # Block bad bots
    - name: block-bots
      type: flexible
      conditions:
        - field: user-agent
          check:
            - method: regexp
              values: ["(bot|crawler|scraper|spider)"]

    # Admin access - US only
    - name: admin-geo-block
      type: flexible
      conditions:
        - field: url
          check:
            - method: equals
              values: ["/admin", "/wp-admin"]
        - field: country
          check:
            - method: equals
              values: ["US"]

    # Login brute force protection
    - name: login-protection
      type: composite
      uniqueClientKey: ["ip"]
      conditions:
        - field: url
          check:
            - method: regexp
              values: ["/(login|auth)"]
        - field: method
          check:
            - method: equals
              values: ["POST"]
      limit: 5
      period: 300
      duration: 900
      escalationRate: 2.0

    # API rate limiting
    - name: api-rate-limit
      type: composite
      uniqueClientKey: ["ip", "url"]
      conditions:
        - field: url
          check:
            - method: regexp
              values: ["^/api/"]
      limit: 100
      period: 60
      duration: 300
      escalationRate: 1.5

    # Global rate limit
    - name: global-rate-limit
      type: composite
      uniqueClientKey: ["ip"]
      conditions: []
      limit: 10000
      period: 3600
      duration: 600
      escalationRate: 1.2
```

## Testing Rules

### 1. Start in Audit Mode

Always test new rules in `audit` mode first:

```yaml
wafMiddleware:
  mode: audit
```

In audit mode:
- Rules are evaluated
- Violations are logged
- No requests are blocked
- No IPs are banned

### 2. Check Logs

Review logs to see which rules are triggered:

```
[INFO] Rule 'login-protection' triggered for IP 1.2.3.4
[INFO] Would ban IP 1.2.3.4 for 900 seconds (audit mode)
```

### 3. Verify No False Positives

Ensure legitimate traffic isn't being flagged.

### 4. Switch to Normal Mode

Once satisfied, switch to `normal` mode:

```yaml
wafMiddleware:
  mode: normal
```

## Best Practices

1. **Start with audit mode** - Test rules before enforcement
2. **Use specific conditions** - Avoid overly broad rules
3. **Whitelist trusted sources** - Prevent accidental blocks
4. **Monitor metrics** - Track rule effectiveness
5. **Use escalation** - Progressive punishment for repeat offenders
6. **Combine rule types** - Layer defenses (static + flexible + composite)
7. **Regular review** - Update rules based on attack patterns
8. **Document rules** - Use descriptive names and comments

## Common Patterns

### Protect Login Endpoint

```yaml
- name: login-bruteforce-protection
  type: composite
  uniqueClientKey: ["ip"]
  conditions:
    - field: url
      check:
        - method: equals
          values: ["/api/auth/login"]
  limit: 5
  period: 300
  duration: 1800
  escalationRate: 2.0
```

### Protect Admin Area

```yaml
# Block non-whitelisted countries
- name: admin-geo-fence
  type: flexible
  conditions:
    - field: url
      check:
        - method: equals
          values: ["/admin"]
    - field: country
      check:
        - method: equals
          values: ["US", "GB"]

# Rate limit admin access
- name: admin-rate-limit
  type: composite
  uniqueClientKey: ["ip"]
  conditions:
    - field: url
      check:
        - method: equals
          values: ["/admin"]
  limit: 50
  period: 60
  duration: 600
  escalationRate: 2.0
```

### API Protection

```yaml
# Per-endpoint limits
- name: api-per-endpoint
  type: composite
  uniqueClientKey: ["ip", "url"]
  conditions:
    - field: url
      check:
        - method: regexp
          values: ["^/api/"]
  limit: 100
  period: 60
  duration: 300
  escalationRate: 1.5

# Global API limit
- name: api-global
  type: composite
  uniqueClientKey: ["ip"]
  conditions:
    - field: url
      check:
        - method: regexp
          values: ["^/api/"]
  limit: 1000
  period: 60
  duration: 600
  escalationRate: 1.3
```

## Troubleshooting

### Rule not triggering

1. Verify conditions match actual requests
2. Check rule order (earlier rules may block first)
3. Enable debug logging in application settings

### Too many false positives

1. Add more specific conditions
2. Increase limit/period for composite rules
3. Whitelist legitimate users/IPs
4. Review logs in audit mode

### Rules too permissive

1. Decrease limit for composite rules
2. Add more restrictive conditions
3. Combine multiple rule types

## Related Documentation

- [Jail System](jail-system.md) - Ban storage and management
- [Ban Escalation](../concepts/ban-escalation.md) - Understanding escalation
- [Static Lists](static-lists.md) - Whitelist/Blacklist
- [Use Cases](../guides/use-cases.md) - Practical scenarios
