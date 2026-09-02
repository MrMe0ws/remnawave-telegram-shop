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

// IsPaymentNotFound — у мерчанта нет счёта с таким uuid/order_id.
//
// Heleket отвечает на это 422 с message «Payment not found», а не 404, поэтому
// по коду статуса отличить нельзя и приходится смотреть на сообщение. Сравнение
// строгое, по всему тексту: подстрока «not found» ловила бы заодно «Merchant not
// found» (опечатка в merchant id) и любую 404-страницу CDN, а вызывающий код
// трактует «нет счёта» как повод закрыть покупку — то есть одна ошибка
// конфигурации отменяла бы все живые счета разом.
func (e *APIError) IsPaymentNotFound() bool {
	return strings.EqualFold(strings.TrimSpace(e.Message), "payment not found")
}

func (e *APIError) IsUnauthorized() bool {
	return e.StatusCode == 401 || e.StatusCode == 403
}
