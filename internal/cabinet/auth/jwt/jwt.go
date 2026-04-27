// Package jwt — issue/verify access-токенов кабинета.
//
// Алгоритм — HS256, секрет подписи из CABINET_JWT_SECRET. Библиотека —
// github.com/golang-jwt/jwt/v5.
//
// Access-токен умышленно короткоживущий (по умолчанию 15 минут, см.
// CABINET_ACCESS_TTL_MINUTES). refresh-ротация реализована отдельно в пакете
// tokens/session.
package jwt

import (
	"errors"
	"fmt"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
)

// Claims — набор полей, зашиваемых в access-токен.
//
// AccountID — основной идентификатор аккаунта кабинета; EmailVerified
// дублируем, чтобы middleware RequireVerifiedEmail не делал лишний SELECT
// на каждый запрос (ценой чуть более долгой «инвалидации» — до истечения
// access-TTL). Language полезен для i18n ответов API.
type Claims struct {
	AccountID     int64  `json:"sub,string"`
	Email         string `json:"email,omitempty"`
	EmailVerified bool   `json:"email_verified"`
	Language      string `json:"lang,omitempty"`
	gojwt.RegisteredClaims
}

// Issuer подписывает и валидирует access-токены.
type Issuer struct {
	secret []byte
	ttl    time.Duration
	issuer string
}

// NewIssuer создаёт Issuer. secret должен быть >= 32 байта (проверка — в
// cabinet/config.InitConfig), ttl — минуты из CABINET_ACCESS_TTL_MINUTES.
// issuer — опциональная строка, попадает в iss и проверяется при verify.
func NewIssuer(secret []byte, ttl time.Duration, issuer string) *Issuer {
	return &Issuer{secret: secret, ttl: ttl, issuer: issuer}
}

// Issue выдаёт новый access-токен для аккаунта.
func (i *Issuer) Issue(accountID int64, email string, emailVerified bool, language string) (string, time.Time, error) {
	now := time.Now().UTC()
	exp := now.Add(i.ttl)

	claims := Claims{
		AccountID:     accountID,
		Email:         email,
		EmailVerified: emailVerified,
		Language:      language,
		RegisteredClaims: gojwt.RegisteredClaims{
			IssuedAt:  gojwt.NewNumericDate(now),
			NotBefore: gojwt.NewNumericDate(now),
			ExpiresAt: gojwt.NewNumericDate(exp),
			Issuer:    i.issuer,
		},
	}

	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(i.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("jwt: sign: %w", err)
	}
	return signed, exp, nil
}

// ErrInvalidToken — любая ошибка валидации (подпись, exp, формат). Скрывает
// детали, чтобы middleware не светил почему именно токен отклонён.
var ErrInvalidToken = errors.New("jwt: invalid token")

// Verify проверяет подпись, срок действия, iss. Возвращает Claims при успехе.
// Любая причина отказа маппится в ErrInvalidToken (без leak внутренней ошибки).
func (i *Issuer) Verify(tokenStr string) (*Claims, error) {
	var claims Claims
	tok, err := gojwt.ParseWithClaims(tokenStr, &claims, func(t *gojwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*gojwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return i.secret, nil
	}, gojwt.WithIssuer(i.issuer), gojwt.WithValidMethods([]string{gojwt.SigningMethodHS256.Alg()}))
	if err != nil || tok == nil || !tok.Valid {
		return nil, ErrInvalidToken
	}
	return &claims, nil
}
