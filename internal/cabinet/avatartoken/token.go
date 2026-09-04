// Package avatartoken выпускает и проверяет короткие подписанные ссылки на
// аватарку владельца аккаунта.
//
// Зачем отдельный токен, а не RequireAuth: аватарка подставляется в <img>,
// а тег не умеет слать Authorization — access-токен живёт в памяти вкладки,
// не в куке. Варианты были два: тянуть картинку fetch'ем в blob (теряется
// HTTP-кэш браузера, на каждой полной перезагрузке качаем заново) или отдать
// самодостаточный URL. Выбран второй: <img src> кэшируется штатно, и ту же
// ссылку можно положить в шапку или на дашборд без обвязки.
//
// Формат и раскладка байт — как у connectinvite, но ключ разведён контекстом:
// токен аватарки не должен проходить проверку приглашения и наоборот.
//
// Модель угроз: токен открывает ровно одну картинку — аватар из Telegram,
// который и так виден любому, кто знает @username. Отзыва у stateless-токена
// нет, ограничивает срок жизни; сам URL приезжает только владельцу в /me.
package avatartoken

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"time"
)

// DefaultTTL — срок жизни ссылки. Неделя: /me перезапрашивается на каждом
// заходе и обновляет URL, так что до истечения доживает только токен из
// вкладки, которую не трогали неделю.
const DefaultTTL = 7 * 24 * time.Hour

const (
	// Первый байт токена — subject: чей идентификатор лежит дальше. Байт
	// входит в подпись, поэтому подменить его, не сломав MAC, нельзя — один
	// ключ на оба вида токенов безопасен.
	//
	// subjectAccount исторически назывался версией формата и равен 1: старые
	// ссылки из /me продолжают разбираться.
	subjectAccount  = 1
	subjectTelegram = 2

	macLen     = 12 // 96 бит: подделка нереальна, а токен остаётся коротким
	payloadLen = 1 + 8 + 4
	tokenLen   = payloadLen + macLen
)

// keyContext разводит ключ аватарок и ключ подписи JWT: секрет кабинета один
// на всё, но токены разных назначений не должны быть взаимозаменяемы.
const keyContext = "cabinet-avatar-v1"

var (
	// ErrMalformed — строка не является токеном аватарки.
	ErrMalformed = errors.New("avatartoken: malformed token")
	// ErrSignature — подпись не сходится (подделка или смена секрета).
	ErrSignature = errors.New("avatartoken: bad signature")
	// ErrExpired — срок ссылки истёк.
	ErrExpired = errors.New("avatartoken: token expired")
)

var encoding = base64.RawURLEncoding

// deriveKey — HMAC-ключ аватарок, выведенный из секрета кабинета.
func deriveKey(secret []byte) []byte {
	sum := sha256.Sum256(append([]byte(keyContext), secret...))
	return sum[:]
}

// Issue выпускает ссылку на аватарку аккаунта кабинета.
func Issue(secret []byte, accountID int64, ttl time.Duration, now time.Time) (string, error) {
	return issue(secret, subjectAccount, accountID, ttl, now)
}

// IssueTelegram выпускает ссылку на аватарку по telegram id.
//
// Нужна админке: там карточку открывают на пользователя бота, у которого
// аккаунта в кабинете может не быть вовсе, а telegram id есть всегда.
func IssueTelegram(secret []byte, telegramID int64, ttl time.Duration, now time.Time) (string, error) {
	return issue(secret, subjectTelegram, telegramID, ttl, now)
}

func issue(secret []byte, subject byte, id int64, ttl time.Duration, now time.Time) (string, error) {
	if len(secret) == 0 {
		return "", errors.New("avatartoken: empty secret")
	}
	if id <= 0 {
		return "", errors.New("avatartoken: invalid subject id")
	}
	if ttl <= 0 {
		ttl = DefaultTTL
	}

	expiresAt := now.Add(ttl).Truncate(time.Second)
	// Unix-секунды в uint32 хватает до 2106 года; срок здесь — неделя.
	if expiresAt.Unix() <= 0 || expiresAt.Unix() > int64(^uint32(0)) {
		return "", errors.New("avatartoken: expiry out of range")
	}

	raw := make([]byte, tokenLen)
	raw[0] = subject
	binary.BigEndian.PutUint64(raw[1:9], uint64(id))
	binary.BigEndian.PutUint32(raw[9:13], uint32(expiresAt.Unix()))
	copy(raw[payloadLen:], sign(secret, raw[:payloadLen]))

	return encoding.EncodeToString(raw), nil
}

// Parse проверяет подпись и срок, возвращая account_id владельца аватарки.
func Parse(secret []byte, token string, now time.Time) (int64, error) {
	return parse(secret, token, subjectAccount, now)
}

// ParseTelegram — то же для токена, выписанного на telegram id.
func ParseTelegram(secret []byte, token string, now time.Time) (int64, error) {
	return parse(secret, token, subjectTelegram, now)
}

func parse(secret []byte, token string, subject byte, now time.Time) (int64, error) {
	if len(secret) == 0 {
		return 0, errors.New("avatartoken: empty secret")
	}
	raw, err := encoding.DecodeString(token)
	if err != nil || len(raw) != tokenLen || raw[0] != subject {
		return 0, ErrMalformed
	}
	// Подпись проверяем до срока: иначе по разнице ответов «протух» и
	// «не сходится» можно отличить существующий токен от выдуманного.
	if !hmac.Equal(raw[payloadLen:], sign(secret, raw[:payloadLen])) {
		return 0, ErrSignature
	}

	id := int64(binary.BigEndian.Uint64(raw[1:9]))
	if id <= 0 {
		return 0, ErrMalformed
	}
	exp := time.Unix(int64(binary.BigEndian.Uint32(raw[9:13])), 0)
	if !now.Before(exp) {
		return 0, ErrExpired
	}
	return id, nil
}

func sign(secret, payload []byte) []byte {
	mac := hmac.New(sha256.New, deriveKey(secret))
	mac.Write(payload)
	return mac.Sum(nil)[:macLen]
}
