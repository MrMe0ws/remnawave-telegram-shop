package password

import (
	"errors"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

// PolicyError — нарушение политики пароля. Строка error безопасна для показа
// пользователю (никаких секретов/ID в ней нет).
type PolicyError struct {
	Reason string
}

func (e *PolicyError) Error() string { return e.Reason }

// Policy — правила проверки пароля.
//
// Текущий рабочий профиль кабинета: минимум 8 символов (после NFKC).
// Дополнительные проверки (популярные пароли/совпадение с email/username)
// оставлены в коде как опции и по умолчанию выключены.
//
// Максимум мы сознательно не ограничиваем (NIST SP 800-63B), но ставим sanity
// cap в 256 символов после нормализации — это защита от DoS на Argon2id
// (argon2 линейно от длины входа).
type Policy struct {
	MinLength      int
	MaxLength      int
	BlockPopular   bool
	BlockEqualUser bool
}

// DefaultPolicy — базовая политика: только минимальная длина.
func DefaultPolicy() Policy {
	return Policy{
		MinLength:      8,
		MaxLength:      256,
		BlockPopular:   false,
		BlockEqualUser: false,
	}
}

// Normalize применяет NFKC-нормализацию к паролю. Делать это обязательно ДО
// проверок и ДО хеширования — иначе визуально одинаковые строки дадут разные
// хеши (unicode compatibility).
func Normalize(plain string) string {
	return norm.NFKC.String(plain)
}

// Validate проверяет пароль по политике. Возвращает *PolicyError при нарушении.
// Сравнение с email/username — case-insensitive.
//
// На вход передавайте уже отнормализованный пароль (через Normalize). Это даёт
// вызывающему контроль: можно вызвать Validate и потом Hash на том же
// отнормализованном значении.
func Validate(plainNormalized, email, username string, p Policy) error {
	length := utf8.RuneCountInString(plainNormalized)
	if length < p.MinLength {
		return &PolicyError{Reason: "password is too short"}
	}
	if p.MaxLength > 0 && length > p.MaxLength {
		return &PolicyError{Reason: "password is too long"}
	}

	if p.BlockEqualUser {
		low := strings.ToLower(plainNormalized)
		if email != "" && low == strings.ToLower(email) {
			return &PolicyError{Reason: "password must not match email"}
		}
		if username != "" && low == strings.ToLower(username) {
			return &PolicyError{Reason: "password must not match username"}
		}
	}

	if p.BlockPopular && isCommonPassword(plainNormalized) {
		return &PolicyError{Reason: "password is too common"}
	}

	return nil
}

// ErrPolicy — хелпер для проверок «ошибка — это PolicyError?».
func ErrPolicy(err error) bool {
	var pe *PolicyError
	return errors.As(err, &pe)
}
