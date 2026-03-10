package underattack

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
	"github.com/someblackmagic/web-application-firewall-go/internal/shared/types"
	"github.com/someblackmagic/web-application-firewall-go/internal/underattack/challenge"
	"github.com/someblackmagic/web-application-firewall-go/internal/underattack/fingerprint"
)

type Middleware struct {
	cfg                  *config.UnderAttackConfig
	challengeHTML        string
	fingerprintValidator *fingerprint.Validator
	challengeManager     *challenge.Manager
	conditions           *Conditions
	logger               *logging.Logger
	secretKey            string
}

func NewMiddleware(cfg *config.UnderAttackConfig, logger *logging.Logger) *Middleware {
	if cfg == nil {
		cfg = &config.UnderAttackConfig{}
	}

	secretKey := os.Getenv("WAF_ENCTIPRION_SECRET_KEY")
	if secretKey == "" {
		secretKey = "default-secret-key"
	}

	m := &Middleware{
		cfg:       cfg,
		logger:    logger.WithCategory("app.UnderAttack"),
		secretKey: secretKey,
	}

	var fpEnabled bool
	var fpMinScore float64
	if cfg.FingerprintChecks != nil {
		fpEnabled = cfg.FingerprintChecks.Enabled
		fpMinScore = cfg.FingerprintChecks.MinScore
	}
	m.fingerprintValidator = fingerprint.NewValidator(fpEnabled, fpMinScore, logger)
	m.challengeManager = challenge.NewManager(logger)

	if len(cfg.Conditions) > 0 {
		m.conditions = NewConditions(cfg.Conditions)
	}

	return m
}

func (m *Middleware) Bootstrap() {
	if !types.Deref(m.cfg.Enabled, false) {
		return
	}
	m.logger.Info("UnderAttackMiddleware bootstrap")
	m.loadChallengeHTML()
}

func (m *Middleware) Handle(w http.ResponseWriter, r *http.Request, clientIP, country, city, requestID string) bool {
	if !types.Deref(m.cfg.Enabled, false) {
		return true
	}

	// Check conditions
	if m.conditions != nil {
		if !m.conditions.Check(r, country, city) {
			return true
		}
	}

	// Handle challenge POST
	if r.Method == "POST" && r.URL.Path == "/__under_attack_challenge" {
		m.handleChallengeRequest(w, r, clientIP, requestID)
		return false
	}

	// Skip URLs
	if m.shouldSkipURL(r.URL.Path) {
		return true
	}

	// Check bypass headers
	if m.checkBypassHeader(r) {
		return true
	}

	// Check existing token cookie
	cookieName := types.Deref(m.cfg.CookieName, "waf")
	if cookie, err := r.Cookie(cookieName); err == nil && cookie.Value != "" {
		if m.validateToken(cookie.Value) {
			return true
		}
	}

	// Show challenge page
	challengeData := m.challengeManager.GenerateChallengeProblem(clientIP, requestID)
	challengeJSON, _ := json.Marshal(challengeData)

	html := strings.Replace(m.challengeHTML, "__CHALLENGE_DATA___", string(challengeJSON), 1)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(html))
	return false
}

func (m *Middleware) Stop() {
	if m.challengeManager != nil {
		m.challengeManager.Stop()
	}
}

func (m *Middleware) loadChallengeHTML() {
	var path string
	if m.cfg.ChallengePage != nil && m.cfg.ChallengePage.Path != "" {
		path = m.cfg.ChallengePage.Path
	} else {
		path = "pages/challenge/index.min.html"
	}

	data, err := os.ReadFile(path)
	if err != nil {
		m.logger.Error("Cannot load challenge page", "path", path, "error", err)
		m.challengeHTML = "<html><body><h1>Security Check</h1></body></html>"
		return
	}

	cookieName := types.Deref(m.cfg.CookieName, "waf")
	title := "WAF Security check"
	if m.cfg.ChallengePage != nil && m.cfg.ChallengePage.Title != "" {
		title = m.cfg.ChallengePage.Title
	}

	html := string(data)
	html = strings.Replace(html, "__COOKIE__", cookieName, 1)
	html = strings.Replace(html, "__TITTLE__", title, 1)
	m.challengeHTML = html

	m.logger.Info("Loaded challenge page", "path", path)
}

func (m *Middleware) shouldSkipURL(path string) bool {
	for _, pattern := range m.cfg.SkipURLs {
		if strings.Contains(pattern, "*") {
			regexPattern := strings.ReplaceAll(pattern, "*", ".*")
			// Simple glob matching
			if matchGlob(regexPattern, path) {
				return true
			}
		} else if pattern == path {
			return true
		}
	}
	return false
}

func matchGlob(pattern, s string) bool {
	// Simple glob match: convert * to .* and match
	// For production, use a proper glob library
	if pattern == ".*" {
		return true
	}
	return strings.HasPrefix(s, strings.TrimSuffix(pattern, ".*"))
}

func (m *Middleware) checkBypassHeader(r *http.Request) bool {
	for _, h := range m.cfg.BypassHeaders {
		if r.Header.Get(h.Name) == h.Value {
			return true
		}
	}
	return false
}

func (m *Middleware) validateToken(token string) bool {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return false
	}

	data := parts[0]
	signature := parts[1]

	payloadBytes, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		// Try RawStdEncoding (no padding)
		payloadBytes, err = base64.RawStdEncoding.DecodeString(data)
		if err != nil {
			return false
		}
	}

	var payload struct {
		Exp int64 `json:"exp"`
		Iat int64 `json:"iat"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return false
	}

	if payload.Exp < time.Now().UnixMilli() {
		return false
	}

	expectedSig := m.computeHMAC(data)
	return signature == expectedSig
}

func (m *Middleware) generateToken() string {
	now := time.Now().UnixMilli()
	durationMs := types.Deref(m.cfg.ChallengeDurationMs, int64(1800000))

	payload := map[string]int64{
		"exp": now + durationMs,
		"iat": now,
	}

	payloadJSON, _ := json.Marshal(payload)
	data := base64.StdEncoding.EncodeToString(payloadJSON)
	signature := m.computeHMAC(data)
	return data + "." + signature
}

func (m *Middleware) computeHMAC(data string) string {
	mac := hmac.New(sha256.New, []byte(m.secretKey))
	mac.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func (m *Middleware) handleChallengeRequest(w http.ResponseWriter, r *http.Request, clientIP, requestID string) {
	var body struct {
		Fingerprint *fingerprint.BrowserFingerprint `json:"fingerprint"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}

	if body.Fingerprint == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}

	// Validate fingerprint
	if !m.fingerprintValidator.Validate(body.Fingerprint, requestID, "", "") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "Challenge failed"})
		return
	}

	token := m.generateToken()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "token": token})
}
