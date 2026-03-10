package rules

import (
	"net/http"
	"sync"
	"time"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

type FlexibleRule struct {
	cfg        config.FlexibleRuleConfig
	mu         sync.Mutex
	suspicions map[string][]counterItem
	logger     *logging.Logger
}

func NewFlexibleRule(cfg config.FlexibleRuleConfig, logger *logging.Logger) *FlexibleRule {
	return &FlexibleRule{
		cfg:        cfg,
		suspicions: make(map[string][]counterItem),
		logger:     logger.WithCategory("app.Jail.Rules.FlexibleRule"),
	}
}

func (r *FlexibleRule) Use(clientIP, country, city string, req *http.Request, requestID string) RuleResult {
	if !CheckConditions(r.cfg.Conditions, req, country, city) {
		return RuleResult{}
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now().UnixMilli()
	period := r.cfg.Period
	if period == 0 {
		period = 60
	}
	periodMs := int64(period) * 1000

	entries := r.suspicions[clientIP]
	filtered := entries[:0]
	for _, e := range entries {
		if now-e.time <= periodMs {
			filtered = append(filtered, e)
		}
	}
	filtered = append(filtered, counterItem{time: now, requestID: requestID})
	r.suspicions[clientIP] = filtered

	limit := r.cfg.Limit
	if limit == 0 {
		limit = 100
	}

	if len(filtered) >= limit {
		requestIDs := make([]string, len(filtered))
		for i, e := range filtered {
			requestIDs[i] = e.requestID
		}
		r.suspicions[clientIP] = nil

		escalationRate := r.cfg.EscalationRate
		if escalationRate == 0 {
			escalationRate = 1.0
		}

		r.logger.Info("Flexible rule triggered", "rule", r.cfg.Name, "ip", clientIP, "count", len(filtered))
		return RuleResult{
			Blocked: true,
			Ban: &BannedIPItem{
				RuleID:         "flexible:" + r.cfg.Name,
				IP:             clientIP,
				Duration:       r.cfg.Duration,
				EscalationRate: escalationRate,
				RequestIDs:     requestIDs,
			},
		}
	}

	return RuleResult{}
}
