package config

type WAFMiddlewareConfig struct {
	Mode                  *string                    `yaml:"mode,omitempty" json:"mode,omitempty"`
	Whitelist             *WhitelistConfig           `yaml:"whitelist,omitempty" json:"whitelist,omitempty"`
	Blacklist             *BlacklistConfig           `yaml:"blacklist,omitempty" json:"blacklist,omitempty"`
	UnderAttack           *UnderAttackConfig         `yaml:"underAttack,omitempty" json:"underAttack,omitempty"`
	BannedResponse        *BannedResponseConfig      `yaml:"bannedResponse,omitempty" json:"bannedResponse,omitempty"`
	DetectClientIP        *DetectClientIPConfig      `yaml:"detectClientIp,omitempty" json:"detectClientIp,omitempty"`
	DetectClientCountry   *DetectClientCountryConfig `yaml:"detectClientCountry,omitempty" json:"detectClientCountry,omitempty"`
	DetectClientCity      *DetectClientCityConfig    `yaml:"detectClientCity,omitempty" json:"detectClientCity,omitempty"`
	DetectClientRequestID *DetectClientRequestIDConfig `yaml:"detectClientRequestId,omitempty" json:"detectClientRequestId,omitempty"`
}

type BannedResponseConfig struct {
	HTTPCode *int    `yaml:"httpCode,omitempty" json:"httpCode,omitempty"`
	JSON     string  `yaml:"json" json:"json"`
	HTML     *string `yaml:"html,omitempty" json:"html,omitempty"`
	HTMLLink *string `yaml:"htmlLink,omitempty" json:"htmlLink,omitempty"`
}

type DetectClientIPConfig struct { Headers []string `yaml:"headers,omitempty" json:"headers,omitempty"` }
type DetectClientCountryConfig struct { Method string `yaml:"method" json:"method"`; Header *string `yaml:"header,omitempty" json:"header,omitempty"` }
type DetectClientCityConfig struct { Method string `yaml:"method" json:"method"`; Header *string `yaml:"header,omitempty" json:"header,omitempty"` }
type DetectClientRequestIDConfig struct { Header *string `yaml:"header,omitempty" json:"header,omitempty"` }
