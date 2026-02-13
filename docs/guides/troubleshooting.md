# Troubleshooting Guide

Common issues and solutions when running the WAF.

## Startup Issues

### Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::3000`

**Cause**: Another process is using port 3000.

**Solution**:
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or change port via environment variable
export PORT=3001
npm start

# Or with Docker
docker run -e PORT=3001 -p 3001:3001 waf
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
- `wafMiddleware.mode`: `audit` or `normal`
- `wafMiddleware.detectClientCountry.method`: `geoip` or `header`
- `jailManager.storage.driver`: `memory` or `file`

## IP Detection Issues

### Wrong IPs Being Banned

**Symptom**: Proxy IP (e.g., `127.0.0.1`) banned instead of client IP

**Cause**: IP detection not configured for your proxy setup

**Solution**:
1. Configure correct headers:
   ```yaml
   wafMiddleware:
     detectClientIp:
       headers:
         - "x-forwarded-for"  # For most proxies
         - "cf-connecting-ip"  # For Cloudflare
         - "x-real-ip"         # For Nginx
   ```

2. Enable audit mode to see detected IPs in logs:
   ```yaml
   wafMiddleware:
     mode: audit
   ```

3. Check logs for detected IP:
   ```
   [DEBUG] Detected client IP: x.x.x.x from header: x-forwarded-for
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
- Verify environment variables are set:
  ```bash
  echo $GEOIP_COUNTRY_PATH
  echo $GEOIP_CITY_PATH
  ```

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
1. Conditions match? Check field names and values
2. Mode set correctly? Use `audit` to test without blocking:
   ```yaml
   wafMiddleware:
     mode: audit
   ```
3. Check logs for rule evaluation (enable audit mode for verbose logging)

**Debug logs will show**:
```
[DEBUG] Evaluating rule: my-rule
[DEBUG] Rule conditions: url=/admin, method=POST
[DEBUG] Request matches conditions: false
```

### Too Many False Positives

**Solutions**:
1. **Whitelist legitimate sources**:
   ```yaml
   wafMiddleware:
     whitelist:
       ips: ["your-office-ip"]
       ipSubnet: ["192.168.1.0/24"]
   ```

2. **Relax rule limits**:
   ```yaml
   # From strict
   - name: api-limit
     type: composite
     limit: 10
     period: 60

   # To relaxed
   - name: api-limit
     type: composite
     limit: 100
     period: 60
   ```

3. **Add more specific conditions**:
   ```yaml
   # Too broad
   - name: block-all-post
     type: flexible
     conditions:
       - field: method
         check:
           - method: equals
             values: ["POST"]

   # More specific
   - name: block-specific-post
     type: flexible
     conditions:
       - field: method
         check:
           - method: equals
             values: ["POST"]
       - field: url
         check:
           - method: equals
             values: ["/admin/delete"]
   ```

### Rules Too Permissive

**Solutions**:
1. Decrease limits:
   ```yaml
   - name: login-limit
     type: composite
     limit: 5   # Stricter
     period: 300
   ```

2. Add more rules for different endpoints

3. Combine flexible and composite rules

## Jail System Issues

### IPs Not Being Banned

**Causes**:
1. WAF in `audit` mode
2. IP is whitelisted
3. Limit not exceeded

**Solutions**:
1. Switch to normal mode:
   ```yaml
   wafMiddleware:
     mode: normal
   ```

2. Check whitelist:
   ```yaml
   wafMiddleware:
     whitelist:
       ips: []  # Make sure offending IP not listed
   ```

3. Check API to see current bans:
   ```bash
   curl -u admin:password http://localhost:3000/waf/jail-manager/baned-users
   ```

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

### Ban File Lock Errors

**Error**: `Error: Lock file is already being held`

**Cause**: High concurrency or slow storage

**Solution**:
```yaml
jailManager:
  storage:
    driver: file
    driverConfig:
      filePath: './data/blocked_ips.json'
      locker:
        enabled: true
        config:
          retries: 10  # Increase retries
  syncInterval: 10000    # Reduce sync frequency
```

## API Issues

### API Returns 401 Unauthorized

**Cause**: Auth not configured or wrong credentials

**Solution**:
```yaml
api:
  enabled: true
  auth:
    enabled: true
    username: "admin"
    password: "your-password"
```

Test:
```bash
curl -u admin:your-password http://localhost:3000/waf/jail-manager/baned-users
```

### API Not Responding

**Causes**:
1. API not enabled
2. Wrong port
3. WAF not started

**Solutions**:
1. Enable API:
   ```yaml
   api:
     enabled: true
   ```

2. Check health endpoint:
   ```bash
   curl http://localhost:3000/waf/healthz
   ```

3. Check WAF is running:
   ```bash
   ps aux | grep node
   # Or with Docker
   docker ps | grep waf
   ```

## Performance Issues

### High Memory Usage

**Causes**:
1. GeoIP databases loaded in memory (~100MB)
2. Large number of banned IPs
3. Memory leaks

**Solutions**:
1. Use header method for geolocation (if behind CDN):
   ```yaml
   wafMiddleware:
     detectClientCountry:
       method: header
       header: "CF-IPCountry"
   ```

2. Regularly clean old bans (they auto-expire)

3. Monitor for memory leaks:
   ```bash
   # Check memory usage
   ps aux | grep node
   # Or with Docker
   docker stats waf
   ```

### High CPU Usage

**Causes**:
1. Too many regex operations in flexible rules
2. High request rate
3. Inefficient rules

**Solutions**:
1. Use `equals` instead of `regexp` where possible:
   ```yaml
   # Slower
   - field: url
     check:
       - method: regexp
         values: ["^/api/users$"]

   # Faster
   - field: url
     check:
       - method: equals
         values: ["/api/users"]
   ```

2. Whitelist trusted IPs to skip rule evaluation

3. Optimize rule order (most frequently triggered first)

## Docker Issues

### Container Won't Start

**Check logs**:
```bash
docker logs waf
```

**Common causes**:
1. Config file not mounted correctly
2. Port conflict
3. Missing environment variables

**Solution**:
```bash
docker run -d \
  --name waf \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -e GEOIP_COUNTRY_PATH=/app/geoip_data/GeoLite2-Country.mmdb \
  -e GEOIP_CITY_PATH=/app/geoip_data/GeoLite2-City.mmdb \
  -v $(pwd)/geoip_data:/app/geoip_data:ro \
  waf
```

### Config Changes Not Applied

**Cause**: Config file not mounted or container needs restart

**Solution**:
```bash
# Restart container
docker restart waf

# Or rebuild with updated config
docker stop waf
docker rm waf
docker run ... # with correct config mount
```

## Logging Issues

### Not Enough Logs

**Solution**: Application log level is configured via environment variables or application settings (not in config.yaml).

With Docker:
```bash
docker run -e LOG_LEVEL=debug waf
```

From source:
```bash
export LOG_LEVEL=debug
npm start
```

### Too Many Logs

**Solution**: Reduce log verbosity:
```bash
export LOG_LEVEL=info
npm start
```

## Getting Help

If issues persist:

1. **Check documentation** - See [Configuration](../configuration/README.md)
2. **Enable audit mode** - Helps debug without blocking traffic
3. **Check logs** - Most issues show clear error messages
4. **Review configuration** - Compare with [config.example.yaml](../../config.example.yaml)
5. **Report issue** - [GitHub Issues](https://github.com/SomeBlackMagic/WebApplicationFirewall/issues)

When reporting issues, include:
- WAF version
- Configuration (remove sensitive data)
- Error messages
- Steps to reproduce
