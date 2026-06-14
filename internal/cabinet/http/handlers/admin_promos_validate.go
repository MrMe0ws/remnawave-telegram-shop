package handlers

import (
	"encoding/json"
	"fmt"
	"time"
)

func parsePromoPatchFields(raw map[string]json.RawMessage, allowed map[string]bool) (map[string]interface{}, error) {
	fields := make(map[string]interface{})
	for k, v := range raw {
		if !allowed[k] {
			continue
		}
		switch k {
		case "valid_until":
			if string(v) == "null" {
				fields[k] = nil
				continue
			}
			var s string
			if err := json.Unmarshal(v, &s); err != nil {
				return nil, fmt.Errorf("invalid valid_until")
			}
			if s == "" {
				fields[k] = nil
				continue
			}
			t, err := time.Parse(time.RFC3339, s)
			if err != nil {
				return nil, fmt.Errorf("invalid valid_until")
			}
			fields[k] = t
		default:
			var val interface{}
			if err := json.Unmarshal(v, &val); err != nil {
				return nil, fmt.Errorf("invalid field %s", k)
			}
			fields[k] = val
		}
	}
	return fields, nil
}

func validatePromoUpdateFields(promoType string, fields map[string]interface{}) error {
	if v, ok := fields["max_uses"]; ok && v != nil {
		n, err := promoFieldInt(v)
		if err != nil || n < 0 {
			return fmt.Errorf("invalid max_uses")
		}
	}
	if v, ok := fields["discount_max_subscription_payments_per_customer"]; ok {
		n, err := promoFieldInt(v)
		if err != nil || n < 0 {
			return fmt.Errorf("invalid discount_max_subscription_payments_per_customer")
		}
	}
	if v, ok := fields["subscription_days"]; ok {
		if promoType == "subscription_days" {
			n, err := promoFieldInt(v)
			if err != nil || n <= 0 {
				return fmt.Errorf("invalid subscription_days")
			}
		}
	}
	if v, ok := fields["trial_days"]; ok {
		if promoType == "trial" {
			n, err := promoFieldInt(v)
			if err != nil || n <= 0 {
				return fmt.Errorf("invalid trial_days")
			}
		}
	}
	if v, ok := fields["extra_hwid_delta"]; ok && v != nil {
		if promoType == "extra_hwid" {
			if _, err := promoFieldInt(v); err != nil {
				return fmt.Errorf("invalid extra_hwid_delta")
			}
		}
	}
	if v, ok := fields["discount_percent"]; ok {
		if promoType == "discount" {
			n, err := promoFieldInt(v)
			if err != nil || n < 1 || n > 100 {
				return fmt.Errorf("invalid discount_percent")
			}
		}
	}
	if v, ok := fields["discount_ttl_hours"]; ok && v != nil {
		if promoType == "discount" {
			n, err := promoFieldInt(v)
			if err != nil || n <= 0 {
				return fmt.Errorf("invalid discount_ttl_hours")
			}
		}
	}
	return nil
}

func promoFieldInt(v interface{}) (int, error) {
	switch n := v.(type) {
	case int:
		return n, nil
	case int64:
		return int(n), nil
	case float64:
		return int(n), nil
	default:
		return 0, fmt.Errorf("not a number")
	}
}
