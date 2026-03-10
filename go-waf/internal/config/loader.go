package config

import (
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/someblackmagic/web-application-firewall-go/pkg/envx"
	"gopkg.in/yaml.v3"
)

func Load() (*AppConfig, error) {
	configType := envx.Env("WAF_CONFIG_TYPE", "file")
	var cfg AppConfig
	var err error

	switch configType {
	case "file":
		err = loadFromFile(&cfg)
	case "link":
		err = loadFromLink(&cfg)
	default:
		return nil, fmt.Errorf("config type %q not supported", configType)
	}
	if err != nil {
		return nil, err
	}

	ApplyDefaults(&cfg)
	return &cfg, nil
}

func loadFromFile(cfg *AppConfig) error {
	path := envx.Env("WAF_CONFIG_SOURCE", "./config.yaml")
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read config file %s: %w", path, err)
	}
	return yaml.Unmarshal(data, cfg)
}

func loadFromLink(cfg *AppConfig) error {
	link := envx.Env("WAF_CONFIG_SOURCE", "")
	if link == "" {
		return fmt.Errorf("env variable WAF_CONFIG_SOURCE is not defined")
	}

	resp, err := http.Get(link)
	if err != nil {
		return fmt.Errorf("failed to fetch config from %s: %w", link, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch config from %s: status %d", link, resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read config response from %s: %w", link, err)
	}
	return yaml.Unmarshal(data, cfg)
}
