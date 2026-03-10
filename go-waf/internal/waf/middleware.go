package waf

import (
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/jail"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
	"github.com/someblackmagic/web-application-firewall-go/internal/shared/types"
	"github.com/someblackmagic/web-application-firewall-go/internal/underattack"
)

type WAFMiddleware struct {
	cfg            config.WAFMiddlewareConfig
	clientDetector *ClientDetector
	whitelist      *StaticFilter
	blacklist      *StaticFilter
	jailManager    *jail.Manager
	underAttack    *underattack.Middleware
	logger         *logging.Logger
}

func NewWAFMiddleware(
	cfg config.WAFMiddlewareConfig,
	clientDetector *ClientDetector,
	whitelist, blacklist *StaticFilter,
	jailManager *jail.Manager,
	underAttack *underattack.Middleware,
	logger *logging.Logger,
) *WAFMiddleware {
	return &WAFMiddleware{
		cfg:            cfg,
		clientDetector: clientDetector,
		whitelist:      whitelist,
		blacklist:      blacklist,
		jailManager:    jailManager,
		underAttack:    underAttack,
		logger:         logger.WithCategory("app.WAFMiddleware"),
	}
}

func (m *WAFMiddleware) Bootstrap() {
	m.logger.Info("WAF Middleware bootstrap")
	m.underAttack.Bootstrap()

	if m.cfg.BannedResponse != nil && m.cfg.BannedResponse.HTMLLink != nil && *m.cfg.BannedResponse.HTMLLink != "" {
		go m.loadBannedHTML(*m.cfg.BannedResponse.HTMLLink)
	}
}

func (m *WAFMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientIP := m.clientDetector.DetectIP(r)
		country := m.clientDetector.DetectCountry(r, clientIP)
		city := m.clientDetector.DetectCity(r, clientIP)
		requestID := m.clientDetector.DetectRequestID(r)

		// Whitelist check
		if m.whitelist.Check(clientIP, country, city) {
			next.ServeHTTP(w, r)
			return
		}

		// Blacklist check
		if m.blacklist.Check(clientIP, country, city) {
			m.logger.Debug("Request from blacklist IP rejected", "ip", clientIP, "country", country, "city", city)
			if m.shouldReject(w, r) {
				return
			}
			next.ServeHTTP(w, r)
			return
		}

		// UnderAttack check
		if !m.underAttack.Handle(w, r, clientIP, country, city, requestID) {
			return
		}

		// Jail check
		if m.jailManager.Check(clientIP, country, city, r, requestID) {
			m.logger.Debug("Request from jail IP rejected", "ip", clientIP, "country", country, "city", city)
			if m.shouldReject(w, r) {
				return
			}
			next.ServeHTTP(w, r)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// shouldReject sends a reject response in active mode and returns true.
// In audit mode it logs a warning and returns false (caller should forward to proxy).
func (m *WAFMiddleware) shouldReject(w http.ResponseWriter, r *http.Request) bool {
	mode := types.Deref(m.cfg.Mode, "audit")
	if mode == "audit" {
		m.logger.Warn("Request passed to proxy in audit mode")
		return false
	}

	var code int
	var jsonBody, htmlBody string

	if m.cfg.BannedResponse != nil {
		code = types.Deref(m.cfg.BannedResponse.HTTPCode, 429)
		jsonBody = m.cfg.BannedResponse.JSON
		htmlBody = types.Deref(m.cfg.BannedResponse.HTML, "<h1>Banned</h1>")
	} else {
		code = 429
		jsonBody = `{"message":"Banned","error":"Banned"}`
		htmlBody = "<h1>Banned</h1>"
	}

	CreateRejectResponse(w, r, mode, &code, jsonBody, htmlBody)
	return true
}

func (m *WAFMiddleware) loadBannedHTML(source string) {
	var data []byte
	var err error

	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
		var resp *http.Response
		resp, err = http.Get(source)
		if err != nil {
			m.logger.Error("Cannot load banned HTML", "source", source, "error", err)
			return
		}
		defer resp.Body.Close()
		data, err = io.ReadAll(resp.Body)
	} else {
		data, err = os.ReadFile(source)
	}

	if err != nil {
		m.logger.Error("Cannot read banned HTML content", "source", source, "error", err)
		return
	}

	m.cfg.BannedResponse.HTML = types.Ptr(string(data))
	m.logger.Info("Loaded banned response HTML", "source", source)
}
