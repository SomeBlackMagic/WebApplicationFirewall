package underattack

import (
	"net/http"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
	"github.com/someblackmagic/web-application-firewall-go/internal/jail/rules"
)

type Conditions struct {
	conditions []config.ConditionConfig
}

func NewConditions(cfgs []map[string]any) *Conditions {
	var conditions []config.ConditionConfig
	for _, raw := range cfgs {
		field, _ := raw["field"].(string)
		c := config.ConditionConfig{Field: field}

		if checksRaw, ok := raw["check"].([]interface{}); ok {
			for _, checkRaw := range checksRaw {
				if checkMap, ok := checkRaw.(map[string]interface{}); ok {
					method, _ := checkMap["method"].(string)
					var values []string
					if vs, ok := checkMap["values"].([]interface{}); ok {
						for _, v := range vs {
							if s, ok := v.(string); ok {
								values = append(values, s)
							}
						}
					}
					c.Check = append(c.Check, config.ConditionCheckConfig{
						Method: method,
						Values: values,
					})
				}
			}
		}
		conditions = append(conditions, c)
	}
	return &Conditions{conditions: conditions}
}

func (c *Conditions) Check(r *http.Request, country, city string) bool {
	if len(c.conditions) == 0 {
		return true
	}
	return rules.CheckConditions(c.conditions, r, country, city)
}
