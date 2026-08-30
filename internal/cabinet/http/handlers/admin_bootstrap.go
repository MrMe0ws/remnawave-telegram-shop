package handlers

import (
	"net/http"

	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
	"remnawave-tg-shop-bot/internal/config"
)

// AdminBootstrapHandler — эндпоинт GET /cabinet/api/admin/bootstrap.
// Отдаёт feature-флаги для SPA-админки (sales_mode, loyalty, fortune и т.д.).
type AdminBootstrapHandler struct{}

// NewAdminBootstrap — конструктор.
func NewAdminBootstrap() *AdminBootstrapHandler {
	return &AdminBootstrapHandler{}
}

type adminBootstrapResp struct {
	SalesMode      string `json:"sales_mode"`
	LoyaltyEnabled bool   `json:"loyalty_enabled"`
	FortuneEnabled bool   `json:"fortune_enabled"`
	PartnerEnabled bool   `json:"partner_enabled"`
	// Версия сборки — чтобы админ видел в шапке, что за образ поднят, и не
	// искал это в логах контейнера.
	Version string `json:"version"`
	Commit  string `json:"commit"`
}

// Bootstrap — GET /cabinet/api/admin/bootstrap (RequireAdmin).
func (h *AdminBootstrapHandler) Bootstrap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	fw := cabcfg.GetFortuneWheel()
	resp := adminBootstrapResp{
		SalesMode:      config.SalesMode(),
		LoyaltyEnabled: config.LoyaltyEnabled(),
		FortuneEnabled: fw.Enabled,
		PartnerEnabled: config.PartnerProgramEnabled(),
		Version:        config.BuildVersion(),
		Commit:         config.BuildCommit(),
	}
	writeJSON(w, http.StatusOK, resp)
}
