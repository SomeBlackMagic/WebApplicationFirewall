package config

type JailManagerConfig struct {
	Enabled       bool                 `yaml:"enabled" json:"enabled"`
	Storage       *JailStorageConfig   `yaml:"storage,omitempty" json:"storage,omitempty"`
	LoadInterval  *int                 `yaml:"loadInterval,omitempty" json:"loadInterval,omitempty"`
	FlushInterval *int                 `yaml:"flushInterval,omitempty" json:"flushInterval,omitempty"`
	FlushAlways   *bool                `yaml:"flushAlways,omitempty" json:"flushAlways,omitempty"`
	FilterRules   []AbstractRuleConfig `yaml:"filterRules" json:"filterRules"`
}

type JailStorageConfig struct {
	Driver       *string `yaml:"driver,omitempty" json:"driver,omitempty"`
	DriverConfig any     `yaml:"driverConfig,omitempty" json:"driverConfig,omitempty"`
}

type AbstractRuleConfig struct { Name string `yaml:"name" json:"name"`; Type string `yaml:"type" json:"type"` }
