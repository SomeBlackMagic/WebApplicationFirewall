package routes

import (
	"net/http"

	"github.com/someblackmagic/web-application-firewall-go/internal/api/http/handlers"
	apimw "github.com/someblackmagic/web-application-firewall-go/internal/api/http/middleware"
	"github.com/someblackmagic/web-application-firewall-go/pkg/authx"
)

func Register(
	mux *http.ServeMux,
	healthH *handlers.HealthHandler,
	jailH *handlers.JailHandler,
	metricsH *handlers.MetricsHandler,
	apiAuth *authx.BasicAuth,
	wafHandler http.Handler,
) {
	// Health endpoints (no auth)
	mux.HandleFunc("GET /waf/healthz", healthH.Healthz)
	mux.HandleFunc("GET /waf/health/liveness", healthH.Liveness)
	mux.HandleFunc("GET /waf/health/readiness", healthH.Readiness)

	// API endpoints (with auth)
	mux.Handle("GET /waf/jail-manager/baned-users", apimw.WrapHandlerFunc(apiAuth, jailH.GetBannedUsers))
	mux.Handle("DELETE /waf/jail-manager/baned-users", apimw.WrapHandlerFunc(apiAuth, jailH.DeleteBannedUser))

	// Metrics endpoint
	mux.Handle("GET /waf/metrics", metricsH)

	// All other traffic goes through WAF + proxy
	mux.Handle("/", wafHandler)
}
