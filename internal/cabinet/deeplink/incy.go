// Package deeplink формирует зашифрованные deep link'и для клиентов подключения
// (INCY, Happ), чтобы ссылка подписки не читалась сканерами чатов/скриншотами
// и её нельзя было отредактировать в приложении.
//
// ВАЖНО про модель угроз INCY: это ОБФУСКАЦИЯ, а не защита секретности. Ключ K1
// выводится из констант, зашитых в открытый npm-пакет @incy/link-encoder и во все
// клиенты INCY, поэтому кто угодно может его восстановить. Мы закрываем только
// автоматические сканеры (RKN, модерация Telegram, grep по дампам чатов), но не
// целенаправленный реверс. Для Happ шифрование серьёзнее (RSA на стороне happ.su),
// см. happ.go.
package deeplink

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
)

// Порт алгоритма из @incy/link-encoder (src/index.ts). Константы соли и смещений
// keymat повторяют пакет 1:1 — иначе выведенный ключ не совпадёт с клиентами.
const (
	incyScheme = "incy"
	incyHost   = "crypt1"

	incySaltP1 = "incy"
	incySaltP2 = "deep"
	incySaltP3 = "crypt1"
	incySaltP4 = "v2026.06"

	incyKeymatAOffset = 1024
	incyKeymatBOffset = 2048
	incyKeymatLen     = 32

	// SHA-256(K1) опубликованных клиентов — контроль, что keymat не разъехался.
	incyExpectedKeyFingerprint = "b6bf708471cc90043232967660aade86a50b4e57929db2e53c5fa34db624c08c"

	incyNameMaxLen = 128
)

var (
	incyKeyOnce sync.Once
	incyKey     []byte
	incyKeyErr  error
)

// incyDeriveKey выводит и кэширует K1 = SHA-256(salt || keymatA || keymatB).
func incyDeriveKey() ([]byte, error) {
	incyKeyOnce.Do(func() {
		a, err := base64.StdEncoding.DecodeString(keymatAB64)
		if err != nil {
			incyKeyErr = fmt.Errorf("incy: decode keymat A: %w", err)
			return
		}
		b, err := base64.StdEncoding.DecodeString(keymatBB64)
		if err != nil {
			incyKeyErr = fmt.Errorf("incy: decode keymat B: %w", err)
			return
		}
		if len(a) < incyKeymatAOffset+incyKeymatLen || len(b) < incyKeymatBOffset+incyKeymatLen {
			incyKeyErr = errors.New("incy: keymat assets smaller than expected")
			return
		}
		kmA := a[incyKeymatAOffset : incyKeymatAOffset+incyKeymatLen]
		kmB := b[incyKeymatBOffset : incyKeymatBOffset+incyKeymatLen]

		seed := make([]byte, 0, len(incySaltP1)+len(incySaltP2)+len(incySaltP3)+len(incySaltP4)+2*incyKeymatLen)
		seed = append(seed, incySaltP1...)
		seed = append(seed, incySaltP2...)
		seed = append(seed, incySaltP3...)
		seed = append(seed, incySaltP4...)
		seed = append(seed, kmA...)
		seed = append(seed, kmB...)

		k := sha256.Sum256(seed)
		fp := sha256.Sum256(k[:])
		if hex.EncodeToString(fp[:]) != incyExpectedKeyFingerprint {
			incyKeyErr = fmt.Errorf("incy: derived key fingerprint mismatch (keymat out of sync with published clients)")
			return
		}
		key := make([]byte, len(k))
		copy(key, k[:])
		incyKey = key
	})
	return incyKey, incyKeyErr
}

// EncryptINCY превращает ссылку подписки в incy://crypt1/<base64url(iv+ct+tag)>.
// name (опционально) показывается в окне импорта клиента как имя провайдера.
func EncryptINCY(subscriptionURL, name string) (string, error) {
	block, err := incyCipher()
	if err != nil {
		return "", err
	}
	iv := make([]byte, block.NonceSize())
	if _, err := rand.Read(iv); err != nil {
		return "", fmt.Errorf("incy: read iv: %w", err)
	}
	return encryptINCYWithIV(subscriptionURL, name, iv)
}

// incyCipher возвращает AES-256-GCM (12-байтный nonce, 16-байтный tag — как в
// пакете @incy/link-encoder) на выведенном ключе K1.
func incyCipher() (cipher.AEAD, error) {
	key, err := incyDeriveKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("incy: new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("incy: new gcm: %w", err)
	}
	return gcm, nil
}

// encryptINCYWithIV — детерминированное шифрование с заданным IV. IV должен быть
// уникальным на каждый вызов (в проде — из crypto/rand); фиксированный IV нужен
// только known-answer тестам совместимости с эталонным клиентом.
func encryptINCYWithIV(subscriptionURL, name string, iv []byte) (string, error) {
	subscriptionURL = strings.TrimSpace(subscriptionURL)
	if subscriptionURL == "" {
		return "", errors.New("incy: empty subscription url")
	}
	gcm, err := incyCipher()
	if err != nil {
		return "", err
	}
	if len(iv) != gcm.NonceSize() {
		return "", fmt.Errorf("incy: iv must be %d bytes", gcm.NonceSize())
	}
	plaintext, err := incyPayloadJSON(subscriptionURL, name)
	if err != nil {
		return "", err
	}
	// Seal возвращает ct||tag; итоговый wire — iv||ct||tag.
	sealed := gcm.Seal(nil, iv, plaintext, nil)
	wire := make([]byte, 0, len(iv)+len(sealed))
	wire = append(wire, iv...)
	wire = append(wire, sealed...)

	return fmt.Sprintf("%s://%s/%s", incyScheme, incyHost, base64.RawURLEncoding.EncodeToString(wire)), nil
}

// incyPayloadJSON строит компактный JSON с сортированными ключами
// ({"n":...,"url":...,"v":1}) — байт-в-байт как эталонный энкодер INCY. Клиенту
// для декода порядок ключей не важен, но так известные векторы совпадают точно.
func incyPayloadJSON(url, name string) ([]byte, error) {
	urlJSON, err := jsonStringNoHTMLEscape(url)
	if err != nil {
		return nil, fmt.Errorf("incy: encode url: %w", err)
	}
	name = strings.TrimSpace(name)
	if name != "" {
		// Обрезаем по рунам (как .slice в JS-клиенте), чтобы не разорвать UTF-8.
		if r := []rune(name); len(r) > incyNameMaxLen {
			name = string(r[:incyNameMaxLen])
		}
		nameJSON, err := jsonStringNoHTMLEscape(name)
		if err != nil {
			return nil, fmt.Errorf("incy: encode name: %w", err)
		}
		return []byte(fmt.Sprintf(`{"n":%s,"url":%s,"v":1}`, nameJSON, urlJSON)), nil
	}
	return []byte(fmt.Sprintf(`{"url":%s,"v":1}`, urlJSON)), nil
}
