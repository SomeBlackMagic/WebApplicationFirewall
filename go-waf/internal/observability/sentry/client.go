package sentry

import (
	"os"
	"time"

	sentrylib "github.com/getsentry/sentry-go"
	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/shared/types"
)

type Client struct {
	enabled bool
	debug   bool
}

func NewClient(cfg config.SentryConfig, release string) (*Client, error) {
	c := &Client{
		enabled: cfg.Enabled,
		debug:   types.Deref(cfg.Debug, false),
	}

	if !cfg.Enabled {
		return c, nil
	}

	dsn := types.Deref(cfg.DSN, "")
	hostname, _ := os.Hostname()

	err := sentrylib.Init(sentrylib.ClientOptions{
		Dsn:              dsn,
		ServerName:       hostname,
		Release:          release,
		Debug:            c.debug,
		TracesSampleRate: 1.0,
	})
	if err != nil {
		return nil, err
	}

	return c, nil
}

func (c *Client) CaptureException(err error) {
	if !c.enabled {
		return
	}
	sentrylib.CaptureException(err)
}

func (c *Client) Flush(timeout time.Duration) {
	if !c.enabled {
		return
	}
	sentrylib.Flush(timeout)
}
