package handlers

import (
	"encoding/json"
	"errors"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
)

// CabinetContentHandler отдаёт runtime-контент кабинета из файлов /translations/*.
// Это позволяет менять FAQ/тексты без пересборки Docker-образа.
type CabinetContentHandler struct {
	faqCandidates []string
	appConfigCandidates []string
}

func NewCabinetContentHandler() *CabinetContentHandler {
	return &CabinetContentHandler{
		faqCandidates: []string{
			"/translations/cabinet/FAQ.json",
			filepath.Join("translations", "cabinet", "FAQ.json"),
		},
		appConfigCandidates: []string{
			"/translations/cabinet/app-config.json",
			filepath.Join("translations", "cabinet", "app-config.json"),
		},
	}
}

// FAQ — GET /cabinet/api/content/faq
func (h *CabinetContentHandler) FAQ(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := h.readFirstExisting(h.faqCandidates)
	if err != nil {
		http.Error(w, "faq config not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(body)
}

// AppConfig — GET /cabinet/api/content/app-config
func (h *CabinetContentHandler) AppConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := h.readFirstExisting(h.appConfigCandidates)
	if err != nil {
		http.Error(w, "app config not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(body)
}

// PWAManifest — GET /cabinet/api/public/pwa-manifest.webmanifest
func (h *CabinetContentHandler) PWAManifest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	iconSrc := "/cabinet/favicon.svg"
	iconType := "image/svg+xml"
	if u := strings.TrimSpace(cabcfg.BrandLogoURLForClient()); u != "" {
		iconSrc = u
		ext := strings.ToLower(filepath.Ext(u))
		if mt := mime.TypeByExtension(ext); mt != "" {
			iconType = mt
		}
	}
	manifest := map[string]any{
		"name":             cabcfg.PWAAppName(),
		"short_name":       cabcfg.PWAShortName(),
		"start_url":        "/cabinet/",
		"scope":            "/cabinet/",
		"display":          "standalone",
		"background_color": "#0a0f1e",
		"theme_color":      "#0a0f1e",
		"icons": []map[string]any{
			{
				"src":   iconSrc,
				"sizes": "any",
				"type":  iconType,
			},
		},
	}
	w.Header().Set("Content-Type", "application/manifest+json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(manifest)
}

func (h *CabinetContentHandler) readFirstExisting(candidates []string) ([]byte, error) {
	var lastErr error
	for _, p := range candidates {
		b, err := os.ReadFile(p)
		if err == nil {
			return b, nil
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = os.ErrNotExist
	}
	if errors.Is(lastErr, os.ErrNotExist) {
		return nil, os.ErrNotExist
	}
	return nil, lastErr
}
