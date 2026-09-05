package handlers

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/google/uuid"

	"remnawave-tg-shop-bot/internal/tariffsquads"
)

type tariffSquadsPreviewDTO struct {
	TariffSquads []string          `json:"tariff_squads"`
	ActiveCount  int               `json:"active_count"`
	Run          *tariffsquads.Run `json:"run"`
}

type tariffSquadsApplyReq struct {
	Add    []string `json:"add"`
	Remove []string `json:"remove"`
}

func parseUUIDList(in []string) ([]uuid.UUID, error) {
	out := make([]uuid.UUID, 0, len(in))
	for _, s := range in {
		u, err := uuid.Parse(s)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, nil
}

func uuidStrings(in []uuid.UUID) []string {
	out := make([]string, 0, len(in))
	for _, u := range in {
		out = append(out, u.String())
	}
	return out
}

// SquadsPreview — GET /cabinet/api/admin/tariffs/{id}/squads.
// Отдаёт фактический состав тарифа, число активных подписчиков на нём и
// состояние последнего применения (для прогресса в админке).
func (h *AdminTariffsHandler) SquadsPreview(w http.ResponseWriter, r *http.Request, tariffID int64) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.squads == nil {
		http.Error(w, "panel not configured", http.StatusServiceUnavailable)
		return
	}

	pv, err := h.squads.Preview(r.Context(), tariffID)
	if err != nil {
		slog.Error("admin tariff squads preview", "tariff_id", tariffID, "error", err.Error())
		if errors.Is(err, tariffsquads.ErrPanelUnavailable) {
			http.Error(w, "panel not configured", http.StatusServiceUnavailable)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, tariffSquadsPreviewDTO{
		TariffSquads: uuidStrings(pv.TariffSquads),
		ActiveCount:  pv.ActiveCount,
		Run:          pv.Run,
	})
}

// SquadsApply — POST /cabinet/api/admin/tariffs/{id}/squads/apply.
// Применяет сквады к тем, кто уже на тарифе: каждому клиенту ставится
// (текущие + add) - remove. Возвращает 202 и стартовое состояние прогона,
// дальше админка опрашивает SquadsPreview.
func (h *AdminTariffsHandler) SquadsApply(w http.ResponseWriter, r *http.Request, tariffID int64) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.squads == nil {
		http.Error(w, "panel not configured", http.StatusServiceUnavailable)
		return
	}

	var req tariffSquadsApplyReq
	if !decodeJSON(w, r, &req) {
		return
	}
	add, err := parseUUIDList(req.Add)
	if err != nil {
		http.Error(w, "invalid add uuid", http.StatusBadRequest)
		return
	}
	remove, err := parseUUIDList(req.Remove)
	if err != nil {
		http.Error(w, "invalid remove uuid", http.StatusBadRequest)
		return
	}

	run, err := h.squads.Start(r.Context(), tariffID, add, remove, adminAccountID(r))
	if err != nil {
		switch {
		case errors.Is(err, tariffsquads.ErrAlreadyRunning):
			http.Error(w, "apply already running", http.StatusConflict)
		case errors.Is(err, tariffsquads.ErrNoChanges),
			errors.Is(err, tariffsquads.ErrUnknownSquad),
			errors.Is(err, tariffsquads.ErrAddNotInTariff),
			errors.Is(err, tariffsquads.ErrRemoveInTariff):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, tariffsquads.ErrPanelUnavailable):
			http.Error(w, "panel not configured", http.StatusServiceUnavailable)
		default:
			slog.Error("admin tariff squads apply", "tariff_id", tariffID, "error", err.Error())
			http.Error(w, "internal error", http.StatusInternalServerError)
		}
		return
	}

	slog.Info("admin: tariff squads apply requested",
		"tariff_id", tariffID, "add", req.Add, "remove", req.Remove,
		"active_customers", run.Total, "admin_account_id", adminAccountID(r))
	writeJSON(w, http.StatusAccepted, run)
}
