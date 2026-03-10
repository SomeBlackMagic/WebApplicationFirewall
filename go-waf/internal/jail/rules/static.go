package rules

import (
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

type StaticRule struct {
	cfg        config.StaticRuleConfig
	mu         sync.RWMutex
	blockedIPs map[string]struct{}
	stopCh     chan struct{}
	logger     *logging.Logger
}

func NewStaticRule(cfg config.StaticRuleConfig, logger *logging.Logger) *StaticRule {
	r := &StaticRule{
		cfg:        cfg,
		blockedIPs: make(map[string]struct{}),
		stopCh:     make(chan struct{}),
		logger:     logger.WithCategory("app.Jail.Rules.StaticRule"),
	}

	r.fetchData()

	if cfg.UpdateInterval > 0 {
		go r.updateLoop()
	}

	return r
}

func (r *StaticRule) Use(clientIP, country, city string, req *http.Request, requestID string) RuleResult {
	r.mu.RLock()
	_, blocked := r.blockedIPs[clientIP]
	r.mu.RUnlock()

	if blocked {
		r.logger.Debug("Reject request by static rule", "ip", clientIP)
		return RuleResult{Blocked: true}
	}
	return RuleResult{}
}

func (r *StaticRule) Stop() {
	close(r.stopCh)
}

func (r *StaticRule) updateLoop() {
	ticker := time.NewTicker(time.Duration(r.cfg.UpdateInterval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			r.fetchData()
		case <-r.stopCh:
			return
		}
	}
}

func (r *StaticRule) fetchData() {
	if r.cfg.LinkUrl == "" {
		return
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(r.cfg.LinkUrl)
	if err != nil {
		r.logger.Error("cannot fetch data from link", "url", r.cfg.LinkUrl, "error", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		r.logger.Error("cannot fetch data from link", "url", r.cfg.LinkUrl, "status", resp.StatusCode)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		r.logger.Error("cannot read response", "error", err)
		return
	}

	var ips []string
	if err := json.Unmarshal(body, &ips); err != nil {
		r.logger.Warn("cannot parse JSON from static rule", "url", r.cfg.LinkUrl, "error", err)
		return
	}

	if len(ips) == 0 {
		r.logger.Warn("blocked list not updated (empty)")
		return
	}

	newSet := make(map[string]struct{}, len(ips))
	for _, ip := range ips {
		newSet[ip] = struct{}{}
	}

	r.mu.Lock()
	r.blockedIPs = newSet
	r.mu.Unlock()

	r.logger.Info("Loaded static blacklist", "count", len(ips), "rule", r.cfg.Name)
}
