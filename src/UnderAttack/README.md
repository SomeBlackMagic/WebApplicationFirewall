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

### Basic Challenge Metrics

- `waf_under_attack_challenge_shown` - number of times the challenge page was shown
- `waf_under_attack_challenge_passed` - number of successful verifications
- `waf_under_attack_challenge_failed` - number of failed verifications
- `waf_under_attack_challenge_rejected` - number of rejections due to suspicious activity
- `waf_under_attack_bypass_count` - number of verification bypasses via header
- `waf_under_attack_valid_token_count` - number of requests with a valid token
- `waf_under_attack_active_tokens` - current number of active tokens

### Bot Detection Metrics

- `waf_under_attack_bot_detection_total` - total number of bot detection checks performed
- `waf_under_attack_bot_detection_known_bot` - number of requests identified as known bots by User-Agent
- `waf_under_attack_bot_detection_suspicious_patterns` - number of requests identified as bots due to suspicious patterns
- `waf_under_attack_bot_detection_automation_headers` - number of requests identified as bots due to automation headers
- `waf_under_attack_bot_detection_timing_anomaly` - number of requests identified as bots due to challenge timing anomalies
- `waf_under_attack_bot_detection_client_data` - number of requests identified as bots based on client-side data
- `waf_under_attack_bot_detection_high_suspicion` - number of requests with high suspicion score
- `waf_under_attack_bot_suspicion_score` - histogram of bot suspicion scores (0-1)

### Fingerprint Validation Metrics

- `waf_under_attack_fingerprint_score` - histogram of fingerprint validation scores (0-100)
- `waf_under_attack_validation_short_fingerprint` - count of rejections due to short fingerprint
- `waf_under_attack_validation_missing_components` - count of rejections due to missing browser components
- `waf_under_attack_validation_missing_proofs` - count of rejections due to missing browser proofs
- `waf_under_attack_validation_inconsistencies` - count of rejections due to browser data inconsistencies
- `waf_under_attack_validation_screen_anomalies` - count of rejections due to screen anomalies

### Browser Proof Validation Metrics

- `waf_under_attack_proof_generation_time` - histogram of proof generation time in milliseconds
- `waf_under_attack_proof_canvas_failure` - count of Canvas proof validation failures
- `waf_under_attack_proof_webgl_failure` - count of WebGL proof validation failures
- `waf_under_attack_proof_timing_failure` - count of Timing proof validation failures
- `waf_under_attack_proof_performance_failure` - count of Performance proof validation failures
- `waf_under_attack_proof_css_failure` - count of CSS proof validation failures
