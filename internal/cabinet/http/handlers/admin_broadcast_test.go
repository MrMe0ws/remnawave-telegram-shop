package handlers

import "testing"

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

func TestBroadcastImageContentType(t *testing.T) {
	asPhoto, ok := broadcastImageContentType("image/png")
	if !ok || !asPhoto {
		t.Fatalf("png: ok=%v asPhoto=%v", ok, asPhoto)
	}
	_, ok = broadcastImageContentType("image/gif")
	if ok {
		t.Fatal("gif should fail")
	}
}
