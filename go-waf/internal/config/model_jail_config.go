package config

import "gopkg.in/yaml.v3"

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

type AbstractRuleConfig struct {
	Name string    `yaml:"name" json:"name"`
	Type string    `yaml:"type" json:"type"`
	Raw  yaml.Node `yaml:",inline"`
}

type CompositeRuleConfig struct {
	Name            string          `yaml:"name" json:"name"`
	Type            string          `yaml:"type" json:"type"`
	UniqueClientKey []string        `yaml:"uniqueClientKey" json:"uniqueClientKey"`
	Conditions      []ConditionConfig `yaml:"conditions" json:"conditions"`
	Limit           int             `yaml:"limit" json:"limit"`
	Period          int             `yaml:"period" json:"period"`
	Duration        int             `yaml:"duration" json:"duration"`
	EscalationRate  float64         `yaml:"escalationRate" json:"escalationRate"`
}

type FlexibleRuleConfig struct {
	Name           string            `yaml:"name" json:"name"`
	Type           string            `yaml:"type" json:"type"`
	Conditions     []ConditionConfig `yaml:"conditions" json:"conditions"`
	Limit          int               `yaml:"limit" json:"limit"`
	Period         int               `yaml:"period" json:"period"`
	Duration       int               `yaml:"duration" json:"duration"`
	EscalationRate float64           `yaml:"escalationRate" json:"escalationRate"`
}

type StaticRuleConfig struct {
	Name           string `yaml:"name" json:"name"`
	Type           string `yaml:"type" json:"type"`
	LinkUrl        string `yaml:"linkUrl" json:"linkUrl"`
	UpdateInterval int    `yaml:"updateInterval" json:"updateInterval"`
}

type ConditionConfig struct {
	Field string               `yaml:"field" json:"field"`
	Check []ConditionCheckConfig `yaml:"check" json:"check"`
}

type ConditionCheckConfig struct {
	Method string   `yaml:"method" json:"method"`
	Values []string `yaml:"values" json:"values"`
}

type FileStorageDriverConfig struct {
	FilePath string `yaml:"filePath" json:"filePath"`
}

type OperatorStorageDriverConfig struct {
	ApiHost string `yaml:"apiHost" json:"apiHost"`
	AgentID string `yaml:"agentId" json:"agentId"`
}
