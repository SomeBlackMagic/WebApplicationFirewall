# Under Attack Module

The `Under Attack` module provides protection against automated attacks. It is designed for client verification through browser fingerprinting and bot detection.

## Key Features

- Client verification through Browser Fingerprinting
- Bot detection using heuristics and AI
- Customizable verification page
- Token system for verified clients
- Detailed metrics for monitoring
- Bypass verification capability for trusted services

## Configuration

Module configuration is done in the `underAttack` section of the configuration file:

```yaml
underAttack:
  enabled: true # enable under attack mode
  challengeDurationMs: 1800000 # 30 minutes token validity

  # Fingerprint check settings
  fingerprintChecks:
    enabled: true
    minScore: 70 # minimum score to pass (0-100)

  # Bot detection settings
  botDetection:
    enabled: true
    aiModel: "basic" # basic or advanced
    blockSuspiciousUA: true

  # Challenge page settings
  challengePage:
    title: "Security Check"
    # customHtmlPath: "/path/to/custom/challenge.html" # custom page

  # URLs that don't require verification
  skipUrls:
    - "/__under_attack_challenge"
    - "/favicon.ico"
    - "/robots.txt"
    - "/api/webhook/*" # wildcard support

  # Cookie name for token
  cookieName: "cf_clearance"

  # Header for bypassing verification (for trusted services)
  bypassHeader:
    name: "X-Bypass-UnderAttack"
    value: "secret-key-12345"
```

## How It Works

1. On first visit, the user receives a page with JavaScript verification
2. The script collects browser data and sends it to the server
3. The server validates the data for authenticity and absence of bot indicators
4. If verification passes, the client receives a token in a cookie
5. Subsequent requests with a valid token are allowed without verification

## Metrics

The module exports the following metrics:

- `waf_under_attack_challenge_shown` - number of times the challenge page was shown
- `waf_under_attack_challenge_passed` - number of successful verifications
- `waf_under_attack_challenge_failed` - number of failed verifications
- `waf_under_attack_challenge_rejected` - number of rejections due to suspicious activity
- `waf_under_attack_bypass_count` - number of verification bypasses via header
- `waf_under_attack_valid_token_count` - number of requests with a valid token
- `waf_under_attack_active_tokens` - current number of active tokens
