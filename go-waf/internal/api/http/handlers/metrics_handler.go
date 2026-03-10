package handlers

import (
	"net/http"

	"github.com/someblackmagic/web-application-firewall-go/internal/metrics"
	"github.com/someblackmagic/web-application-firewall-go/pkg/authx"
)

type MetricsHandler struct {
	handler http.Handler
}

func NewMetricsHandler(registry *metrics.Registry, auth *authx.BasicAuth) *MetricsHandler {
	return &MetricsHandler{
		handler: registry.Handler(auth),
	}
}

func (h *MetricsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.handler.ServeHTTP(w, r)
}
