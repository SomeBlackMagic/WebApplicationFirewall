package config

type HttpBasicAuthConfig struct {
	Enabled  bool    `yaml:"enabled" json:"enabled"`
	Username *string `yaml:"username,omitempty" json:"username,omitempty"`
	Password *string `yaml:"password,omitempty" json:"password,omitempty"`
}

type APIConfig struct {
	Auth HttpBasicAuthConfig `yaml:"auth" json:"auth"`
}

type MetricsConfig struct {
	Enabled bool                `yaml:"enabled" json:"enabled"`
	Auth    HttpBasicAuthConfig `yaml:"auth" json:"auth"`
}

type SentryConfig struct {
	Enabled bool    `yaml:"enabled" json:"enabled"`
	DSN     *string `yaml:"dsn,omitempty" json:"dsn,omitempty"`
	Release *string `yaml:"release,omitempty" json:"release,omitempty"`
	Debug   *bool   `yaml:"debug,omitempty" json:"debug,omitempty"`
}
