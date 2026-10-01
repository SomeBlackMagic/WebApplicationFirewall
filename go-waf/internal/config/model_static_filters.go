package config

type StaticFilterConfig struct {
	IPs        []string `yaml:"ips,omitempty" json:"ips,omitempty"`
	IPSubnet   []string `yaml:"ipSubnet,omitempty" json:"ipSubnet,omitempty"`
	GeoCountry []string `yaml:"geoCountry,omitempty" json:"geoCountry,omitempty"`
	GeoCity    []string `yaml:"geoCity,omitempty" json:"geoCity,omitempty"`
}

type WhitelistConfig struct{ StaticFilterConfig }
type BlacklistConfig struct{ StaticFilterConfig }
