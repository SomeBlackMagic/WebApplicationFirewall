package config

type UnderAttackConfig struct {
	Enabled             *bool                      `yaml:"enabled,omitempty" json:"enabled,omitempty"`
	Mode                *string                    `yaml:"mode,omitempty" json:"mode,omitempty"`
	ChallengeDurationMs *int64                     `yaml:"challengeDurationMs,omitempty" json:"challengeDurationMs,omitempty"`
	Conditions          []map[string]any           `yaml:"conditions,omitempty" json:"conditions,omitempty"`
	FingerprintChecks   *FingerprintValidatorConfig `yaml:"fingerprintChecks,omitempty" json:"fingerprintChecks,omitempty"`
	ChallengeManager    *ChallengeManagerConfig    `yaml:"challengeManager,omitempty" json:"challengeManager,omitempty"`
	ChallengePage       *ChallengePageConfig       `yaml:"challengePage,omitempty" json:"challengePage,omitempty"`
	SkipURLs            []string                   `yaml:"skipUrls,omitempty" json:"skipUrls,omitempty"`
	CookieName          *string                    `yaml:"cookieName,omitempty" json:"cookieName,omitempty"`
	BypassHeaders       []BypassHeader             `yaml:"bypassHeaders,omitempty" json:"bypassHeaders,omitempty"`
}

type FingerprintValidatorConfig struct {
	Enabled  bool    `yaml:"enabled" json:"enabled"`
	MinScore float64 `yaml:"minScore" json:"minScore"`
}

type ChallengeManagerConfig struct { AutoCleanup bool `yaml:"autoCleanup" json:"autoCleanup"`; AutoCleanupInterval int `yaml:"autoCleanupInterval" json:"autoCleanupInterval"` }
type ChallengePageConfig struct { Title string `yaml:"title" json:"title"`; Path string `yaml:"path" json:"path"` }
type BypassHeader struct { Name string `yaml:"name" json:"name"`; Value string `yaml:"value" json:"value"` }
