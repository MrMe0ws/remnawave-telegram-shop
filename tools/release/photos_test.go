package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime"
	"mime/multipart"
	"os"
	"path/filepath"
	"testing"
)

func writeFiles(t *testing.T, dir string, names ...string) {
	t.Helper()
	for _, n := range names {
		if err := os.WriteFile(filepath.Join(dir, n), []byte("png"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
}

// Порядок альбома — по имени файла, лишние файлы в папке не уходят.
func TestListReleasePhotosOrderAndFilter(t *testing.T) {
	dir := t.TempDir()
	writeFiles(t, dir, "02-history.png", "01-audiences.PNG", "notes.txt", "03-phone.webp")
	got, err := listReleasePhotos(dir)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, p := range got {
		names = append(names, filepath.Base(p))
	}
	want := []string{"01-audiences.PNG", "02-history.png", "03-phone.webp"}
	if fmt.Sprint(names) != fmt.Sprint(want) {
		t.Fatalf("got %v, want %v", names, want)
	}
}

func TestListReleasePhotosMissingDirAndLimit(t *testing.T) {
	got, err := listReleasePhotos(filepath.Join(t.TempDir(), "nope"))
	if err != nil || got != nil {
		t.Fatalf("missing dir: %v %v, want no album and no error", got, err)
	}
	dir := t.TempDir()
	for i := 0; i < telegramMaxAlbum+1; i++ {
		writeFiles(t, dir, fmt.Sprintf("%02d.png", i))
	}
	if _, err := listReleasePhotos(dir); err == nil {
		t.Fatal("11 photos must be rejected: Telegram album takes 10")
	}
}

// В media каждое фото ссылается на свою часть multipart, подпись — только у
// первого, ответ — на пост релиза в той же теме.
func TestBuildMediaGroup(t *testing.T) {
	dir := t.TempDir()
	writeFiles(t, dir, "a.png", "b.png")
	cfg := telegramConfig{ChatID: "@chat", MessageThreadID: 31}
	body, contentType, err := buildMediaGroup(cfg, 777, "Как это выглядит", []string{filepath.Join(dir, "a.png"), filepath.Join(dir, "b.png")})
	if err != nil {
		t.Fatal(err)
	}
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		t.Fatal(err)
	}
	form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(1 << 20)
	if err != nil {
		t.Fatal(err)
	}
	if form.Value["chat_id"][0] != "@chat" || form.Value["message_thread_id"][0] != "31" {
		t.Fatalf("fields = %v", form.Value)
	}
	var reply map[string]any
	if err := json.Unmarshal([]byte(form.Value["reply_parameters"][0]), &reply); err != nil || reply["message_id"] != float64(777) {
		t.Fatalf("reply_parameters = %v (%v)", form.Value["reply_parameters"], err)
	}
	var media []inputMediaPhoto
	if err := json.Unmarshal([]byte(form.Value["media"][0]), &media); err != nil {
		t.Fatal(err)
	}
	if len(media) != 2 || media[0].Media != "attach://photo0" || media[1].Media != "attach://photo1" {
		t.Fatalf("media = %+v", media)
	}
	if media[0].Caption == "" || media[1].Caption != "" {
		t.Fatalf("caption must be on the first photo only: %+v", media)
	}
	if len(form.File["photo0"]) != 1 || len(form.File["photo1"]) != 1 {
		t.Fatalf("files = %v", form.File)
	}
}
