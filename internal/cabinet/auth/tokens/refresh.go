// Package tokens — генерация и sha256-хеширование одноразовых токенов
// (refresh, email verification, password reset).
//
// Все эти токены — «capability»: их полный вид отправляется клиенту один раз,
// а в БД лежит только sha256. При утечке дампа БД злоумышленник не может
// предъявить токен в свой клиент (как и с bcrypt, но без соли — sha256 здесь
// достаточно: пространство ≥ 2^256, brute-force не имеет смысла).
package tokens

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
)

// DefaultRefreshBytes — 32 байта случайности для refresh-токена (256 бит).
const DefaultRefreshBytes = 32

// Generate возвращает случайный токен в base64url-без-паддинга формате и
// sha256-хеш от его байтового представления (до base64-кодирования).
//
// Почему sha256 от байтов, а не от строки: так унифицировано с тем, как токен
// приходит от клиента (мы декодируем base64url, получаем те же байты) —
// и хеш совпадёт. Это проще и безопаснее, чем дважды base64-энкодить.
func Generate(byteLen int) (token string, hash [32]byte, err error) {
	if byteLen <= 0 {
		byteLen = DefaultRefreshBytes
	}
	raw := make([]byte, byteLen)
	if _, err := rand.Read(raw); err != nil {
		return "", [32]byte{}, fmt.Errorf("tokens: read rand: %w", err)
	}
	token = base64.RawURLEncoding.EncodeToString(raw)
	hash = sha256.Sum256(raw)
	return token, hash, nil
}

// HashString считает sha256 от base64url-токена (как его прислал клиент).
// Используйте для lookup в БД: SELECT ... WHERE refresh_token_hash = $1.
// Возвращает ошибку, если строка не валидный base64url.
func HashString(token string) ([32]byte, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return [32]byte{}, fmt.Errorf("tokens: decode: %w", err)
	}
	return sha256.Sum256(raw), nil
}
