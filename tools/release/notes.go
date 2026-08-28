package main

import (
	"fmt"
	"strings"
)

// ReleaseNotes is the parsed content of RELEASE_NOTES.md.
type ReleaseNotes struct {
	Version      string
	GitHubBody   string
	TelegramRaw  string // source block under "## Вариант для Telegram"
	ReleaseURL   string
	TGSections   []TGSection
}

// TGSection is one section in the Telegram variant (header + bullets).
type TGSection struct {
	Header string
	Items  []string
}

const (
	githubHeading   = "## Вариант для GitHub Releases"
	telegramHeading = "## Вариант для Telegram"
)

// ParseReleaseNotes parses RELEASE_NOTES.md with the skill's two-block layout.
func ParseReleaseNotes(content string) (*ReleaseNotes, error) {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("RELEASE_NOTES.md is empty")
	}

	ghIdx := strings.Index(content, githubHeading)
	tgIdx := strings.Index(content, telegramHeading)
	if ghIdx < 0 {
		return nil, fmt.Errorf("missing %q section", githubHeading)
	}
	if tgIdx < 0 {
		return nil, fmt.Errorf("missing %q section", telegramHeading)
	}
	if tgIdx < ghIdx {
		return nil, fmt.Errorf("Telegram section must follow GitHub section")
	}

	ghBody := strings.TrimSpace(content[ghIdx+len(githubHeading) : tgIdx])
	ghBody = stripTrailingMarkdownRule(ghBody)

	tgRaw := strings.TrimSpace(content[tgIdx+len(telegramHeading):])
	version, releaseURL, sections, err := parseTelegramBlock(tgRaw)
	if err != nil {
		return nil, err
	}

	return &ReleaseNotes{
		Version:     version,
		GitHubBody:  ghBody,
		TelegramRaw: tgRaw,
		ReleaseURL:  releaseURL,
		TGSections:  sections,
	}, nil
}

func stripTrailingMarkdownRule(s string) string {
	s = strings.TrimSpace(s)
	lines := strings.Split(s, "\n")
	for len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "---" {
		lines = lines[:len(lines)-1]
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func parseTelegramBlock(raw string) (version, releaseURL string, sections []TGSection, err error) {
	lines := strings.Split(raw, "\n")
	if len(lines) == 0 || strings.TrimSpace(lines[0]) == "" {
		return "", "", nil, fmt.Errorf("telegram block: missing version line")
	}

	version, releaseURL, err = parseVersionLine(strings.TrimSpace(lines[0]))
	if err != nil {
		return "", "", nil, err
	}

	var cur *TGSection
	for _, line := range lines[1:] {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "• ") || strings.HasPrefix(trimmed, "•") {
			item := strings.TrimSpace(strings.TrimPrefix(trimmed, "•"))
			item = strings.TrimSpace(item)
			if cur == nil {
				return "", "", nil, fmt.Errorf("telegram block: bullet without section header: %q", trimmed)
			}
			cur.Items = append(cur.Items, item)
			continue
		}
		// New section header
		if cur != nil {
			sections = append(sections, *cur)
		}
		cur = &TGSection{Header: trimmed}
	}
	if cur != nil {
		sections = append(sections, *cur)
	}
	return version, releaseURL, sections, nil
}

func parseVersionLine(line string) (version, releaseURL string, err error) {
	// Preferred: "4.12.1 https://github.com/.../releases/tag/4.12.1"
	// Also accept: "4.12.1 (https://github.com/...)"
	fields := strings.Fields(line)
	if len(fields) == 0 {
		return "", "", fmt.Errorf("telegram block: empty version line")
	}
	version = normalizeReleaseVersion(strings.Trim(fields[0], "()"))
	if version == "" {
		return "", "", fmt.Errorf("telegram block: empty version")
	}
	if len(fields) == 1 {
		return "", "", fmt.Errorf("telegram block: version line must include release URL")
	}
	urlPart := strings.Join(fields[1:], " ")
	urlPart = strings.TrimSpace(urlPart)
	urlPart = strings.TrimPrefix(urlPart, "(")
	urlPart = strings.TrimSuffix(urlPart, ")")
	urlPart = strings.TrimSpace(urlPart)
	if !strings.HasPrefix(urlPart, "https://") {
		return "", "", fmt.Errorf("telegram block: release URL must start with https:// (got %q)", urlPart)
	}
	return version, urlPart, nil
}

// normalizeReleaseVersion strips an optional leading "v" so tags stay 4.12.2
// (repo convention — never v4.12.2).
func normalizeReleaseVersion(version string) string {
	version = strings.TrimSpace(version)
	return strings.TrimPrefix(version, "v")
}

// TelegramFooter is the optional signature block at the end of a TG post.
type TelegramFooter struct {
	Text           string
	URL            string
	CustomEmojiID  string // numeric id for <tg-emoji emoji-id="…">
	CustomEmojiAlt string // fallback unicode emoji inside the tag (required by API)
}

// collapsibleHeaders — секции, которые сворачиваются в раскрывающуюся цитату.
//
// «Новое» намеренно не сворачивается: это то, ради чего пост и читают, и
// прятать его под кат бессмысленно. Остальные разделы длинные, но
// второстепенные — в лениво прокручиваемом канале они забивают собой всё.
var collapsibleHeaders = []string{"Улучшения", "Исправления", "При обновлении", "Технические изменения", "Breaking changes"}

// collapsibleMinItems — порог: сворачиваем только то, что реально занимает
// место. Один-два пункта под катом лишь добавляют лишний тап.
const collapsibleMinItems = 3

// collapsibleSection решает, прятать ли пункты секции в <blockquote expandable>.
// Заголовок приходит с эмодзи («🐛 Исправления»), поэтому сверяем по вхождению.
func collapsibleSection(sec TGSection) bool {
	if len(sec.Items) < collapsibleMinItems {
		return false
	}
	for _, name := range collapsibleHeaders {
		if strings.Contains(sec.Header, name) {
			return true
		}
	}
	return false
}

// FormatTelegramHTML builds HTML for Telegram Bot API (parse_mode=HTML).
// Version is a clickable link; section headers are bold; footer is optional custom emoji + link.
//
// Длинные второстепенные секции уходят в <blockquote expandable> — см.
// collapsibleSection. На лимит 4096 это не влияет: Telegram считает символы
// текста, а не разметку, поэтому сворачивание не заменяет сокращение текста.
func FormatTelegramHTML(n *ReleaseNotes, footer TelegramFooter) string {
	var b strings.Builder
	b.WriteString(`<a href="`)
	b.WriteString(escapeHTMLAttr(n.ReleaseURL))
	b.WriteString(`">`)
	b.WriteString(escapeHTML(n.Version))
	b.WriteString(`</a>`)

	for si, sec := range n.TGSections {
		if si == 0 {
			// Одна пустая строка между версией и первой секцией.
			b.WriteString("\n\n")
		} else {
			// Две пустые строки между секциями.
			b.WriteString("\n\n\n")
		}
		b.WriteString("<b>")
		b.WriteString(escapeHTML(sec.Header))
		b.WriteString("</b>")

		collapse := collapsibleSection(sec)
		if collapse {
			// Пустая строка отделяет заголовок от цитаты; внутри блока
			// Telegram сам показывает первые строки и кнопку разворота.
			b.WriteString("\n\n<blockquote expandable>")
		}
		for i, item := range sec.Items {
			if collapse {
				// Внутри цитаты пустая строка перед первым пунктом добавила бы
				// пустую строку в свёрнутом виде — она съедает и без того
				// короткое превью.
				if i > 0 {
					b.WriteString("\n\n")
				}
				b.WriteString("• ")
			} else {
				// Пустая строка после заголовка и между пунктами.
				b.WriteString("\n\n• ")
			}
			b.WriteString(escapeHTML(item))
		}
		if collapse {
			b.WriteString("</blockquote>")
		}
	}

	footer.Text = strings.TrimSpace(footer.Text)
	footer.URL = strings.TrimSpace(footer.URL)
	footer.CustomEmojiID = strings.TrimSpace(footer.CustomEmojiID)
	footer.CustomEmojiAlt = strings.TrimSpace(footer.CustomEmojiAlt)
	if footer.Text != "" && footer.URL != "" {
		b.WriteString("\n\n")
		if footer.CustomEmojiID != "" {
			alt := footer.CustomEmojiAlt
			if alt == "" {
				alt = "✨"
			}
			b.WriteString(`<tg-emoji emoji-id="`)
			b.WriteString(escapeHTMLAttr(footer.CustomEmojiID))
			b.WriteString(`">`)
			b.WriteString(escapeHTML(alt))
			b.WriteString(`</tg-emoji> `)
		}
		b.WriteString(`<a href="`)
		b.WriteString(escapeHTMLAttr(footer.URL))
		b.WriteString(`">`)
		b.WriteString(escapeHTML(footer.Text))
		b.WriteString(`</a>`)
	}

	return b.String()
}

func escapeHTML(s string) string {
	r := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
	)
	return r.Replace(s)
}

func escapeHTMLAttr(s string) string {
	return escapeHTML(s)
}
