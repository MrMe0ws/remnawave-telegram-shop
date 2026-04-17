package handler

import (
	"html"
	"strconv"
	"strings"
	"unicode/utf16"

	"github.com/go-telegram/bot/models"
)

// utf16UnitsLen returns the number of UTF-16 code units in s (Telegram Bot API offsets use UTF-16).
func utf16UnitsLen(s string) int {
	return len(utf16.Encode([]rune(s)))
}

func utf16SliceString(u16 []uint16, offset, length int) string {
	if offset < 0 || length < 0 || offset+length > len(u16) {
		return ""
	}
	return string(utf16.Decode(u16[offset : offset+length]))
}

func filterMessageEntities(utf16Len int, entities []models.MessageEntity) []models.MessageEntity {
	if len(entities) == 0 {
		return nil
	}
	out := make([]models.MessageEntity, 0, len(entities))
	for _, e := range entities {
		if e.Length <= 0 {
			continue
		}
		if e.Offset < 0 || e.Offset+e.Length > utf16Len {
			continue
		}
		out = append(out, e)
	}
	return out
}

func nestedInside(parent models.MessageEntity, all []models.MessageEntity) []models.MessageEntity {
	pEnd := parent.Offset + parent.Length
	var out []models.MessageEntity
	for _, e := range all {
		if e.Offset >= parent.Offset && e.Offset+e.Length <= pEnd &&
			!(e.Offset == parent.Offset && e.Length == parent.Length) {
			out = append(out, e)
		}
	}
	return out
}

// messageEntitiesToHTML converts Telegram message text + entities to HTML (ParseMode HTML).
// Entity offsets and lengths are UTF-16 code units per Bot API.
func messageEntitiesToHTML(text string, entities []models.MessageEntity) string {
	u16 := utf16.Encode([]rune(text))
	valid := filterMessageEntities(len(u16), entities)
	if len(valid) == 0 {
		return html.EscapeString(text)
	}
	return renderUTF16RangeHTML(u16, 0, len(u16), valid)
}

func renderUTF16RangeHTML(u16 []uint16, absStart, absEnd int, all []models.MessageEntity) string {
	var sb strings.Builder
	pos := absStart
	for pos < absEnd {
		var outer *models.MessageEntity
		for i := range all {
			e := &all[i]
			if e.Offset == pos && e.Offset+e.Length <= absEnd {
				if outer == nil || e.Length > outer.Length {
					outer = e
				}
			}
		}
		if outer == nil {
			next := absEnd
			for i := range all {
				e := &all[i]
				if e.Offset > pos && e.Offset < next {
					next = e.Offset
				}
			}
			sb.WriteString(html.EscapeString(utf16SliceString(u16, pos, next-pos)))
			pos = next
			continue
		}
		rawSeg := utf16SliceString(u16, outer.Offset, outer.Length)
		inner := renderUTF16RangeHTML(u16, outer.Offset, outer.Offset+outer.Length, nestedInside(*outer, all))
		sb.WriteString(wrapMessageEntityHTML(*outer, inner, rawSeg))
		pos = outer.Offset + outer.Length
	}
	return sb.String()
}

func wrapMessageEntityHTML(e models.MessageEntity, inner, rawSegment string) string {
	switch e.Type {
	case models.MessageEntityTypeBold:
		return "<b>" + inner + "</b>"
	case models.MessageEntityTypeItalic:
		return "<i>" + inner + "</i>"
	case models.MessageEntityTypeUnderline:
		return "<u>" + inner + "</u>"
	case models.MessageEntityTypeStrikethrough:
		return "<s>" + inner + "</s>"
	case models.MessageEntityTypeSpoiler:
		return "<tg-spoiler>" + inner + "</tg-spoiler>"
	case models.MessageEntityTypeCode:
		return "<code>" + inner + "</code>"
	case models.MessageEntityTypePre:
		if e.Language != "" {
			return "<pre><code class=\"language-" + html.EscapeString(e.Language) + "\">" + inner + "</code></pre>"
		}
		return "<pre>" + inner + "</pre>"
	case models.MessageEntityTypeTextLink:
		return "<a href=\"" + html.EscapeString(e.URL) + "\">" + inner + "</a>"
	case models.MessageEntityTypeTextMention:
		if e.User != nil {
			return "<a href=\"tg://user?id=" + strconv.FormatInt(e.User.ID, 10) + "\">" + inner + "</a>"
		}
		return inner
	case models.MessageEntityTypeCustomEmoji:
		id := html.EscapeString(e.CustomEmojiID)
		return "<tg-emoji emoji-id=\"" + id + "\">" + inner + "</tg-emoji>"
	case models.MessageEntityTypeBlockquote:
		return "<blockquote>" + inner + "</blockquote>"
	case models.MessageEntityTypeExpandableBlockquote:
		return "<blockquote expandable>" + inner + "</blockquote>"
	case models.MessageEntityTypeURL:
		return "<a href=\"" + html.EscapeString(rawSegment) + "\">" + inner + "</a>"
	case models.MessageEntityTypeEmail:
		return "<a href=\"mailto:" + html.EscapeString(rawSegment) + "\">" + inner + "</a>"
	case models.MessageEntityTypePhoneNumber:
		tel := strings.ReplaceAll(rawSegment, " ", "")
		return "<a href=\"tel:" + html.EscapeString(tel) + "\">" + inner + "</a>"
	default:
		return inner
	}
}
