package jail

import (
	"fmt"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/jail/rules"
	"github.com/someblackmagic/web-application-firewall-go/internal/jail/storage"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
	"github.com/someblackmagic/web-application-firewall-go/internal/shared/types"
	"gopkg.in/yaml.v3"
)

type Manager struct {
	cfg           config.JailManagerConfig
	storage       storage.Storage
	mu            sync.RWMutex
	blockedLoaded map[string]*storage.BanInfo
	blockedAdded  map[string]*storage.BanInfo
	rules         []rules.Rule
	logger        *logging.Logger
	stopCh        chan struct{}
}

func NewManager(cfg config.JailManagerConfig, store storage.Storage, logger *logging.Logger) *Manager {
	return &Manager{
		cfg:           cfg,
		storage:       store,
		blockedLoaded: make(map[string]*storage.BanInfo),
		blockedAdded:  make(map[string]*storage.BanInfo),
		logger:        logger.WithCategory("app.Jail.JailManager"),
		stopCh:        make(chan struct{}),
	}
}

func (m *Manager) Bootstrap() error {
	if !m.cfg.Enabled {
		return nil
	}
	m.logger.Info("JailManager bootstrap")
	if err := m.loadRules(); err != nil {
		return err
	}
	m.loadDataFromStorage()

	loadInterval := time.Duration(types.Deref(m.cfg.LoadInterval, 30)) * time.Second
	flushInterval := time.Duration(types.Deref(m.cfg.FlushInterval, 30)) * time.Second

	go m.startLoadingLoop(loadInterval)
	go m.startFlushingLoop(flushInterval)

	return nil
}

func (m *Manager) Stop() {
	close(m.stopCh)
	if m.cfg.Enabled {
		m.flushDataToStorage()
	}
}

func (m *Manager) Check(clientIP, country, city string, r *http.Request, requestID string) bool {
	if !m.cfg.Enabled {
		return false
	}

	m.mu.RLock()
	blocked := m.getBlockedIPLocked(clientIP)
	m.mu.RUnlock()

	if blocked != nil && blocked.UnbanTime > time.Now().UnixMilli() {
		return true
	}

	for _, rule := range m.rules {
		result := rule.Use(clientIP, country, city, r, requestID)
		if result.Blocked && result.Ban == nil {
			return true
		}
		if result.Ban != nil {
			m.BlockIP(result.Ban.IP, result.Ban.Duration, result.Ban.EscalationRate, map[string]string{
				"ruleId":     result.Ban.RuleID,
				"country":    country,
				"city":       city,
				"requestIds": strings.Join(result.Ban.RequestIDs, ","),
			})
			return true
		}
	}

	return false
}

func (m *Manager) BlockIP(ip string, duration int, escalationRate float64, metadata map[string]string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.blockedAdded[ip]; !ok {
		if loaded, ok := m.blockedLoaded[ip]; ok {
			copied := *loaded
			copied.EscalationCount++
			m.blockedAdded[ip] = &copied
		} else {
			m.blockedAdded[ip] = &storage.BanInfo{
				IP:              ip,
				UnbanTime:       0,
				EscalationCount: 0,
				Metadata:        metadata,
			}
		}
	} else {
		m.blockedAdded[ip].EscalationCount++
	}

	m.blockedAdded[ip].Metadata = metadata
	banDuration := calculateBanTime(m.blockedAdded[ip].EscalationCount, duration, escalationRate)
	unbanTime := time.Now().UnixMilli() + int64(banDuration*1000)
	m.blockedAdded[ip].UnbanTime = unbanTime

	m.logger.Info(fmt.Sprintf("IP %s blocked until %s", ip, time.UnixMilli(unbanTime).UTC().Format(time.RFC3339)),
		"escalationCount", m.blockedAdded[ip].EscalationCount)

	if types.Deref(m.cfg.FlushAlways, false) {
		go m.flushDataToStorage()
	}
}

func (m *Manager) GetBlockedIP(ip string) *storage.BanInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.getBlockedIPLocked(ip)
}

func (m *Manager) GetAllBlockedIPs() []*storage.BanInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]*storage.BanInfo, 0, len(m.blockedLoaded))
	for _, v := range m.blockedLoaded {
		result = append(result, v)
	}
	return result
}

func (m *Manager) DeleteBlockedIP(ip string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	bi, ok := m.blockedLoaded[ip]
	if !ok {
		return false
	}
	bi.UnbanTime = time.Now().UnixMilli() - 1
	m.blockedAdded[ip] = bi
	return true
}

func (m *Manager) getBlockedIPLocked(ip string) *storage.BanInfo {
	if bi, ok := m.blockedAdded[ip]; ok {
		return bi
	}
	if bi, ok := m.blockedLoaded[ip]; ok {
		return bi
	}
	return nil
}

func (m *Manager) loadRules() error {
	m.rules = nil
	for _, rc := range m.cfg.FilterRules {
		switch rc.Type {
		case "composite":
			var cfg config.CompositeRuleConfig
			if err := rc.Raw.Decode(&cfg); err != nil {
				return fmt.Errorf("decode composite rule %s: %w", rc.Name, err)
			}
			m.rules = append(m.rules, rules.NewCompositeRule(cfg, m.logger))
		case "flexible":
			var cfg config.FlexibleRuleConfig
			if err := rc.Raw.Decode(&cfg); err != nil {
				return fmt.Errorf("decode flexible rule %s: %w", rc.Name, err)
			}
			m.rules = append(m.rules, rules.NewFlexibleRule(cfg, m.logger))
		case "static":
			var cfg config.StaticRuleConfig
			if err := rc.Raw.Decode(&cfg); err != nil {
				return fmt.Errorf("decode static rule %s: %w", rc.Name, err)
			}
			m.rules = append(m.rules, rules.NewStaticRule(cfg, m.logger))
		default:
			return fmt.Errorf("unknown rule type: %s", rc.Type)
		}
	}
	m.logger.Info("Loaded filter rules", "count", len(m.rules))
	return nil
}

func (m *Manager) loadDataFromStorage() {
	items, err := m.storage.Load()
	if err != nil {
		m.logger.Error("cannot load data from storage", "error", err)
		return
	}
	m.logger.Info("Loaded IPs from storage", "count", len(items))

	m.mu.Lock()
	defer m.mu.Unlock()
	m.blockedLoaded = make(map[string]*storage.BanInfo, len(items))
	for i := range items {
		m.blockedLoaded[items[i].IP] = &items[i]
	}
}

func (m *Manager) flushDataToStorage() {
	m.mu.Lock()
	sendData := make([]storage.BanInfo, 0, len(m.blockedAdded))
	for _, v := range m.blockedAdded {
		sendData = append(sendData, *v)
	}
	if len(sendData) == 0 {
		m.mu.Unlock()
		return
	}
	oldData := make([]storage.BanInfo, 0, len(m.blockedLoaded))
	for _, v := range m.blockedLoaded {
		oldData = append(oldData, *v)
	}
	m.mu.Unlock()

	m.logger.Info("Flushing IPs to storage", "count", len(sendData))
	if err := m.storage.Save(sendData, oldData); err != nil {
		m.logger.Error("cannot save data to storage", "error", err)
		return
	}

	m.mu.Lock()
	for _, item := range sendData {
		delete(m.blockedAdded, item.IP)
		m.blockedLoaded[item.IP] = func() *storage.BanInfo { copy := item; return &copy }()
	}
	m.mu.Unlock()
}

func (m *Manager) startLoadingLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			m.loadDataFromStorage()
		case <-m.stopCh:
			return
		}
	}
}

func (m *Manager) startFlushingLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			m.flushDataToStorage()
		case <-m.stopCh:
			return
		}
	}
}

func calculateBanTime(hitCount, baseDuration int, rate float64) float64 {
	return float64(baseDuration) * math.Pow(rate, float64(hitCount+1))
}

// Ensure yaml import is used
var _ = yaml.Node{}
