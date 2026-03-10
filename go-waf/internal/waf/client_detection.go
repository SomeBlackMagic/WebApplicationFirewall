package waf

import (
	"net"
	"net/http"
	"strings"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/geoip"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
	"github.com/someblackmagic/web-application-firewall-go/internal/shared/types"
)

var realIPHeadersList = []string{
	"x-original-forwarded-for",
	"x-original-real-ip",
	"x-client-ip",
	"x-forwarded",
	"x-remote-ip",
	"x-remote-addr",
	"x-proxyuser-ip",
	"true-client-ip",
	"x-real-ip",
	"x-forwarded-for",
	"x-cluster-client-ip",
	"forwarded-for",
	"forwarded",
	"client-ip",
	"x-forwarded-for-ip",
}

type ClientDetector struct {
	ipHeaders       []string
	countryMethod   string
	countryHeader   string
	cityMethod      string
	cityHeader      string
	requestIDHeader string
	geoIP           *geoip.Service
	logger          *logging.Logger
}

func NewClientDetector(cfg config.WAFMiddlewareConfig, geoIP *geoip.Service, logger *logging.Logger) *ClientDetector {
	d := &ClientDetector{
		geoIP:  geoIP,
		logger: logger.WithCategory("app.WAFMiddleware.ClientDetector"),
	}

	if cfg.DetectClientIP != nil {
		d.ipHeaders = append(cfg.DetectClientIP.Headers, realIPHeadersList...)
	} else {
		d.ipHeaders = realIPHeadersList
	}

	if cfg.DetectClientCountry != nil {
		d.countryMethod = cfg.DetectClientCountry.Method
		d.countryHeader = types.Deref(cfg.DetectClientCountry.Header, "")
	} else {
		d.countryMethod = "geoip"
	}

	if cfg.DetectClientCity != nil {
		d.cityMethod = cfg.DetectClientCity.Method
		d.cityHeader = types.Deref(cfg.DetectClientCity.Header, "")
	} else {
		d.cityMethod = "geoip"
	}

	d.requestIDHeader = types.Deref(cfg.DetectClientRequestID.Header, "x-request-id")

	return d
}

func (d *ClientDetector) DetectIP(r *http.Request) string {
	for _, header := range d.ipHeaders {
		v := r.Header.Get(header)
		if v != "" {
			return fetchFirstIP(v)
		}
	}

	// Fallback to RemoteAddr
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (d *ClientDetector) DetectCountry(r *http.Request, ip string) string {
	switch d.countryMethod {
	case "header":
		v := r.Header.Get(d.countryHeader)
		if v != "" {
			return v
		}
		return "not-detected"
	case "geoip":
		if d.geoIP != nil {
			return d.geoIP.GetCountry(ip)
		}
		return "not-detected"
	default:
		d.logger.Error("Unsupported country detection method", "method", d.countryMethod)
		return "not-detected"
	}
}

func (d *ClientDetector) DetectCity(r *http.Request, ip string) string {
	switch d.cityMethod {
	case "header":
		v := r.Header.Get(d.cityHeader)
		if v != "" {
			return v
		}
		return "not-detected"
	case "geoip":
		if d.geoIP != nil {
			return d.geoIP.GetCity(ip)
		}
		return "not-detected"
	default:
		d.logger.Error("Unsupported city detection method", "method", d.cityMethod)
		return "not-detected"
	}
}

func (d *ClientDetector) DetectRequestID(r *http.Request) string {
	v := r.Header.Get(d.requestIDHeader)
	if v != "" {
		return v
	}
	return "not-detected"
}

func fetchFirstIP(s string) string {
	parts := strings.SplitN(s, ",", 2)
	return strings.TrimSpace(parts[0])
}
