package botdetector

type Config struct {
	Enabled bool `yaml:"enabled" json:"enabled"`
}

type RequestPattern struct {
	Timestamp int64
	Path      string
	Method    string
}
