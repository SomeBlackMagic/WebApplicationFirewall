package rules

import (
	"net/http"
	"regexp"
)

type BannedIPItem struct {
	RuleID         string
	IP             string
	Duration       int
	EscalationRate float64
	RequestIDs     []string
}

type RuleResult struct {
	Blocked bool
	Ban     *BannedIPItem
}

type Rule interface {
	Use(clientIP, country, city string, r *http.Request, requestID string) RuleResult
}

func CreateRegexFromString(regexString string) (*regexp.Regexp, error) {
	re := regexp.MustCompile(`^/(.*)/([ a-z]*)$`)
	matches := re.FindStringSubmatch(regexString)
	if matches != nil {
		pattern := matches[1]
		flags := matches[2]
		expr := ""
		if flags != "" {
			expr = "(?" + flags + ")" + pattern
		} else {
			expr = pattern
		}
		return regexp.Compile(expr)
	}
	return regexp.Compile(regexString)
}
