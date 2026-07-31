package main

import (
	"strings"
	"testing"
)

const sampleNotes = `# Релиз v4.12.1

## Вариант для GitHub Releases

## ✨ Улучшения

- Поддержка панели **Remnawave 2.8.x**.

## 🧱 Технические изменения

- Поле telegramId как **int64**.

---

## Вариант для Telegram

4.12.1 https://github.com/MrMe0ws/remnawave-telegram-shop/releases/tag/4.12.1

✨ Улучшения
• Поддержка панели Remnawave 2.8.x: клиент выровнен под актуальные требования API при создании и обновлении пользователей.

🧱 Технические изменения
• telegramId в запросах к панели передаётся как int64 без усечения.
• Имя пользователя в панели укладывается в лимит API 3–36 символов (fallback для очень длинных id).
`

func TestParseReleaseNotes(t *testing.T) {
	n, err := ParseReleaseNotes(sampleNotes)
	if err != nil {
		t.Fatal(err)
	}
	if n.Version != "4.12.1" {
		t.Fatalf("version: got %q", n.Version)
	}
	if !strings.Contains(n.ReleaseURL, "releases/tag/4.12.1") {
		t.Fatalf("url: got %q", n.ReleaseURL)
	}
	if !strings.Contains(n.GitHubBody, "## ✨ Улучшения") {
		t.Fatalf("github body missing section: %q", n.GitHubBody)
	}
	if strings.Contains(n.GitHubBody, "---") {
		t.Fatalf("github body should not contain separator: %q", n.GitHubBody)
	}
	if len(n.TGSections) != 2 {
		t.Fatalf("sections: got %d", len(n.TGSections))
	}
	if n.TGSections[0].Header != "✨ Улучшения" || len(n.TGSections[0].Items) != 1 {
		t.Fatalf("section0: %+v", n.TGSections[0])
	}
	if n.TGSections[1].Header != "🧱 Технические изменения" || len(n.TGSections[1].Items) != 2 {
		t.Fatalf("section1: %+v", n.TGSections[1])
	}
}

func TestParseVersionLineParen(t *testing.T) {
	v, u, err := parseVersionLine("4.12.1 (https://github.com/MrMe0ws/remnawave-telegram-shop/releases/tag/4.12.1)")
	if err != nil {
		t.Fatal(err)
	}
	if v != "4.12.1" {
		t.Fatalf("version %q", v)
	}
	if !strings.HasPrefix(u, "https://") {
		t.Fatalf("url %q", u)
	}
}

func TestFormatTelegramHTML(t *testing.T) {
	n, err := ParseReleaseNotes(sampleNotes)
	if err != nil {
		t.Fatal(err)
	}
	html := FormatTelegramHTML(n, TelegramFooter{
		Text:          "Meows VPN Group",
		URL:           "https://t.me/meows_vpn_bot",
		CustomEmojiID: "5451703345746058024",
	})
	wantParts := []string{
		`<a href="https://github.com/MrMe0ws/remnawave-telegram-shop/releases/tag/4.12.1">4.12.1</a>`,
		`<b>✨ Улучшения</b>`,
		`• Поддержка панели Remnawave 2.8.x`,
		`<b>🧱 Технические изменения</b>`,
		`<tg-emoji emoji-id="5451703345746058024">✨</tg-emoji> <a href="https://t.me/meows_vpn_bot">Meows VPN Group</a>`,
	}
	for _, p := range wantParts {
		if !strings.Contains(html, p) {
			t.Fatalf("missing %q in:\n%s", p, html)
		}
	}
	if strings.Contains(html, "**") {
		t.Fatal("html should not contain markdown bold")
	}
}
