package rules

import (
	"net/http"
	"strings"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
)

func CheckConditions(conditions []config.ConditionConfig, r *http.Request, country, city string) bool {
	for _, cond := range conditions {
		var testedValue string

		switch {
		case cond.Field == "url":
			testedValue = r.URL.Path
		case cond.Field == "hostname":
			testedValue = r.Host
		case cond.Field == "user-agent":
			testedValue = r.Header.Get("User-Agent")
		case strings.HasPrefix(cond.Field, "header-"):
			headerName := strings.TrimPrefix(cond.Field, "header-")
			testedValue = r.Header.Get(headerName)
		case cond.Field == "geo-country":
			testedValue = country
		case cond.Field == "geo-city":
			testedValue = city
		}

		anyCheckPassed := false
		for _, check := range cond.Check {
			switch check.Method {
			case "equals":
				for _, v := range check.Values {
					if v == testedValue {
						anyCheckPassed = true
						break
					}
				}
			case "regexp":
				for _, pattern := range check.Values {
					re, err := CreateRegexFromString(pattern)
					if err != nil {
						continue
					}
					if re.MatchString(testedValue) {
						anyCheckPassed = true
						break
					}
				}
			}
			if anyCheckPassed {
				break
			}
		}

		if !anyCheckPassed {
			return false
		}
	}
	return true
}
