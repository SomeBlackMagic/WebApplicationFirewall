package envx

import (
	"os"
	"strconv"
	"strings"
)

func Env(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func EnvNumber(key string, defaultValue int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultValue
	}
	return n
}

func EnvBoolean(key string, defaultValue bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}
	switch strings.ToLower(v) {
	case "true", "1", "on", "yes":
		return true
	case "false", "0", "off", "no":
		return false
	default:
		return defaultValue
	}
}
