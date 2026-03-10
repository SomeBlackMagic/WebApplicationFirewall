package waf

import (
	"net"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

type StaticFilter struct {
	ips       map[string]struct{}
	cidrs     []*net.IPNet
	countries map[string]struct{}
	cities    map[string]struct{}
	logger    *logging.Logger
}

func NewStaticFilter(cfg *config.StaticFilterConfig, logger *logging.Logger) *StaticFilter {
	f := &StaticFilter{
		ips:       make(map[string]struct{}),
		countries: make(map[string]struct{}),
		cities:    make(map[string]struct{}),
		logger:    logger,
	}

	if cfg == nil {
		return f
	}

	for _, ip := range cfg.IPs {
		f.ips[ip] = struct{}{}
	}

	for _, cidr := range cfg.IPSubnet {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			logger.Warn("Invalid CIDR in static filter", "cidr", cidr, "error", err)
			continue
		}
		f.cidrs = append(f.cidrs, ipNet)
	}

	for _, c := range cfg.GeoCountry {
		f.countries[c] = struct{}{}
	}

	for _, c := range cfg.GeoCity {
		f.cities[c] = struct{}{}
	}

	return f
}

func (f *StaticFilter) Check(clientIP, country, city string) bool {
	if _, ok := f.ips[clientIP]; ok {
		return true
	}

	if ip := net.ParseIP(clientIP); ip != nil {
		for _, cidr := range f.cidrs {
			if cidr.Contains(ip) {
				return true
			}
		}
	}

	if _, ok := f.countries[country]; ok {
		return true
	}

	if _, ok := f.cities[city]; ok {
		return true
	}

	return false
}
