package metrics

import (
	"crypto/md5"
	"fmt"
	"os"
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/pkg/envx"
)

type Registry struct {
	reg     *prometheus.Registry
	enabled bool
}

func NewRegistry(cfg config.MetricsConfig) *Registry {
	return &Registry{
		reg:     prometheus.NewRegistry(),
		enabled: cfg.Enabled,
	}
}

func (r *Registry) Bootstrap() {
	if !r.enabled {
		return
	}

	instanceID := envx.Env("WAF_INSTANCE_ID", fmt.Sprintf("%x", md5.Sum([]byte(strconv.Itoa(os.Getpid())))))

	r.reg.MustRegister(
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{
			Namespace: "waf",
		}),
	)

	_ = instanceID
}

func (r *Registry) IsEnabled() bool {
	return r.enabled
}

func (r *Registry) Prometheus() *prometheus.Registry {
	return r.reg
}
