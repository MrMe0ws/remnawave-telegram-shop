package moynalog

import "time"

// AuthRequest представляет запрос на аутентификацию
type AuthRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// AuthResponse представляет ответ на аутентификацию
type AuthResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// CreateIncomeRequest представляет запрос на создание чека о доходе
type CreateIncomeRequest struct {
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	Date        string  `json:"date"` // Формат: "YYYY-MM-DD"
}

// CreateIncomeResponse представляет ответ на создание чека
type CreateIncomeResponse struct {
	ID          string    `json:"id"`
	Amount      float64   `json:"amount"`
	Description string    `json:"description"`
	Date        string    `json:"date"`
	CreatedAt   time.Time `json:"created_at"`
}

// TaxpayerProfile представляет профиль налогоплательщика
type TaxpayerProfile struct {
	INN       string `json:"inn"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	TaxSystem string `json:"tax_system"`
}

// IncomeRecord представляет запись о доходе
type IncomeRecord struct {
	ID          string    `json:"id"`
	Amount      float64   `json:"amount"`
	Description string    `json:"description"`
	Date        string    `json:"date"`
	CreatedAt   time.Time `json:"created_at"`
}
