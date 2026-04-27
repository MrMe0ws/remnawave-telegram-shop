package handlers

import (
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
)

const maxBrandLogoBytes = 5 << 20 // 5 MiB

// ServeBrandLogo отдаёт один настроенный файл (абсолютный путь из конфига).
// Регистрируется только если путь непустой и валиден при старте.
func ServeBrandLogo(absPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
			return
		}
		f, err := os.Open(absPath)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()

		ct := mime.TypeByExtension(filepath.Ext(absPath))
		if ct == "" {
			ct = "application/octet-stream"
		}
		w.Header().Set("Content-Type", ct)
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = io.Copy(w, io.LimitReader(f, maxBrandLogoBytes))
	}
}
