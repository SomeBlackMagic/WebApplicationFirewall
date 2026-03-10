package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

func NewReverseProxy(targetHost string, logger *logging.Logger) (http.Handler, error) {
	target, err := url.Parse(targetHost)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	originalDirector := proxy.Director
	proxy.Director = func(r *http.Request) {
		originalDirector(r)
		r.Host = target.Host
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logger.Error("Proxy error", "error", err, "url", r.URL.String())
		w.WriteHeader(http.StatusBadGateway)
	}

	return proxy, nil
}
