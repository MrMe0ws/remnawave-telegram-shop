package heleket

import (
	"fmt"
	"strings"
)

// APIError — ненулевой HTTP-статус от api.heleket.com.
type APIError struct {
	StatusCode int
	Body       string
	// Message и State — разобранный конверт ответа, если он был JSON-ом.
	Message string
	State   int
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("heleket API error: status=%d, message=%s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("heleket API error: status=%d, body=%s", e.StatusCode, e.Body)
}

// IsNotFound — счёта с таким uuid/order_id у мерчанта нет.
//
// Heleket отвечает на это не 404, а 422 с message «Payment not found», поэтому
// по одному лишь коду статуса «нет счёта» от «кривых параметров» не отличить.
func (e *APIError) IsNotFound() bool {
	if e.StatusCode == 404 {
		return true
	}
	return strings.Contains(strings.ToLower(e.Message), "not found")
}

func (e *APIError) IsUnauthorized() bool {
	return e.StatusCode == 401 || e.StatusCode == 403
}
