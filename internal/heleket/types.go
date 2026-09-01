package heleket

import (
	"encoding/json"
	"strings"
)

// Статусы счёта Heleket.
//
// Успех — оплачено ровно или с избытком. Отмена — окончательный неуспех.
// process / check / confirm_check / wrong_amount_waiting — ещё ждём оплату.
// locked — заморозка по AML: не зачисляем, но и не отменяем автоматически,
// такие счёта разбирает админ.
const (
	StatusProcess            = "process"
	StatusCheck              = "check"
	StatusConfirmCheck       = "confirm_check"
	StatusPaid               = "paid"
	StatusPaidOver           = "paid_over"
	StatusWrongAmount        = "wrong_amount"
	StatusWrongAmountWaiting = "wrong_amount_waiting"
	StatusFail               = "fail"
	StatusCancel             = "cancel"
	StatusSystemFail         = "system_fail"
	StatusLocked             = "locked"
)

// CreatePaymentRequest — тело POST /v1/payment.
//
// Валюту и сеть выбирает плательщик на странице Heleket; мы задаём только
// фиатный номинал счёта (currency + amount).
type CreatePaymentRequest struct {
	Amount         string `json:"amount"`
	Currency       string `json:"currency"`
	OrderID        string `json:"order_id"`
	AdditionalData string `json:"additional_data,omitempty"`
	URLCallback    string `json:"url_callback,omitempty"`
	URLReturn      string `json:"url_return,omitempty"`
	URLSuccess     string `json:"url_success,omitempty"`
	Lifetime       int    `json:"lifetime,omitempty"`
}

// infoRequest — тело POST /v1/payment/info (нужен ровно один из идентификаторов).
type infoRequest struct {
	UUID    string `json:"uuid,omitempty"`
	OrderID string `json:"order_id,omitempty"`
}

// Payment — поле result ответов /v1/payment и /v1/payment/info.
type Payment struct {
	UUID          string `json:"uuid"`
	OrderID       string `json:"order_id"`
	URL           string `json:"url"`
	Status        string `json:"status"`
	PaymentStatus string `json:"payment_status"`
	Amount        string `json:"amount"`
	Currency      string `json:"currency"`
	PayerAmount   string `json:"payer_amount"`
	PayerCurrency string `json:"payer_currency"`
	Network       string `json:"network"`
	TxID          string `json:"txid"`
}

// apiResponse — конверт всех ответов Heleket.
type apiResponse struct {
	State   int             `json:"state"`
	Result  json.RawMessage `json:"result"`
	Message string          `json:"message"`
}

// CallbackPayload — тело вебхука. Разбираем минимум: остальное всё равно
// перезапрашиваем у /v1/payment/info, тело вебхука само по себе не зачисляет.
type CallbackPayload struct {
	UUID    string `json:"uuid"`
	OrderID string `json:"order_id"`
	Status  string `json:"status"`
	Sign    string `json:"sign"`
}

// StatusValue — статус счёта в нижнем регистре. Heleket отдаёт его то в
// status, то в payment_status в зависимости от эндпоинта.
func (p *Payment) StatusValue() string {
	if p == nil {
		return ""
	}
	s := strings.TrimSpace(p.Status)
	if s == "" {
		s = strings.TrimSpace(p.PaymentStatus)
	}
	return strings.ToLower(s)
}

// IsSuccess — деньги получены (ровно или с избытком).
func (p *Payment) IsSuccess() bool {
	switch p.StatusValue() {
	case StatusPaid, StatusPaidOver:
		return true
	default:
		return false
	}
}

// IsCanceled — окончательный неуспех, счёт можно закрывать.
func (p *Payment) IsCanceled() bool {
	switch p.StatusValue() {
	case StatusCancel, StatusFail, StatusSystemFail, StatusWrongAmount:
		return true
	default:
		return false
	}
}

// IsLocked — платёж заморожен AML-проверкой Heleket. Не успех и не отмена:
// оставляем счёт как есть и зовём админа.
func (p *Payment) IsLocked() bool {
	return p.StatusValue() == StatusLocked
}
