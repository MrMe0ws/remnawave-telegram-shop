package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Скриншоты к релизу уходят альбомом ответом на пост: в одном сообщении
// Telegram не умеет и длинный текст, и картинки — подпись к фото режется на
// 1024 символах, а пост релиза обычно длиннее.

const (
	defaultPhotosDir = "release-screenshots"
	// Больше десяти Telegram в одну группу не принимает.
	telegramMaxAlbum = 10
	// Предел Bot API на фото, загружаемое файлом.
	telegramMaxPhotoBytes = 10 << 20
)

var photoExts = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".webp": true}

// releasePhotosDir — папка со скриншотами: RELEASE_TG_PHOTOS_DIR или
// release-screenshots в корне репозитория.
func releasePhotosDir(root string) string {
	dir := strings.TrimSpace(os.Getenv("RELEASE_TG_PHOTOS_DIR"))
	if dir == "" {
		dir = defaultPhotosDir
	}
	if !filepath.IsAbs(dir) {
		dir = filepath.Join(root, dir)
	}
	return dir
}

// listReleasePhotos — картинки из папки по имени файла: порядок в альбоме
// задаётся префиксом вроде 01-, 02-. Нет папки — нет альбома, это не ошибка.
func listReleasePhotos(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", dir, err)
	}
	var out []string
	for _, e := range entries {
		if e.IsDir() || !photoExts[strings.ToLower(filepath.Ext(e.Name()))] {
			continue
		}
		out = append(out, filepath.Join(dir, e.Name()))
	}
	sort.Strings(out)
	if len(out) > telegramMaxAlbum {
		return nil, fmt.Errorf("%d screenshots in %s: Telegram album takes at most %d", len(out), dir, telegramMaxAlbum)
	}
	for _, p := range out {
		st, err := os.Stat(p)
		if err != nil {
			return nil, err
		}
		if st.Size() > telegramMaxPhotoBytes {
			return nil, fmt.Errorf("%s is %d bytes: Telegram accepts photos up to 10 MB", filepath.Base(p), st.Size())
		}
	}
	return out, nil
}

type inputMediaPhoto struct {
	Type    string `json:"type"`
	Media   string `json:"media"`
	Caption string `json:"caption,omitempty"`
}

// buildMediaGroup — тело sendMediaGroup: файлы прикладываются частями
// multipart и упоминаются в media как attach://<имя части>.
func buildMediaGroup(cfg telegramConfig, replyTo int, caption string, photos []string) ([]byte, string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	media := make([]inputMediaPhoto, 0, len(photos))
	for i, p := range photos {
		part := fmt.Sprintf("photo%d", i)
		item := inputMediaPhoto{Type: "photo", Media: "attach://" + part}
		// Подпись у первого фото Telegram показывает как подпись всего альбома.
		if i == 0 {
			item.Caption = caption
		}
		media = append(media, item)

		f, err := os.Open(p)
		if err != nil {
			return nil, "", err
		}
		fw, err := w.CreateFormFile(part, filepath.Base(p))
		if err != nil {
			f.Close()
			return nil, "", err
		}
		if _, err := io.Copy(fw, f); err != nil {
			f.Close()
			return nil, "", err
		}
		f.Close()
	}

	mediaJSON, err := json.Marshal(media)
	if err != nil {
		return nil, "", err
	}
	fields := map[string]string{"chat_id": cfg.ChatID, "media": string(mediaJSON)}
	if cfg.MessageThreadID > 0 {
		fields["message_thread_id"] = fmt.Sprint(cfg.MessageThreadID)
	}
	if replyTo > 0 {
		reply, _ := json.Marshal(map[string]any{"message_id": replyTo, "allow_sending_without_reply": true})
		fields["reply_parameters"] = string(reply)
	}
	for k, v := range fields {
		if err := w.WriteField(k, v); err != nil {
			return nil, "", err
		}
	}
	if err := w.Close(); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), w.FormDataContentType(), nil
}

// sendTelegramPhotos отправляет скриншоты альбомом ответом на пост replyTo.
func sendTelegramPhotos(cfg telegramConfig, replyTo int, caption string, photos []string) error {
	if len(photos) == 0 {
		return nil
	}
	body, contentType, err := buildMediaGroup(cfg, replyTo, caption, photos)
	if err != nil {
		return fmt.Errorf("build album: %w", err)
	}
	_, err = callTelegram(cfg, "sendMediaGroup", contentType, body)
	return err
}

func photosCaption(version string) string {
	return fmt.Sprintf("Как это выглядит в %s", version)
}
