package notification

import (
	"regexp"
	"testing"

	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/translation"
)

// partnerNotifyArgs — сколько аргументов подставляет нотификатор в каждый
// шаблон. Список ведётся вручную и намеренно: он и есть контракт между кодом и
// файлами переводов.
var partnerNotifyArgs = map[string]int{
	"admin_partner_application_new":  4,
	"admin_partner_application_auto": 4,
	"admin_partner_payout_request":   4,
	"admin_partner_notify_open_link": 0,
	"partner_application_approved":   2,
	"partner_granted":                2,
	"partner_application_rejected":   1,
	"partner_payout_approved":        1,
	"partner_payout_paid":            2,
	"partner_payout_rejected":        2,
	"partner_notify_open_link":       0,
}

// %% — экранированный процент, он аргумента не требует.
var verbRe = regexp.MustCompile(`%%|%[a-zA-Z]`)

func countVerbs(s string) int {
	n := 0
	for _, m := range verbRe.FindAllString(s, -1) {
		if m != "%%" {
			n++
		}
	}
	return n
}

// Шаблон с лишним или недостающим глаголом не падает — он молча уходит
// пользователю строкой вида «%!s(MISSING)». Поймать это можно только здесь:
// в проде сообщение уже отправлено.
func TestPartnerNotifyTemplatesMatchArgs(t *testing.T) {
	tm := translation.GetInstance()
	if err := tm.InitTranslations("../../translations", "ru"); err != nil {
		t.Fatalf("init translations: %v", err)
	}

	for _, lang := range []string{"ru", "en"} {
		for key, want := range partnerNotifyArgs {
			text := tm.GetText(lang, key)
			if text == "" {
				t.Errorf("%s/%s: перевод отсутствует", lang, key)
				continue
			}
			if got := countVerbs(text); got != want {
				t.Errorf("%s/%s: подставляем %d аргументов, в шаблоне %d глаголов: %q",
					lang, key, want, got, text)
			}
		}
	}
}

func TestFormatAmount(t *testing.T) {
	cases := map[float64]string{
		1000:    "1000 ₽",
		1000.5:  "1000.50 ₽",
		1000.55: "1000.55 ₽",
		0:       "0 ₽",
	}
	for in, want := range cases {
		if got := formatAmount(in); got != want {
			t.Errorf("formatAmount(%v) = %q, want %q", in, got, want)
		}
	}
}

func TestFormatPercent(t *testing.T) {
	cases := map[float64]string{
		40:    "40%",
		12.5:  "12.5%",
		12.05: "12.05%",
		0:     "0%",
	}
	for in, want := range cases {
		if got := formatPercent(in); got != want {
			t.Errorf("formatPercent(%v) = %q, want %q", in, got, want)
		}
	}
}

func TestEscOrDash(t *testing.T) {
	if got := escOrDash("  "); got != "—" {
		t.Errorf("пустое значение должно давать прочерк, получено %q", got)
	}
	if got := escOrDash("<b>x</b>"); got != "&lt;b&gt;x&lt;/b&gt;" {
		t.Errorf("разметка из анкеты должна экранироваться, получено %q", got)
	}
}

func TestTruncKeepsRunesIntact(t *testing.T) {
	// Обрыв по байтам разрезал бы кириллицу пополам, и Telegram отверг бы всё
	// сообщение: битый UTF-8 — ошибка запроса, а не испорченный символ.
	got := trunc("привет мир", 6)
	if got != "привет…" {
		t.Errorf("trunc = %q, want %q", got, "привет…")
	}
	if got := trunc("коротко", 100); got != "коротко" {
		t.Errorf("короткая строка не должна меняться, получено %q", got)
	}
}

// Ссылка в тексте теряется среди строк и открывает браузер мимо Telegram, поэтому
// в партнёрских уведомлениях раздел открывает именно кнопка.
func TestPartnerNotifyMarkup(t *testing.T) {
	tm := translation.GetInstance()
	if err := tm.InitTranslations("../../translations", "ru"); err != nil {
		t.Fatalf("init translations: %v", err)
	}
	n := &PartnerNotifier{tm: tm, publicURL: "https://cabinet.example.com"}

	admin := button(t, n.adminMarkup("ru", "admin_partner_notify_open_link", "/admin/partners"))
	if admin.URL != "https://cabinet.example.com/admin/partners" {
		t.Errorf("админская кнопка ведёт на %q", admin.URL)
	}
	// Уведомление админа уходит в группу, а там web_app-кнопка запрещена Bot API.
	if admin.WebApp != nil {
		t.Error("админская кнопка должна быть URL-кнопкой")
	}
	if admin.Text == "" {
		t.Error("у кнопки нет подписи")
	}

	// Без CABINET_MINI_APP_URL точки входа нет — остаётся ссылка на PublicURL.
	partner := button(t, n.partnerMarkup("ru"))
	if partner.URL != "https://cabinet.example.com/partner" {
		t.Errorf("кнопка партнёра ведёт на %q", partner.URL)
	}
	if partner.Text == "" {
		t.Error("у кнопки партнёра нет подписи")
	}
}

// Без адреса кабинета кнопка вела бы в никуда: сообщение уходит без неё.
func TestPartnerNotifyMarkupWithoutURL(t *testing.T) {
	tm := translation.GetInstance()
	if err := tm.InitTranslations("../../translations", "ru"); err != nil {
		t.Fatalf("init translations: %v", err)
	}
	n := &PartnerNotifier{tm: tm}
	if m := n.adminMarkup("ru", "admin_partner_notify_open_link", "/admin/partners"); m != nil {
		t.Errorf("без PublicURL админской кнопки быть не должно, получено %#v", m)
	}
	if m := n.partnerMarkup("ru"); m != nil {
		t.Errorf("без PublicURL кнопки партнёра быть не должно, получено %#v", m)
	}
}

func button(t *testing.T, markup models.ReplyMarkup) models.InlineKeyboardButton {
	t.Helper()
	kb, ok := markup.(models.InlineKeyboardMarkup)
	if !ok {
		t.Fatalf("ожидалась inline-клавиатура, получено %#v", markup)
	}
	if len(kb.InlineKeyboard) != 1 || len(kb.InlineKeyboard[0]) != 1 {
		t.Fatalf("ожидалась ровно одна кнопка, получено %#v", kb.InlineKeyboard)
	}
	return kb.InlineKeyboard[0][0]
}
