package botdetector

import (
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

// Detector is the bot detection component.
// Note: In the TS source, bot detection is commented out in the middleware.
// This implementation is wired but disabled by default, matching TS behavior.
type Detector struct {
	enabled bool
	logger  *logging.Logger
}

func NewDetector(cfg Config, logger *logging.Logger) *Detector {
	return &Detector{
		enabled: cfg.Enabled,
		logger:  logger.WithCategory("app.UnderAttack.BotDetector"),
	}
}

func (d *Detector) IsEnabled() bool {
	return d.enabled
}
