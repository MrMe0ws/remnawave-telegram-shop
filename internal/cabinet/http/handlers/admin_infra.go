package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

type AdminInfraHandler struct {
	rw      *remnawave.Client
	billing *database.InfraBillingRepository
}

func NewAdminInfra(rw *remnawave.Client, billing *database.InfraBillingRepository) *AdminInfraHandler {
	return &AdminInfraHandler{rw: rw, billing: billing}
}

func (h *AdminInfraHandler) requireRW(w http.ResponseWriter) bool {
	if h.rw == nil {
		http.Error(w, "panel not configured", http.StatusServiceUnavailable)
		return false
	}
	return true
}

// Nodes returns billing nodes from Remnawave.
func (h *AdminInfraHandler) Nodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	body, err := h.rw.GetInfraBillingNodes(r.Context())
	if err != nil {
		slog.Error("admin infra: get nodes", "error", err)
		http.Error(w, "failed to fetch nodes", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

type createNodeReq struct {
	ProviderUUID  string  `json:"provider_uuid"`
	NodeUUID      string  `json:"node_uuid"`
	NextBillingAt *string `json:"next_billing_at,omitempty"`
}

// CreateNode adds a billing node.
func (h *AdminInfraHandler) CreateNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	var req createNodeReq
	if !decodeJSON(w, r, &req) {
		return
	}

	provUUID, err := uuid.Parse(req.ProviderUUID)
	if err != nil {
		http.Error(w, "invalid provider_uuid", http.StatusBadRequest)
		return
	}
	nodeUUID, err := uuid.Parse(req.NodeUUID)
	if err != nil {
		http.Error(w, "invalid node_uuid", http.StatusBadRequest)
		return
	}

	rwReq := remnawave.CreateInfraBillingNodeRequest{
		ProviderUUID: provUUID,
		NodeUUID:     nodeUUID,
	}
	if req.NextBillingAt != nil {
		t, err := parseFlexDate(*req.NextBillingAt)
		if err != nil {
			http.Error(w, "invalid next_billing_at", http.StatusBadRequest)
			return
		}
		rwReq.NextBillingAt = &t
	}

	body, err := h.rw.CreateInfraBillingNode(r.Context(), rwReq)
	if err != nil {
		slog.Error("admin infra: create node", "error", err)
		http.Error(w, "failed to create node", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

type patchNodeReq struct {
	UUID          string `json:"uuid"`
	NextBillingAt string `json:"next_billing_at"`
}

// PatchNode updates a billing node's next billing date.
func (h *AdminInfraHandler) PatchNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	var req patchNodeReq
	if !decodeJSON(w, r, &req) {
		return
	}

	billingUUID, err := uuid.Parse(req.UUID)
	if err != nil {
		http.Error(w, "invalid uuid", http.StatusBadRequest)
		return
	}
	t, err := parseFlexDate(req.NextBillingAt)
	if err != nil {
		http.Error(w, "invalid next_billing_at", http.StatusBadRequest)
		return
	}

	body, err := h.rw.PatchInfraBillingNodes(r.Context(), remnawave.UpdateInfraBillingNodeRequest{
		UUIDs:         []uuid.UUID{billingUUID},
		NextBillingAt: t,
	})
	if err != nil {
		slog.Error("admin infra: patch node", "error", err)
		http.Error(w, "failed to update node", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

// DeleteNode removes a billing node.
func (h *AdminInfraHandler) DeleteNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	id := extractUUIDFromPath(r.URL.Path, "/cabinet/api/admin/infra/nodes/")
	if id == uuid.Nil {
		http.Error(w, "invalid uuid in path", http.StatusBadRequest)
		return
	}

	body, err := h.rw.DeleteInfraBillingNode(r.Context(), id)
	if err != nil {
		slog.Error("admin infra: delete node", "error", err)
		http.Error(w, "failed to delete node", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

// Providers returns provider list from Remnawave.
func (h *AdminInfraHandler) Providers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	body, err := h.rw.GetInfraBillingProviders(r.Context())
	if err != nil {
		slog.Error("admin infra: get providers", "error", err)
		http.Error(w, "failed to fetch providers", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

type createProviderReq struct {
	Name        string  `json:"name"`
	FaviconLink *string `json:"favicon_link,omitempty"`
	LoginURL    *string `json:"login_url,omitempty"`
}

// CreateProvider adds a new provider.
func (h *AdminInfraHandler) CreateProvider(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	var req createProviderReq
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 || len(req.Name) > 30 {
		http.Error(w, "name must be 2-30 chars", http.StatusBadRequest)
		return
	}
	if req.FaviconLink != nil {
		n := normalizeInfraURL(*req.FaviconLink)
		req.FaviconLink = &n
	}
	if req.LoginURL != nil {
		n := normalizeInfraURL(*req.LoginURL)
		req.LoginURL = &n
	}

	body, err := h.rw.CreateInfraProvider(r.Context(), remnawave.CreateInfraProviderRequest{
		Name:        req.Name,
		FaviconLink: req.FaviconLink,
		LoginURL:    req.LoginURL,
	})
	if err != nil {
		slog.Error("admin infra: create provider", "error", err)
		http.Error(w, "failed to create provider", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

type patchProviderReq struct {
	UUID        string  `json:"uuid"`
	Name        *string `json:"name,omitempty"`
	FaviconLink *string `json:"favicon_link,omitempty"`
	LoginURL    *string `json:"login_url,omitempty"`
}

// PatchProvider updates a provider.
func (h *AdminInfraHandler) PatchProvider(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	var req patchProviderReq
	if !decodeJSON(w, r, &req) {
		return
	}

	provUUID, err := uuid.Parse(req.UUID)
	if err != nil {
		http.Error(w, "invalid uuid", http.StatusBadRequest)
		return
	}
	if req.FaviconLink != nil {
		n := normalizeInfraURL(*req.FaviconLink)
		req.FaviconLink = &n
	}
	if req.LoginURL != nil {
		n := normalizeInfraURL(*req.LoginURL)
		req.LoginURL = &n
	}

	body, err := h.rw.PatchInfraProvider(r.Context(), remnawave.UpdateInfraProviderRequest{
		UUID:        provUUID,
		Name:        req.Name,
		FaviconLink: req.FaviconLink,
		LoginURL:    req.LoginURL,
	})
	if err != nil {
		slog.Error("admin infra: patch provider", "error", err)
		http.Error(w, "failed to update provider", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

// DeleteProvider removes a provider.
func (h *AdminInfraHandler) DeleteProvider(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	id := extractUUIDFromPath(r.URL.Path, "/cabinet/api/admin/infra/providers/")
	if id == uuid.Nil {
		http.Error(w, "invalid uuid in path", http.StatusBadRequest)
		return
	}

	if err := h.rw.DeleteInfraProvider(r.Context(), id); err != nil {
		slog.Error("admin infra: delete provider", "error", err)
		http.Error(w, "failed to delete provider", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// History returns billing history.
func (h *AdminInfraHandler) History(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	start := 0
	size := 20
	if s := r.URL.Query().Get("start"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v >= 0 {
			start = v
		}
	}
	if s := r.URL.Query().Get("size"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 && v <= 100 {
			size = v
		}
	}

	body, err := h.rw.GetInfraBillingHistory(r.Context(), start, size)
	if err != nil {
		slog.Error("admin infra: get history", "error", err)
		http.Error(w, "failed to fetch history", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

type createHistoryReq struct {
	ProviderUUID string  `json:"provider_uuid"`
	Amount       float64 `json:"amount"`
	BilledAt     string  `json:"billed_at"`
}

// CreateHistory adds a billing history record.
func (h *AdminInfraHandler) CreateHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	var req createHistoryReq
	if !decodeJSON(w, r, &req) {
		return
	}

	provUUID, err := uuid.Parse(req.ProviderUUID)
	if err != nil {
		http.Error(w, "invalid provider_uuid", http.StatusBadRequest)
		return
	}
	billedAt, err := parseFlexDate(req.BilledAt)
	if err != nil {
		http.Error(w, "invalid billed_at", http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 {
		http.Error(w, "amount must be positive", http.StatusBadRequest)
		return
	}

	body, err := h.rw.CreateInfraBillingHistory(r.Context(), remnawave.CreateInfraBillingHistoryRequest{
		ProviderUUID: provUUID,
		Amount:       req.Amount,
		BilledAt:     billedAt,
	})
	if err != nil {
		slog.Error("admin infra: create history", "error", err)
		http.Error(w, "failed to create history record", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

// DeleteHistory removes a billing history record.
func (h *AdminInfraHandler) DeleteHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}

	id := extractUUIDFromPath(r.URL.Path, "/cabinet/api/admin/infra/history/")
	if id == uuid.Nil {
		http.Error(w, "invalid uuid in path", http.StatusBadRequest)
		return
	}

	if err := h.rw.DeleteInfraBillingHistory(r.Context(), id); err != nil {
		slog.Error("admin infra: delete history", "error", err)
		http.Error(w, "failed to delete history record", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// Settings returns notification settings.
func (h *AdminInfraHandler) Settings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s, err := h.billing.GetSettings(r.Context())
	if err != nil {
		slog.Error("admin infra: get settings", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"notify_before_1":  s.NotifyBefore1,
		"notify_before_3":  s.NotifyBefore3,
		"notify_before_7":  s.NotifyBefore7,
		"notify_before_14": s.NotifyBefore14,
	})
}

type updateSettingsReq struct {
	Days    int  `json:"days"`
	Enabled bool `json:"enabled"`
}

// UpdateSettings toggles a notification setting.
func (h *AdminInfraHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req updateSettingsReq
	if !decodeJSON(w, r, &req) {
		return
	}

	if err := h.billing.SetNotifyBefore(r.Context(), req.Days, req.Enabled); err != nil {
		slog.Error("admin infra: update settings", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func extractUUIDFromPath(path, prefix string) uuid.UUID {
	s := strings.TrimPrefix(path, prefix)
	s = strings.TrimRight(s, "/")
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil
	}
	return id
}

func parseFlexDate(s string) (time.Time, error) {
	moscow, _ := time.LoadLocation("Europe/Moscow")
	for _, layout := range []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"02.01.2006 15:04",
		"02.01.2006",
		"02.01.06",
		"2006-01-02",
	} {
		t, err := time.ParseInLocation(layout, s, moscow)
		if err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unparseable date: %s", s)
}

// HandleNodes dispatches GET/POST/PATCH on /cabinet/api/admin/infra/nodes.
func (h *AdminInfraHandler) HandleNodes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.Nodes(w, r)
	case http.MethodPost:
		h.CreateNode(w, r)
	case http.MethodPatch:
		h.PatchNode(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleProviders dispatches GET/POST/PATCH on /cabinet/api/admin/infra/providers.
func (h *AdminInfraHandler) HandleProviders(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.Providers(w, r)
	case http.MethodPost:
		h.CreateProvider(w, r)
	case http.MethodPatch:
		h.PatchProvider(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleHistory dispatches GET/POST on /cabinet/api/admin/infra/history.
func (h *AdminInfraHandler) HandleHistory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.History(w, r)
	case http.MethodPost:
		h.CreateHistory(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleSettings dispatches GET/PATCH on /cabinet/api/admin/infra/settings.
func (h *AdminInfraHandler) HandleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.Settings(w, r)
	case http.MethodPatch:
		h.UpdateSettings(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func normalizeInfraURL(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	lower := strings.ToLower(s)
	if strings.HasPrefix(lower, "http://") {
		return "http://" + s[len("http://"):]
	}
	if strings.HasPrefix(lower, "https://") {
		return "https://" + s[len("https://"):]
	}
	return "https://" + s
}
