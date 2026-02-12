# Troubleshooting Guide

Common issues and their solutions when running the WAF.

## Installation Issues

### GeoIP Database Not Found

**Error**:
```
Error: ENOENT: no such file or directory, open './GeoLite2-Country.mmdb'
```

**Solution**:
1. Download databases:
   ```bash
   wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
   wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb
   ```
2. Verify paths in `config.yaml` match file locations

### Port Already in Use

**Error**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**:
```bash
# Find process using port 3000
sudo lsof -i :3000
# Or change port in config.yaml
port: 3001
```

### npm install Fails

**Solution**:
```bash
# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## Configuration Issues

### Configuration Not Loading

**Symptoms**: WAF ignores config file changes

**Solutions**:
1. Restart WAF after config changes
2. Check for YAML syntax errors:
   ```bash
   npm install -g yaml-lint
   yamllint config.yaml
   ```
3. Verify file path:
   ```bash
   ls -la config.yaml
   ```

### Invalid Configuration Values

**Error**: `Invalid configuration: mode must be 'audit' or 'normal'`

**Solution**: Check for typos in config values. Valid options:
- `mode`: `audit` or `normal`
- `detectClientCountry.method`: `geoip` or `header`
- `jailManager.storage.driver`: `memory` or `file`

## IP Detection Issues

### Wrong IPs Being Banned

**Symptom**: Proxy IP (e.g., `127.0.0.1`) banned instead of client IP

**Cause**: IP detection not configured for your proxy setup

**Solution**:
1. Enable debug logging:
   ```yaml
   log:
     level: debug
   ```
2. Check logs for detected IP:
   ```
   [DEBUG] Detected client IP: 127.0.0.1 from header: x-forwarded-for
   ```
3. Configure correct headers:
   ```yaml
   detectClientIp:
     headers:
       - "x-forwarded-for"  # For most proxies
       - "cf-connecting-ip"  # For Cloudflare
       - "x-real-ip"         # For Nginx
   ```

See [Client IP Detection](../configuration/client-ip-detection.md) for details.

### All Requests Show Same IP

**Cause**: Proxy not sending client IP headers

**Solution**: Configure your reverse proxy to send headers.

**Nginx example**:
```nginx
location / {
    proxy_pass http://waf:3000;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Geolocation Issues

### Country Shows as "Unknown"

**Causes**:
1. Private IP address (192.168.x.x, 10.x.x.x, 127.0.0.1)
2. Outdated GeoIP database
3. IP not in database

**Solutions**:
- Update databases monthly
- For testing, use public IPs
- Check database is loaded: Look for startup log `GeoIP databases loaded successfully`

### Wrong Country Detected

**Cause**: Outdated database

**Solution**: Update GeoIP databases:
```bash
cd /path/to/waf
wget -O GeoLite2-Country.mmdb.new https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
mv GeoLite2-Country.mmdb.new GeoLite2-Country.mmdb
# Restart WAF
```

## Rule Issues

### Rules Not Triggering

**Checklist**:
1. Rule enabled? `enabled: true`
2. Conditions match? Check field names and values
3. Mode set correctly? Use `audit` to test without blocking
4. Check logs:
   ```yaml
   log:
     level: debug
   ```

**Debug**:
```
[DEBUG] Evaluating rule: my-rule
[DEBUG] Rule conditions: url=/admin, method=POST
[DEBUG] Request matches conditions: false
```

### Too Many False Positives

**Solutions**:
1. **Whitelist legitimate sources**:
   ```yaml
   whitelist:
     enabled: true
     ips: ["your-office-ip"]
   ```

2. **Relax rule limits**:
   ```yaml
   # From strict
   limit: 10
   period: 60
   # To relaxed
   limit: 100
   period: 60
   ```

3. **Add more specific conditions**:
   ```yaml
   conditions:
     - field: url
       method: equals  # More specific than 'contains'
       values: ["/exact/path"]
   ```

### Rules Too Permissive

**Solution**: Tighten rules progressively
1. Start with high limits in audit mode
2. Monitor metrics to find appropriate thresholds
3. Gradually decrease limits
4. Switch to normal mode

## Ban Storage Issues

### Bans Not Persisting After Restart

**Cause**: Using memory storage

**Solution**: Switch to file storage:
```yaml
jailManager:
  storage:
    driver: file
    driverConfig:
      filePath: './data/blocked_ips.json'
```

### File Lock Errors

**Error**: `Lock file is already being held`

**Causes**:
- Multiple WAF instances writing to same file
- Slow storage (network drive)
- High write frequency

**Solutions**:
1. Increase retries:
   ```yaml
   locker:
     config:
       retries: 10
   ```
2. Increase sync interval:
   ```yaml
   syncInterval: 30000  # 30 seconds
   ```
3. Use faster storage
4. For multi-instance, use shared storage with proper locking

### Ban File Corruption

**Symptoms**: WAF fails to start, mentions ban file

**Solution**:
```bash
# Backup current file
cp data/blocked_ips.json data/blocked_ips.json.backup

# Reset ban file
echo "[]" > data/blocked_ips.json

# Restart WAF
```

## Proxy Issues

### Backend Not Responding

**Error**: `ECONNREFUSED` or `503 Service Unavailable`

**Checklist**:
1. Backend running?
   ```bash
   curl http://backend:8080/
   ```
2. Correct URL in config?
   ```yaml
   proxy:
     host: "http://backend:8080"  # Check this
   ```
3. Network connectivity?
   ```bash
   ping backend
   ```
4. Firewall rules?

### Timeout Errors

**Error**: `504 Gateway Timeout`

**Solutions**:
1. Increase timeout:
   ```yaml
   proxy:
     config:
       proxyTimeout: 60000  # 60 seconds
   ```
2. Optimize backend performance
3. Check backend logs for slow operations

### WebSocket Connection Fails

**Solution**: Enable WebSocket support:
```yaml
proxy:
  config:
    ws: true
```

## API Issues

### API Returns 401 Unauthorized

**Causes**:
1. Auth enabled but no credentials provided
2. Wrong username/password
3. Incorrect auth header format

**Solutions**:
```bash
# Check config
grep -A5 "api:" config.yaml

# Test with curl
curl -u admin:password http://localhost:3000/waf/jail-manager/baned-users

# Verify credentials work
curl -v -u admin:password http://localhost:3000/waf/jail-manager/baned-users
```

### API Not Accessible Remotely

**Causes**:
- Firewall blocking
- Docker port not mapped
- WAF bound to localhost only

**Solutions**:
```bash
# Check WAF is listening
netstat -tulpn | grep 3000

# Check Docker port mapping
docker ps  # Look for 0.0.0.0:3000->3000

# Check firewall
sudo ufw status
sudo iptables -L | grep 3000
```

## Performance Issues

### High Memory Usage

**Causes**:
- Too many banned IPs
- Large GeoIP databases (expected ~100MB)
- Memory leaks (rare)

**Solutions**:
1. Clean old bans:
   ```bash
   # Via API
   curl -X DELETE -u admin:pass http://localhost:3000/waf/jail-manager/baned-users \
     -d '{"ip":"old-ip"}'
   ```
2. Shorter ban durations:
   ```yaml
   duration: 300  # 5 minutes instead of hours
   ```
3. Monitor with metrics:
   ```promql
   process_resident_memory_bytes{job="waf"}
   ```

### High CPU Usage

**Causes**:
- Too many rules
- Complex regex in rules
- Very high traffic

**Solutions**:
1. Reduce debug logging:
   ```yaml
   log:
     level: warn
   ```
2. Optimize rules - remove unused rules
3. Use whitelists to bypass checks for trusted IPs
4. Scale horizontally (multiple WAF instances)

### Slow Response Times

**Checklist**:
1. Check backend performance (WAF adds ~1-5ms)
2. Reduce rule complexity
3. Use whitelist for trusted sources
4. Monitor metrics:
   ```promql
   http_request_duration_seconds{job="waf"}
   ```

## Docker Issues

### Container Exits Immediately

**Debug**:
```bash
# Check logs
docker logs waf

# Common causes:
# - Config file not found
# - GeoIP databases not mounted
# - Invalid configuration
```

### Can't Connect to Backend from Docker

**Solution**: Use correct network addressing
```yaml
# Bad (if backend is on host)
proxy:
  host: "http://localhost:8080"

# Good
proxy:
  host: "http://host.docker.internal:8080"  # Mac/Windows
  # or "http://172.17.0.1:8080"            # Linux
```

Or use Docker networking:
```bash
docker network create waf-net
docker run --network waf-net --name backend ...
docker run --network waf-net --name waf ...

# In config:
# proxy:
#   host: "http://backend:8080"
```

## Getting Help

If issues persist:

1. **Enable debug logging**:
   ```yaml
   log:
     level: debug
   ```

2. **Collect information**:
   - WAF version
   - Configuration (sanitized)
   - Logs (relevant sections)
   - Environment (OS, Node version)

3. **Search existing issues**:
   https://github.com/SomeBlackMagic/WebApplicationFirewall/issues

4. **Create new issue**:
   Use issue template and provide all collected information

5. **Community discussion**:
   https://github.com/SomeBlackMagic/WebApplicationFirewall/discussions

## Related Documentation

- [Configuration Overview](../configuration/README.md)
- [Client IP Detection](../configuration/client-ip-detection.md)
- [Filter Rules](../configuration/filter-rules.md)
- [Deployment Guide](../deployment/docker.md)
