package handler

import (
	"testing"

	"github.com/go-telegram/bot/models"
)

func TestMessageEntitiesToHTML_plainEscapes(t *testing.T) {
	got := messageEntitiesToHTML(`a < b`, nil)
	if want := "a &lt; b"; got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestMessageEntitiesToHTML_bold(t *testing.T) {
	got := messageEntitiesToHTML("Hi", []models.MessageEntity{
		{Type: models.MessageEntityTypeBold, Offset: 0, Length: 2},
	})
	if want := "<b>Hi</b>"; got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestMessageEntitiesToHTML_nestedBoldItalic(t *testing.T) {
	got := messageEntitiesToHTML("hello world", []models.MessageEntity{
		{Type: models.MessageEntityTypeBold, Offset: 0, Length: 11},
		{Type: models.MessageEntityTypeItalic, Offset: 6, Length: 5},
	})
	if want := "<b>hello <i>world</i></b>"; got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestMessageEntitiesToHTML_emojiSurrogateBold(t *testing.T) {
	s := "a😀b"
	got := messageEntitiesToHTML(s, []models.MessageEntity{
		{Type: models.MessageEntityTypeBold, Offset: 1, Length: 2},
	})
	if want := "a<b>😀</b>b"; got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestMessageEntitiesToHTML_customEmoji(t *testing.T) {
	s := "x🙂y"
	got := messageEntitiesToHTML(s, []models.MessageEntity{
		{Type: models.MessageEntityTypeCustomEmoji, Offset: 1, Length: 2, CustomEmojiID: "5447410659077661506"},
	})
	if want := `x<tg-emoji emoji-id="5447410659077661506">🙂</tg-emoji>y`; got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
