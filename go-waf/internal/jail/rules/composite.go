package rules

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

type counterItem struct {
	time      int64
	requestID string
}

type CompositeRule struct {
	cfg      config.CompositeRuleConfig
	mu       sync.Mutex
	counters map[string][]counterItem
	logger   *logging.Logger
}

func NewCompositeRule(cfg config.CompositeRuleConfig, logger *logging.Logger) *CompositeRule {
	return &CompositeRule{
		cfg:      cfg,
		counters: make(map[string][]counterItem),
		logger:   logger.WithCategory("app.Jail.Rules.CompositeRule"),
	}
}

func (r *CompositeRule) Use(clientIP, country, city string, req *http.Request, requestID string) RuleResult {
	if !CheckConditions(r.cfg.Conditions, req, country, city) {
		return RuleResult{}
	}

	keyParts := make([]string, len(r.cfg.UniqueClientKey))
	for i, key := range r.cfg.UniqueClientKey {
		switch key {
		case "ip":
			keyParts[i] = clientIP
		case "user-agent":
			ua := req.Header.Get("User-Agent")
			if ua == "" {
				ua = "user-agent-not-detected"
			}
			keyParts[i] = ua
		case "hostname":
			keyParts[i] = req.Host
		case "url":
			keyParts[i] = req.URL.Path
		case "geo-country":
			keyParts[i] = country
		case "geo-city":
			keyParts[i] = city
		default:
			keyParts[i] = "-"
		}
	}
	compositeKey := strings.Join(keyParts, "|")

	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now().UnixMilli()
	period := r.cfg.Period
	if period == 0 {
		period = 60
	}
	periodMs := int64(period) * 1000

	entries := r.counters[compositeKey]
	filtered := entries[:0]
	for _, e := range entries {
		if now-e.time <= periodMs {
			filtered = append(filtered, e)
		}
	}
	filtered = append(filtered, counterItem{time: now, requestID: requestID})
	r.counters[compositeKey] = filtered

	limit := r.cfg.Limit
	if limit == 0 {
		limit = 100
	}

	if len(filtered) >= limit {
		requestIDs := make([]string, len(filtered))
		for i, e := range filtered {
			requestIDs[i] = e.requestID
		}
		r.counters[compositeKey] = nil

		escalationRate := r.cfg.EscalationRate
		if escalationRate == 0 {
			escalationRate = 1.0
		}

		r.logger.Info("Composite rule triggered", "rule", r.cfg.Name, "ip", clientIP, "key", compositeKey, "count", len(filtered))
		return RuleResult{
			Blocked: true,
			Ban: &BannedIPItem{
				RuleID:         "composite:" + r.cfg.Name,
				IP:             clientIP,
				Duration:       r.cfg.Duration,
				EscalationRate: escalationRate,
				RequestIDs:     requestIDs,
			},
		}
	}

	return RuleResult{}
}
