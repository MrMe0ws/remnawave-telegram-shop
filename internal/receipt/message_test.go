package receipt

import (
	"errors"
	"strings"
	"testing"
)

// Настоящая ошибка от ФНС приходит с JSON-телом внутри строки — в Telegram это
// нечитаемо. Разбираем её в «status 422: entity.not.found — Не найдено».
func TestFormatReceiptErrorParsesApiBody(t *testing.T) {
	err := errors.New(`reauthentication failed: authentication failed with status 422: ` +
		`{"code":"entity.not.found","message":"Не найдено","additionalInfo":{}}`)

	lines := formatReceiptError(err)
	if len(lines) != 2 {
		t.Fatalf("строк = %d (%q), ожидалось 2", len(lines), lines)
	}
	if !strings.Contains(lines[0], "authentication failed") {
		t.Errorf("первая строка = %q, ожидался контекст ошибки", lines[0])
	}
	if lines[1] != "status 422: entity.not.found — Не найдено" {
		t.Errorf("вторая строка = %q", lines[1])
	}
	for _, l := range lines {
		if strings.Contains(l, "{") || strings.Contains(l, "additionalInfo") {
			t.Errorf("в строку просочился сырой JSON: %q", l)
		}
	}
}

// Неразбираемую ошибку нельзя терять — показываем как есть.
func TestFormatReceiptErrorFallsBackToRaw(t *testing.T) {
	lines := formatReceiptError(errors.New("connection refused"))
	if len(lines) != 1 || lines[0] != "connection refused" {
		t.Fatalf("получено %q, ожидался исходный текст", lines)
	}
	if formatReceiptError(nil) != nil {
		t.Error("nil-ошибка не должна давать строк")
	}
}

// Описание и тело ошибки приходят снаружи и уходят в сообщение с parse_mode=HTML.
// Без экранирования угловые скобки сломали бы разметку сообщения.
func TestMessagesEscapeUntrustedText(t *testing.T) {
	msg := queuedMessage(413, 150, `<b>взлом</b> & Co`, "29.08.2026 21:26", "29.08.2026 21:27", 1,
		errors.New(`fail with status 400: {"code":"<script>","message":"a & b"}`))

	if strings.Contains(msg, "<b>взлом</b>") {
		t.Error("описание не экранировано — разметка сообщения сломается")
	}
	if !strings.Contains(msg, "&lt;b&gt;взлом&lt;/b&gt;") {
		t.Error("ожидалось экранированное описание")
	}
	if strings.Contains(msg, "<script>") {
		t.Error("код ошибки не экранирован")
	}
	if !strings.Contains(msg, "&amp; Co") {
		t.Error("амперсанд в описании должен быть экранирован")
	}
}

// Суммы: целые — без копеек, дробные — с двумя знаками.
func TestFormatAmount(t *testing.T) {
	cases := map[float64]string{150: "150 ₽", 149.5: "149.50 ₽", 0: "0 ₽", 1499.99: "1499.99 ₽"}
	for in, want := range cases {
		if got := formatAmount(in); got != want {
			t.Errorf("formatAmount(%v) = %q, ожидалось %q", in, got, want)
		}
	}
}

// Тело ответа бывает длинным, а у сообщения Telegram лимит 4096 символов.
func TestLongErrorIsTruncated(t *testing.T) {
	long := strings.Repeat("а", 5000)
	msg := gaveUpMessage(1, 10, "Подписка", "29.08.2026 21:26", errors.New(long))
	if len([]rune(msg)) > 1000 {
		t.Fatalf("длина сообщения %d рун — ошибка не обрезана", len([]rune(msg)))
	}
	if !strings.Contains(msg, "…") {
		t.Error("ожидался маркер обрезки")
	}
}

// Сообщение об успехе должно нести ID чека и подчёркивать дату дохода —
// ради неё и затевалась очередь.
func TestRecoveredMessageCarriesReceiptID(t *testing.T) {
	msg := recoveredMessage(413, 150, "29.08.2026 21:26", "abc-123", 7)
	for _, want := range []string{"abc-123", "ID 413", "150 ₽", "датой оплаты"} {
		if !strings.Contains(msg, want) {
			t.Errorf("в сообщении нет %q", want)
		}
	}
}
