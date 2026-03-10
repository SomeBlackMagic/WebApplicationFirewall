package config

import (
	"encoding/json"

	"github.com/someblackmagic/web-application-firewall-go/internal/shared/types"
)

func ApplyDefaults(cfg *AppConfig) {
	if cfg.WAFMiddleware.Mode == nil {
		cfg.WAFMiddleware.Mode = types.Ptr("audit")
	}

	if cfg.WAFMiddleware.BannedResponse == nil {
		cfg.WAFMiddleware.BannedResponse = &BannedResponseConfig{}
	}
	br := cfg.WAFMiddleware.BannedResponse
	if br.HTTPCode == nil {
		br.HTTPCode = types.Ptr(429)
	}
	if br.JSON == "" {
		msg, _ := json.Marshal(map[string]string{
			"message": "You have been banned for too many attempts or suspicious activity.",
			"error":   "Banned",
		})
		br.JSON = string(msg)
	}
	if br.HTML == nil {
		br.HTML = types.Ptr("<h1>You have been banned for too many attempts or suspicious activity.</h1>")
	}

	if cfg.WAFMiddleware.DetectClientIP == nil {
		cfg.WAFMiddleware.DetectClientIP = &DetectClientIPConfig{}
	}

	if cfg.WAFMiddleware.DetectClientCountry == nil {
		cfg.WAFMiddleware.DetectClientCountry = &DetectClientCountryConfig{Method: "geoip"}
	}
	if cfg.WAFMiddleware.DetectClientCountry.Method == "" {
		cfg.WAFMiddleware.DetectClientCountry.Method = "geoip"
	}

	if cfg.WAFMiddleware.DetectClientCity == nil {
		cfg.WAFMiddleware.DetectClientCity = &DetectClientCityConfig{Method: "geoip"}
	}
	if cfg.WAFMiddleware.DetectClientCity.Method == "" {
		cfg.WAFMiddleware.DetectClientCity.Method = "geoip"
	}

	if cfg.WAFMiddleware.DetectClientRequestID == nil {
		cfg.WAFMiddleware.DetectClientRequestID = &DetectClientRequestIDConfig{}
	}
	if cfg.WAFMiddleware.DetectClientRequestID.Header == nil {
		cfg.WAFMiddleware.DetectClientRequestID.Header = types.Ptr("x-request-id")
	}

	if cfg.JailManager.Storage == nil {
		cfg.JailManager.Storage = &JailStorageConfig{}
	}
	if cfg.JailManager.Storage.Driver == nil {
		cfg.JailManager.Storage.Driver = types.Ptr("memory")
	}
	if cfg.JailManager.LoadInterval == nil {
		cfg.JailManager.LoadInterval = types.Ptr(30)
	}
	if cfg.JailManager.FlushInterval == nil {
		cfg.JailManager.FlushInterval = types.Ptr(30)
	}

	if cfg.WAFMiddleware.UnderAttack == nil {
		cfg.WAFMiddleware.UnderAttack = &UnderAttackConfig{}
	}
	ua := cfg.WAFMiddleware.UnderAttack
	if ua.Enabled == nil {
		ua.Enabled = types.Ptr(false)
	}
	if ua.ChallengeDurationMs == nil {
		ua.ChallengeDurationMs = types.Ptr(int64(1800000))
	}
	if ua.CookieName == nil {
		ua.CookieName = types.Ptr("waf")
	}
}
