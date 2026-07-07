package deeplink

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
)

// TestINCYKeyFingerprint убеждается, что выведенный из зашитого keymat ключ K1
// совпадает по отпечатку с опубликованными клиентами INCY. Если тест падает —
// keymat в incy_keymat.go разъехался с пакетом @incy/link-encoder.
func TestINCYKeyFingerprint(t *testing.T) {
	if _, err := incyDeriveKey(); err != nil {
		t.Fatalf("incyDeriveKey: %v", err)
	}
}

func TestEncryptINCYRoundTrip(t *testing.T) {
	const (
		url  = "https://panel.example.org/sub/AbC123-token_value"
		name = "MEOWS VPN"
	)

	link, err := EncryptINCY(url, name)
	if err != nil {
		t.Fatalf("EncryptINCY: %v", err)
	}
	if !strings.HasPrefix(link, "incy://crypt1/") {
		t.Fatalf("unexpected prefix: %q", link)
	}

	gotURL, gotName := decryptINCYForTest(t, link)
	if gotURL != url {
		t.Errorf("url mismatch: got %q want %q", gotURL, url)
	}
	if gotName != name {
		t.Errorf("name mismatch: got %q want %q", gotName, name)
	}
}

func TestEncryptINCYNoName(t *testing.T) {
	const url = "https://panel.example.org/sub/token"
	link, err := EncryptINCY(url, "")
	if err != nil {
		t.Fatalf("EncryptINCY: %v", err)
	}
	gotURL, gotName := decryptINCYForTest(t, link)
	if gotURL != url {
		t.Errorf("url mismatch: got %q want %q", gotURL, url)
	}
	if gotName != "" {
		t.Errorf("expected empty name, got %q", gotName)
	}
}

func TestEncryptINCYEmptyURL(t *testing.T) {
	if _, err := EncryptINCY("   ", "x"); err == nil {
		t.Fatal("expected error for empty url")
	}
}

// TestEncryptINCYKnownAnswer сверяет вывод Go-порта байт-в-байт с эталонным
// клиентом. Векторы получены из реального npm-пакета @incy/link-encoder
// (encryptLinkDeterministic) с фиксированным IV 000102...0b. Совпадение
// доказывает полную interop-совместимость (ключ + wire-формат + JSON-схема).
func TestEncryptINCYKnownAnswer(t *testing.T) {
	const (
		url  = "https://panel.example.org/sub/AbC123-token_value"
		name = "MEOWS VPN"

		wantWithName = "incy://crypt1/AAECAwQFBgcICQoLNyILfyzDtnFNvA1T1_vrReqY_dMEL36fTTyRcsaOESIv--ZHWQ0e3scdKLWvAmLTRKeP7yyPSKNoPf7qWnvPv6XMrtLMOrt5NeqGZFs8Fj1jKulWFykltfHb933kNmPx"
		wantNoName   = "incy://crypt1/AAECAwQFBgcICQoLNyIQL3rDwRZqnyoD8pGKSLbb5sQEIyHFRCWVbtCaUX84tftXVww6xOVBaurnWGLKRuaj7C_MfKQJIO6vVTWRqYjETDsblkw6hSzVuT6gjwY"
	)
	iv := []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}

	gotWithName, err := encryptINCYWithIV(url, name, iv)
	if err != nil {
		t.Fatalf("encryptINCYWithIV (name): %v", err)
	}
	if gotWithName != wantWithName {
		t.Errorf("with name mismatch:\n got  %q\n want %q", gotWithName, wantWithName)
	}

	gotNoName, err := encryptINCYWithIV(url, "", iv)
	if err != nil {
		t.Fatalf("encryptINCYWithIV (no name): %v", err)
	}
	if gotNoName != wantNoName {
		t.Errorf("no name mismatch:\n got  %q\n want %q", gotNoName, wantNoName)
	}
}

// decryptINCYForTest расшифровывает incy://crypt1/ так же, как это делают клиенты,
// проверяя корректность формата wire и JSON-полезной нагрузки.
func decryptINCYForTest(t *testing.T, link string) (url, name string) {
	t.Helper()
	const prefix = "incy://crypt1/"
	payload := strings.TrimRight(strings.TrimPrefix(link, prefix), "/")
	wire, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		t.Fatalf("base64 decode: %v", err)
	}
	if len(wire) < 12+16+1 {
		t.Fatalf("wire too short: %d", len(wire))
	}
	key, err := incyDeriveKey()
	if err != nil {
		t.Fatalf("incyDeriveKey: %v", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		t.Fatalf("new cipher: %v", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatalf("new gcm: %v", err)
	}
	iv := wire[:12]
	sealed := wire[12:]
	plaintext, err := gcm.Open(nil, iv, sealed, nil)
	if err != nil {
		t.Fatalf("gcm open: %v", err)
	}
	var parsed struct {
		URL  string `json:"url"`
		Name string `json:"n"`
		V    int    `json:"v"`
	}
	if err := json.Unmarshal(plaintext, &parsed); err != nil {
		t.Fatalf("json unmarshal: %v", err)
	}
	if parsed.V != 1 {
		t.Fatalf("unexpected version: %d", parsed.V)
	}
	return parsed.URL, parsed.Name
}
