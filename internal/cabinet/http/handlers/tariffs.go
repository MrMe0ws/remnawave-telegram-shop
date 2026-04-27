package handlers

import (
	"log/slog"
	"net/http"

	cabsvc "remnawave-tg-shop-bot/internal/cabinet/service"
)

// TariffsHandler — GET /cabinet/api/tariffs.
//
// Эндпоинт публичный (без RequireAuth): витрина нужна и на странице
// регистрации, чтобы UI мог сразу показать «что покупаем». Rate-limit на уровне
// кэша на фронте и CDN/nginx; серверный лимит не ставим, чтобы не усложнять.
type TariffsHandler struct {
	catalog *cabsvc.Catalog
}

// NewTariffs — конструктор.
func NewTariffs(catalog *cabsvc.Catalog) *TariffsHandler {
	return &TariffsHandler{catalog: catalog}
}

// List возвращает полный каталог тарифов в формате cabsvc.Response.
func (h *TariffsHandler) List(w http.ResponseWriter, r *http.Request) {
	resp, err := h.catalog.Get(r.Context())
	if err != nil {
		slog.Error("tariffs: get catalog failed", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	// Короткий Cache-Control — витрина обновляется редко, но мы не хотим
	// отдавать пользователю устаревшие цены дольше минуты.
	w.Header().Set("Cache-Control", "public, max-age=60")
	writeJSON(w, http.StatusOK, resp)
}
