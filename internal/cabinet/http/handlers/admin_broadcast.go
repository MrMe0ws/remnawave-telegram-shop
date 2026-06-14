package handlers

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/broadcast"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
)

const broadcastMediaMaxBytes = 10 << 20 // 10 MiB

var (
	broadcastSendMu      sync.Mutex
	broadcastSendRunning bool
)

func tryAcquireBroadcastSend() bool {
	broadcastSendMu.Lock()
	defer broadcastSendMu.Unlock()
	if broadcastSendRunning {
		return false
	}
	broadcastSendRunning = true
	return true
}

func releaseBroadcastSend() {
	broadcastSendMu.Lock()
	broadcastSendRunning = false
	broadcastSendMu.Unlock()
}

type AdminBroadcastHandler struct {
	customers *database.CustomerRepository
	tariffs   *database.TariffRepository
	sender    *broadcast.Sender
	bot       *bot.Bot
}

func NewAdminBroadcast(
	customers *database.CustomerRepository,
	tariffs *database.TariffRepository,
	sender *broadcast.Sender,
	tgBot *bot.Bot,
) *AdminBroadcastHandler {
	return &AdminBroadcastHandler{
		customers: customers,
		tariffs:   tariffs,
		sender:    sender,
		bot:       tgBot,
	}
}

type broadcastAudienceResp struct {
	Audience string `json:"audience"`
	Label    string `json:"label"`
	Count    int    `json:"count"`
}

var broadcastAudienceValues = []string{
	database.BroadcastAudienceAll,
	database.BroadcastAudienceActiveAll,
	database.BroadcastAudienceActivePaid,
	database.BroadcastAudienceActiveTrial,
	database.BroadcastAudienceInactiveAll,
	database.BroadcastAudienceInactivePaid,
	database.BroadcastAudienceInactiveTrial,
}

func isValidBroadcastAudience(audience string) bool {
	for _, aud := range broadcastAudienceValues {
		if aud == audience {
			return true
		}
	}
	return false
}

// Audiences returns available broadcast segments with recipient counts.
func (h *AdminBroadcastHandler) Audiences(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	var result []broadcastAudienceResp
	for _, aud := range broadcastAudienceValues {
		recipients, err := h.customers.GetBroadcastRecipients(ctx, aud, nil)
		if err != nil {
			slog.Warn("admin broadcast: audience count", "audience", aud, "error", err)
			continue
		}
		result = append(result, broadcastAudienceResp{
			Audience: aud,
			Label:    aud,
			Count:    len(recipients),
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"audiences": result})
}

type broadcastButtonsReq struct {
	Buy      bool `json:"buy"`
	Connect  bool `json:"connect"`
	Promo    bool `json:"promo"`
	MainMenu bool `json:"main_menu"`
}

type broadcastMediaReq struct {
	FileID  string `json:"file_id"`
	AsPhoto bool   `json:"as_photo"`
}

type broadcastSendReq struct {
	Audience string             `json:"audience"`
	TariffID *int64             `json:"tariff_id,omitempty"`
	Text     string             `json:"text"`
	Buttons  *broadcastButtonsReq `json:"buttons,omitempty"`
	Media    *broadcastMediaReq   `json:"media,omitempty"`
}

func (req *broadcastSendReq) normalize() {
	req.Text = strings.TrimSpace(req.Text)
	req.Audience = strings.TrimSpace(req.Audience)
	if req.Media != nil {
		req.Media.FileID = strings.TrimSpace(req.Media.FileID)
		if req.Media.FileID == "" {
			req.Media = nil
		}
	}
}

func (req *broadcastSendReq) hasContent() bool {
	return req.Text != "" || req.Media != nil
}

func (req *broadcastSendReq) recipientButtons() broadcast.RecipientButtons {
	if req.Buttons == nil {
		return broadcast.RecipientButtons{}
	}
	return broadcast.RecipientButtons{
		Buy:      req.Buttons.Buy,
		Connect:  req.Buttons.Connect,
		Promo:    req.Buttons.Promo,
		MainMenu: req.Buttons.MainMenu,
	}
}

func (req *broadcastSendReq) recipientMedia() *broadcast.Media {
	if req.Media == nil {
		return nil
	}
	return &broadcast.Media{
		FileID:  req.Media.FileID,
		AsPhoto: req.Media.AsPhoto,
	}
}

// Preview returns the count of recipients for a given audience/tariff combo.
func (h *AdminBroadcastHandler) Preview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req broadcastSendReq
	if !decodeJSON(w, r, &req) {
		return
	}
	req.normalize()
	if req.Audience == "" {
		http.Error(w, "audience required", http.StatusBadRequest)
		return
	}
	if !isValidBroadcastAudience(req.Audience) {
		http.Error(w, "invalid audience", http.StatusBadRequest)
		return
	}

	recipients, err := h.customers.GetBroadcastRecipients(r.Context(), req.Audience, req.TariffID)
	if err != nil {
		slog.Error("admin broadcast: preview", "error", err)
		http.Error(w, "failed to count recipients", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"audience":        req.Audience,
		"recipient_count": len(recipients),
	})
}

// Tariffs returns tariff list for audience filtering (tariffs mode).
func (h *AdminBroadcastHandler) Tariffs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	tariffs, err := h.tariffs.ListActive(r.Context())
	if err != nil {
		slog.Error("admin broadcast: tariffs list", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	type tariffBrief struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	var items []tariffBrief
	for _, t := range tariffs {
		name := t.Slug
		if t.Name != nil {
			name = *t.Name
		}
		items = append(items, tariffBrief{ID: t.ID, Name: name, Slug: t.Slug})
	}
	writeJSON(w, http.StatusOK, map[string]any{"tariffs": items})
}

// UploadMedia uploads an image to Telegram and returns file_id for broadcast reuse.
func (h *AdminBroadcastHandler) UploadMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.bot == nil || h.sender == nil {
		http.Error(w, "broadcast unavailable", http.StatusServiceUnavailable)
		return
	}

	adminID := config.GetAdminTelegramId()
	if adminID == 0 {
		http.Error(w, "admin telegram id not configured", http.StatusServiceUnavailable)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, broadcastMediaMaxBytes+1024)
	if err := r.ParseMultipartForm(broadcastMediaMaxBytes); err != nil {
		http.Error(w, "invalid multipart form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("media")
	if err != nil {
		http.Error(w, "media file required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, broadcastMediaMaxBytes))
	if err != nil {
		http.Error(w, "failed to read media", http.StatusBadRequest)
		return
	}
	if len(data) == 0 {
		http.Error(w, "empty media file", http.StatusBadRequest)
		return
	}

	filename := "broadcast.jpg"
	if header != nil && strings.TrimSpace(header.Filename) != "" {
		filename = strings.TrimSpace(header.Filename)
	}

	contentType := ""
	if header != nil {
		contentType = strings.ToLower(strings.TrimSpace(header.Header.Get("Content-Type")))
	}
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = strings.ToLower(strings.TrimSpace(mime.TypeByExtension(filename)))
	}
	asPhoto, ok := broadcastImageContentType(contentType)
	if !ok {
		http.Error(w, "unsupported image type (jpeg, png, webp only)", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var sent *models.Message
	if asPhoto {
		sent, err = h.bot.SendPhoto(ctx, &bot.SendPhotoParams{
			ChatID: adminID,
			Photo: &models.InputFileUpload{
				Filename: filename,
				Data:     bytes.NewReader(data),
			},
		})
	} else {
		sent, err = h.bot.SendDocument(ctx, &bot.SendDocumentParams{
			ChatID: adminID,
			Document: &models.InputFileUpload{
				Filename: filename,
				Data:     bytes.NewReader(data),
			},
		})
	}
	if err != nil {
		slog.Error("admin broadcast: upload media", "error", err)
		http.Error(w, "failed to upload media to telegram", http.StatusBadGateway)
		return
	}

	fileID, extractPhoto := extractTelegramFileID(sent)
	if fileID == "" {
		http.Error(w, "failed to resolve telegram file_id", http.StatusBadGateway)
		return
	}

	if sent != nil {
		_, _ = h.bot.DeleteMessage(ctx, &bot.DeleteMessageParams{
			ChatID:    adminID,
			MessageID: sent.ID,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"file_id":  fileID,
		"as_photo": extractPhoto,
	})
}

func broadcastImageContentType(contentType string) (asPhoto bool, ok bool) {
	switch contentType {
	case "image/jpeg", "image/jpg", "image/png", "image/webp":
		return true, true
	default:
		return false, false
	}
}

func extractTelegramFileID(msg *models.Message) (fileID string, asPhoto bool) {
	if msg == nil {
		return "", false
	}
	if len(msg.Photo) > 0 {
		last := msg.Photo[len(msg.Photo)-1]
		return last.FileID, true
	}
	if msg.Document != nil {
		return msg.Document.FileID, false
	}
	return "", false
}

// Send starts a Telegram broadcast using the same delivery logic as TG admin panel.
func (h *AdminBroadcastHandler) Send(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.bot == nil || h.sender == nil {
		http.Error(w, "broadcast unavailable", http.StatusServiceUnavailable)
		return
	}

	var req broadcastSendReq
	if !decodeJSON(w, r, &req) {
		return
	}
	req.normalize()
	if req.Audience == "" {
		http.Error(w, "audience required", http.StatusBadRequest)
		return
	}
	if !isValidBroadcastAudience(req.Audience) {
		http.Error(w, "invalid audience", http.StatusBadRequest)
		return
	}
	if !req.hasContent() {
		http.Error(w, "text or media required", http.StatusBadRequest)
		return
	}

	recipients, err := h.customers.GetBroadcastRecipients(r.Context(), req.Audience, req.TariffID)
	if err != nil {
		slog.Error("admin broadcast: send", "error", err)
		http.Error(w, "failed to get recipients", http.StatusInternalServerError)
		return
	}
	if len(recipients) == 0 {
		http.Error(w, "no recipients", http.StatusBadRequest)
		return
	}
	if !tryAcquireBroadcastSend() {
		http.Error(w, "broadcast already in progress", http.StatusConflict)
		return
	}

	adminID := config.GetAdminTelegramId()
	payload := req
	recipientCount := len(recipients)

	go func() {
		defer releaseBroadcastSend()
		ctx := context.Background()
		if adminID != 0 {
			_, _ = h.bot.SendMessage(ctx, &bot.SendMessageParams{
				ChatID: adminID,
				Text:   "⏳ Рассылка из web-админки запущена. Ожидайте итоговое сообщение…",
			})
		}
		h.sender.Send(
			ctx,
			h.bot,
			adminID,
			payload.Audience,
			payload.TariffID,
			payload.Text,
			nil,
			payload.recipientMedia(),
			payload.recipientButtons(),
		)
	}()

	slog.Info("admin broadcast: send started",
		"audience", req.Audience,
		"recipients", recipientCount,
		"text_len", len(req.Text),
		"has_media", req.Media != nil,
	)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"status":          "started",
		"recipient_count": recipientCount,
	})
}

// CountByAudience is a helper endpoint to count for specific audience via query param.
func (h *AdminBroadcastHandler) CountByAudience(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	audience := r.URL.Query().Get("audience")
	if audience == "" {
		audience = database.BroadcastAudienceAll
	}

	var tariffID *int64
	if t := r.URL.Query().Get("tariff_id"); t != "" {
		v, err := strconv.ParseInt(t, 10, 64)
		if err == nil {
			tariffID = &v
		}
	}

	recipients, err := h.customers.GetBroadcastRecipients(r.Context(), audience, tariffID)
	if err != nil {
		slog.Error("admin broadcast: count", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"audience":        audience,
		"recipient_count": len(recipients),
	})
}
