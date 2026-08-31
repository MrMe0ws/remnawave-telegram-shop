package handlers

import (
	"testing"

	"remnawave-tg-shop-bot/internal/broadcast"
)

func TestIsValidBroadcastAudience(t *testing.T) {
	if !isValidBroadcastAudience("all") {
		t.Fatal("all")
	}
	if !isValidBroadcastAudience("active_paid") {
		t.Fatal("active_paid")
	}
	if isValidBroadcastAudience("unknown") {
		t.Fatal("unknown should be invalid")
	}
}

func TestBroadcastSendReqHasContent(t *testing.T) {
	req := broadcastSendReq{Text: "  "}
	req.normalize()
	if req.hasContent() {
		t.Fatal("empty text")
	}
	req.Text = "hello"
	if !req.hasContent() {
		t.Fatal("text")
	}
	req.Text = ""
	req.Media = &broadcastMediaReq{FileID: "abc"}
	if !req.hasContent() {
		t.Fatal("media")
	}
}

func TestBroadcastMediaContentType(t *testing.T) {
	cases := map[string]broadcast.MediaKind{
		"image/png":       broadcast.MediaPhoto,
		"image/jpeg":      broadcast.MediaPhoto,
		"video/mp4":       broadcast.MediaVideo,
		"video/quicktime": broadcast.MediaVideo,
	}
	for ct, want := range cases {
		kind, ok := broadcastMediaContentType(ct)
		if !ok || kind != want {
			t.Errorf("%s: kind=%q ok=%v, want %q", ct, kind, ok, want)
		}
	}
	if _, ok := broadcastMediaContentType("image/gif"); ok {
		t.Error("gif should be rejected")
	}
	if _, ok := broadcastMediaContentType("application/pdf"); ok {
		t.Error("pdf should be rejected")
	}
}

// Неизвестный вид не должен уезжать в SendPhoto: тот на видео просто откажет.
func TestRecipientMediaFallsBackToDocument(t *testing.T) {
	req := broadcastSendReq{Media: &broadcastMediaReq{FileID: "abc", Kind: "sticker"}}
	if got := req.recipientMedia().Kind; got != broadcast.MediaDocument {
		t.Errorf("unknown kind => %q, want %q", got, broadcast.MediaDocument)
	}
	req.Media.Kind = string(broadcast.MediaVideo)
	if got := req.recipientMedia().Kind; got != broadcast.MediaVideo {
		t.Errorf("video kind => %q", got)
	}
}
