# API Overview

The WAF provides a REST API for managing and monitoring the firewall. The API can be enabled or disabled via configuration and supports optional authentication.

## Enabling the API

To enable the API, set `api.enabled: true` in your configuration file:

```yaml
api:
  enabled: true
  auth:
    enabled: true
    username: "admin"
    password: "your-secure-password"
```

## Base URL

All API endpoints are prefixed with `/waf`:

```
http://your-waf-server:3000/waf/
```

## Authentication

The API supports HTTP Basic Authentication. When enabled (`api.auth.enabled: true`), all endpoints except `/waf/healthz` require authentication.

For more details, see [Authentication](authentication.md).

## Available Endpoints

### Health Check
- `GET /waf/healthz` - Check service health (no auth required)

### Jail Management
- `GET /waf/jail-manager/baned-users` - List all banned IPs
- `DELETE /waf/jail-manager/baned-users` - Unban a specific IP

For detailed endpoint documentation, see [Endpoints](endpoints.md).

## Usage Examples

For practical examples including curl commands and response formats, see [Examples](examples.md).

## API Clients

You can interact with the API using:

- **curl** - Command-line HTTP client
- **Postman** - API development tool
- **HTTPie** - User-friendly HTTP client
- **Custom scripts** - Python, JavaScript, etc.

## Rate Limiting

The API itself is not rate-limited, but it's recommended to:

- Use authentication to prevent unauthorized access
- Run the API on an internal network or behind a firewall
- Consider adding a reverse proxy with rate limiting for production

## Security Considerations

1. **Always enable authentication** in production environments
2. **Use strong passwords** - avoid default credentials
3. **Use HTTPS** - Run WAF behind a TLS-terminating reverse proxy
4. **Restrict access** - Limit API access to trusted networks/IPs
5. **Monitor API usage** - Check logs for suspicious activity

For more security recommendations, see the [Security Best Practices](../guides/security-best-practices.md) guide.

## Next Steps

- [Authentication](authentication.md) - Learn how to authenticate API requests
- [Endpoints](endpoints.md) - Detailed endpoint documentation
- [Examples](examples.md) - Practical usage examples
