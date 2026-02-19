package config

type AppConfig struct {
	Proxy struct {
		Host string `yaml:"host" json:"host"`
	} `yaml:"proxy" json:"proxy"`

	WAFMiddleware WAFMiddlewareConfig `yaml:"wafMiddleware" json:"wafMiddleware"`
	JailManager   JailManagerConfig   `yaml:"jailManager" json:"jailManager"`
	API           APIConfig           `yaml:"api" json:"api"`
	Metrics       MetricsConfig       `yaml:"metrics" json:"metrics"`
	Sentry        SentryConfig        `yaml:"sentry" json:"sentry"`
}
