package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/someblackmagic/web-application-firewall-go/pkg/authx"
)

func (r *Registry) Handler(auth *authx.BasicAuth) http.Handler {
	handler := promhttp.HandlerFor(r.reg, promhttp.HandlerOpts{})
	if auth != nil && auth.Enabled {
		return auth.Middleware(handler)
	}
	return handler
}
