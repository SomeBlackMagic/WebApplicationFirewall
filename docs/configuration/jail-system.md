# Jail System Configuration

The Jail System is responsible for managing temporarily banned IP addresses. When a filter rule is triggered, the offending IP is added to the "jail" for a specified duration.

## Overview

The Jail System provides:
- **Temporary IP banning** based on filter rules
- **Ban escalation** - increasing ban times for repeat offenders
- **Persistent storage** - optional file-based ban storage
- **Automatic unbanning** - IPs are automatically unbanned after the duration expires
- **Manual management** - via REST API

## Basic Configuration

```yaml
jailManager:
  enabled: true
  storage:
    driver: memory  # or 'file'
  syncInterval: 5000
  syncAlways: false
  filterRules: []
```

## Configuration Options

### enabled

**Type**: `boolean`
**Default**: `true`

Enable or disable the entire jail system.

```yaml
jailManager:
  enabled: true
```

When disabled, no IPs will be banned regardless of filter rules.

### storage

Configuration for ban storage.

#### storage.driver

**Type**: `string`
**Values**: `memory` | `file`

Storage backend for banned IPs:

- **`memory`**: Store bans in application memory
  - Fast
  - Bans lost on restart
  - Use for development/testing

- **`file`**: Store bans in a JSON file
  - Persistent across restarts
  - Slightly slower (file I/O)
  - Use for production

```yaml
jailManager:
  storage:
    driver: file
```

#### storage.driverConfig (for file driver)

Configuration specific to the file storage driver.

```yaml
jailManager:
  storage:
    driver: file
    driverConfig:
      filePath: './data/blocked_ips.json'
      locker:
        enabled: true
        config:
          retries: 3
```

**filePath**: Path to the JSON file for storing bans.

**locker**: File locking configuration to prevent race conditions.
- `enabled`: Enable file locking (`true` recommended)
- `config.retries`: Number of times to retry if file is locked

### syncInterval

**Type**: `number` (milliseconds)
**Default**: `5000`

Interval for synchronizing in-memory bans with persistent storage (file).

```yaml
jailManager:
  syncInterval: 5000  # Sync every 5 seconds
```

**Recommendation**:
- Lower values (1000-5000ms) for higher consistency
- Higher values (10000-30000ms) for better performance

### syncAlways

**Type**: `boolean`
**Default**: `false`

Whether to sync to storage after every ban addition.

```yaml
jailManager:
  syncAlways: false
```

- **`true`**: Sync immediately after each ban (slower, most consistent)
- **`false`**: Sync only at `syncInterval` (faster, slight risk of data loss on crash)

**Recommendation**: Use `false` for production (performance). Use `true` if data integrity is critical and traffic is low.

### filterRules

Array of filter rules that define when and how IPs get banned. See [Filter Rules](filter-rules.md) for detailed documentation.

```yaml
jailManager:
  filterRules:
    - name: rule-1
      type: composite
      # ... rule configuration
    - name: rule-2
      type: flexible
      # ... rule configuration
```

## Storage Examples

### Memory Storage (Development)

```yaml
jailManager:
  enabled: true
  storage:
    driver: memory
  syncInterval: 5000
  syncAlways: false
  filterRules: []
```

**Pros**:
- Fastest performance
- Simple setup

**Cons**:
- Bans lost on restart
- Not suitable for production with multiple instances

### File Storage (Production)

```yaml
jailManager:
  enabled: true
  storage:
    driver: file
    driverConfig:
      filePath: '/var/lib/waf/blocked_ips.json'
      locker:
        enabled: true
        config:
          retries: 5
  syncInterval: 10000  # 10 seconds
  syncAlways: false
  filterRules: []
```

**Pros**:
- Persistent across restarts
- Suitable for production

**Cons**:
- Slightly slower (file I/O)
- File must be writable

**Important**: Ensure the directory exists and is writable:

```bash
mkdir -p /var/lib/waf
chmod 755 /var/lib/waf
```

## Multi-Instance Setup

When running multiple WAF instances (high availability), all instances must share the same ban storage.

### Shared File Storage

Use a shared file on network storage (NFS, EFS, etc.):

```yaml
jailManager:
  storage:
    driver: file
    driverConfig:
      filePath: '/mnt/shared-storage/waf/blocked_ips.json'
      locker:
        enabled: true
        config:
          retries: 10  # Higher retries for network storage
```

**Recommendations**:
- Use reliable network storage
- Enable file locking
- Increase retry count
- Monitor for lock conflicts in logs

### Future: Redis Storage (Not Yet Implemented)

Redis would be ideal for multi-instance setups. This is a planned feature.

## Ban Data Structure

Bans are stored with the following information:

```json
{
  "ip": "1.2.3.4",
  "unbanTime": 1678886400000,
  "escalationCount": 2,
  "metadata": {
    "ruleId": "rate-limit-api",
    "country": "US",
    "city": "New York",
    "requestIds": "req-123,req-456"
  }
}
```

- **ip**: The banned IP address
- **unbanTime**: Unix timestamp (ms) when the ban expires
- **escalationCount**: Number of times this IP has been banned (for escalation)
- **metadata**: Additional context (rule ID, geo data, request IDs)

## Manual Ban Management

### View Banned IPs

```bash
curl -u admin:password http://localhost:3000/waf/jail-manager/baned-users
```

### Unban an IP

```bash
curl -X DELETE \
  -u admin:password \
  -H "Content-Type: application/json" \
  -d '{"ip":"1.2.3.4"}' \
  http://localhost:3000/waf/jail-manager/baned-users
```

See [API Reference](../api/endpoints.md) for more details.

## Ban Escalation

The jail system supports ban escalation - repeat offenders get progressively longer bans.

**Formula**:
```
new_ban_time = base_duration * (escalation_rate ^ escalation_count)
```

**Example**:
- Base duration: 300 seconds (5 minutes)
- Escalation rate: 1.5
- 1st offense: 300 seconds
- 2nd offense: 450 seconds (300 * 1.5¹)
- 3rd offense: 675 seconds (300 * 1.5²)
- 4th offense: 1012 seconds (300 * 1.5³)

Configured per rule in `filterRules`. See [Ban Escalation](../concepts/ban-escalation.md) for details.

## Monitoring Jail System

### Metrics

If metrics are enabled, the jail system exposes:

```
waf_jail_banned_ips_total{rule="rule-id"}
waf_jail_storage_size
waf_jail_unban_operations_total
```

See [Prometheus Metrics](../monitoring/prometheus-metrics.md).

### Logs

The jail system logs ban and unban events:

```
[INFO] IP 1.2.3.4 banned by rule 'rate-limit-api' for 300 seconds
[INFO] IP 1.2.3.4 automatically unbanned (duration expired)
[INFO] IP 1.2.3.4 manually unbanned via API
```

## Troubleshooting

### Bans not persisting after restart

**Cause**: Using memory storage or file path not writable.

**Solution**:
1. Switch to file storage
2. Ensure file path is writable: `touch /path/to/blocked_ips.json && chmod 666 /path/to/blocked_ips.json`

### File lock errors in logs

```
Error: Lock file is already being held
```

**Cause**: High concurrency or slow storage.

**Solution**:
- Increase `locker.config.retries`
- Increase `syncInterval` to reduce write frequency
- Consider using faster storage

### Bans not syncing between instances

**Cause**: Each instance using a different ban file.

**Solution**: Ensure all instances point to the SAME file path on shared storage.

### Memory usage growing over time

**Cause**: Old bans not being cleaned up.

**Solution**: Bans are automatically removed when they expire. If this persists, check for bugs or extremely long ban durations.

## Best Practices

1. **Use file storage in production** for persistence
2. **Enable file locking** to prevent corruption
3. **Use shared storage for multi-instance** setups
4. **Monitor ban metrics** to detect attacks
5. **Regularly review banned IPs** via API
6. **Set reasonable sync intervals** (5-10 seconds)
7. **Backup the ban file** if using critical rules

## Security Considerations

### File Permissions

Ensure the ban file is not publicly readable:

```bash
chmod 600 /path/to/blocked_ips.json
chown waf-user:waf-group /path/to/blocked_ips.json
```

### API Access

Protect the ban management API with authentication:

```yaml
api:
  enabled: true
  auth:
    enabled: true  # Required!
    username: "admin"
    password: "strong-password"
```

## Related Configuration

- [Filter Rules](filter-rules.md) - Defining ban rules
- [Ban Escalation](../concepts/ban-escalation.md) - Understanding escalation
- [API Endpoints](../api/endpoints.md) - Managing bans via API
- [High Availability](../deployment/high-availability.md) - Multi-instance setup
