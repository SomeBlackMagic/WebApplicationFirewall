package app

import (
	"fmt"
	"net/http"
	"os"

	"github.com/someblackmagic/web-application-firewall-go/internal/api/http/handlers"
	"github.com/someblackmagic/web-application-firewall-go/internal/api/http/routes"
	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/geoip"
	"github.com/someblackmagic/web-application-firewall-go/internal/jail"
	"github.com/someblackmagic/web-application-firewall-go/internal/jail/storage"
	"github.com/someblackmagic/web-application-firewall-go/internal/metrics"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/sentry"
	"github.com/someblackmagic/web-application-firewall-go/internal/proxy"
	"github.com/someblackmagic/web-application-firewall-go/internal/shared/types"
	"github.com/someblackmagic/web-application-firewall-go/internal/underattack"
	"github.com/someblackmagic/web-application-firewall-go/internal/waf"
	"github.com/someblackmagic/web-application-firewall-go/pkg/authx"
)

const version = "dev"

func Run() {
	// 1. Logger
	logger := logging.NewLogger()
	logger.Info("Start Application", "version", version)

	// 2. Load config
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("Failed to load config", "error", err)
	}

	// 3. Sentry
	sentryClient, err := sentry.NewClient(cfg.Sentry, version)
	if err != nil {
		logger.Error("Failed to init Sentry", "error", err)
	}

	// 4. GeoIP
	geoipSvc, err := geoip.NewService()
	if err != nil {
		logger.Warn("GeoIP service unavailable, using header-based detection", "error", err)
	}

	// 5. Metrics
	metricsReg := metrics.NewRegistry(cfg.Metrics)
	metricsReg.Bootstrap()

	// 6. Create storage
	store := createStorage(cfg.JailManager.Storage, logger)

	// 7. JailManager
	jailMgr := jail.NewManager(cfg.JailManager, store, metricsReg.Prometheus(), logger)
	if err := jailMgr.Bootstrap(); err != nil {
		logger.Fatal("Failed to bootstrap JailManager", "error", err)
	}

	// 8. Static filters
	var whitelistCfg *config.StaticFilterConfig
	if cfg.WAFMiddleware.Whitelist != nil {
		whitelistCfg = &cfg.WAFMiddleware.Whitelist.StaticFilterConfig
	}
	var blacklistCfg *config.StaticFilterConfig
	if cfg.WAFMiddleware.Blacklist != nil {
		blacklistCfg = &cfg.WAFMiddleware.Blacklist.StaticFilterConfig
	}
	whitelist := waf.NewStaticFilter(whitelistCfg, logger)
	blacklist := waf.NewStaticFilter(blacklistCfg, logger)

	// 9. UnderAttack middleware
	underAttackMw := underattack.NewMiddleware(cfg.WAFMiddleware.UnderAttack, logger)

	// 10. Client detector
	detector := waf.NewClientDetector(cfg.WAFMiddleware, geoipSvc, logger)

	// 11. WAF Middleware
	wafMw := waf.NewWAFMiddleware(cfg.WAFMiddleware, detector, whitelist, blacklist, jailMgr, underAttackMw, logger)
	wafMw.Bootstrap()

	// 12. Reverse proxy
	if cfg.Proxy.Host == "" {
		logger.Fatal("Proxy host is not set")
	}
	proxyHandler, err := proxy.NewReverseProxy(cfg.Proxy.Host, logger)
	if err != nil {
		logger.Fatal("Failed to create reverse proxy", "error", err)
	}

	// 13. Create handlers
	healthH := handlers.NewHealthHandler()
	jailH := handlers.NewJailHandler(jailMgr)
	apiAuth := authx.NewBasicAuth(cfg.API.Auth)
	metricsAuth := authx.NewBasicAuth(cfg.Metrics.Auth)
	metricsH := handlers.NewMetricsHandler(metricsReg, metricsAuth)

	// 14. Register routes
	mux := http.NewServeMux()
	wafHandler := wafMw.Handler(proxyHandler)
	routes.Register(mux, healthH, jailH, metricsH, apiAuth, wafHandler)

	// 15. Start server
	port := 3000
	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}

	go func() {
		logger.Info("WAF server started", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server error", "error", err)
		}
	}()

	// 16. Wait for shutdown
	WaitForShutdown(server, jailMgr, sentryClient, underAttackMw, logger)
}

func createStorage(cfg *config.JailStorageConfig, logger *logging.Logger) storage.Storage {
	driver := types.Deref(cfg.Driver, "memory")
	switch driver {
	case "file":
		var filePath string
		if cfgMap, ok := cfg.DriverConfig.(map[string]interface{}); ok {
			if fp, ok := cfgMap["filePath"].(string); ok {
				filePath = fp
			}
		}
		return storage.NewFileStorage(filePath, logger)
	case "operator":
		var apiHost, agentID string
		if cfgMap, ok := cfg.DriverConfig.(map[string]interface{}); ok {
			apiHost, _ = cfgMap["apiHost"].(string)
			agentID, _ = cfgMap["agentId"].(string)
		}
		return storage.NewOperatorStorage(apiHost, agentID, logger)
	default:
		if driver != "memory" {
			logger.Warn("Unknown storage driver, using memory", "driver", driver)
		}
		return storage.NewMemoryStorage()
	}
}

// Suppress unused import warning
var _ = os.Getenv
