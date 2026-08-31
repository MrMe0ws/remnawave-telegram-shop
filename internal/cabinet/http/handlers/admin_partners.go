package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/http/middleware"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/notification"
)

// AdminPartnersHandler — админка партнёрской программы: /cabinet/api/admin/partners*.
//
// Роутинг ручной, а не через отдельные ServeMux-паттерны на каждое действие:
// действий полтора десятка, и пятнадцать регистраций с одинаковой цепочкой
// middleware читались бы хуже, чем один разбор пути.
type AdminPartnersHandler struct {
	partners  *database.PartnerRepository
	customers *database.CustomerRepository
	botURL    string
	// notify может быть nil: без бота уведомлять некому, а хендлер обязан
	// работать и в этом случае — решения админа от Telegram не зависят.
	notify *notification.PartnerNotifier
}

func NewAdminPartners(
	partners *database.PartnerRepository,
	customers *database.CustomerRepository,
	botURL string,
	notify *notification.PartnerNotifier,
) *AdminPartnersHandler {
	return &AdminPartnersHandler{
		partners:  partners,
		customers: customers,
		botURL:    strings.TrimSpace(botURL),
		notify:    notify,
	}
}

// --- DTO ---

type adminPartnerDTO struct {
	ID     int64  `json:"id"`
	Status string `json:"status"`
	Label  string `json:"label"`

	FirstPercent   *float64 `json:"first_percent,omitempty"`
	RenewalPercent *float64 `json:"renewal_percent,omitempty"`
	EffectiveFirst float64  `json:"effective_first_percent"`
	EffectiveRenew float64  `json:"effective_renewal_percent"`
	LinksLimit     *int     `json:"links_limit,omitempty"`
	// Действующее значение с уже подставленным глобальным дефолтом: в карточке
	// «как у всех» без числа не отвечает на вопрос «а сколько это».
	EffectiveLinks  int     `json:"effective_links_limit"`
	Balance         float64 `json:"balance"`
	HoldBalance     float64 `json:"hold_balance"`
	ReservedBalance float64 `json:"reserved_balance"`
	TotalEarned     float64 `json:"total_earned"`
	TotalPaid       float64 `json:"total_paid"`

	Customers       int `json:"customers"`
	PayingCustomers int `json:"paying_customers"`
	OpenPayouts     int `json:"open_payouts"`

	// Кто он как клиент: давно ли с нами и сколько заплатил. По этим двум
	// числам видно, живой это человек или регистрация ради заявки.
	CustomerSince     string  `json:"customer_since"`
	CustomerPaidCount int     `json:"customer_paid_count"`
	CustomerPaidSum   float64 `json:"customer_paid_sum"`

	AppAbout    string `json:"app_about,omitempty"`
	AppChannels string `json:"app_channels,omitempty"`
	AppExpected string `json:"app_expected,omitempty"`
	AppSubmitAt string `json:"app_submitted_at,omitempty"`
	AdminNote   string `json:"admin_note,omitempty"`

	PayoutMethod  string `json:"payout_method,omitempty"`
	PayoutDetails string `json:"payout_details,omitempty"`
	CreatedAt     string `json:"created_at"`
	ApprovedAt    string `json:"approved_at,omitempty"`
}

type adminPartnerPayoutDTO struct {
	ID              int64   `json:"id"`
	PartnerID       int64   `json:"partner_id"`
	PartnerLabel    string  `json:"partner_label"`
	Amount          float64 `json:"amount"`
	Status          string  `json:"status"`
	Method          string  `json:"method,omitempty"`
	DetailsSnapshot string  `json:"details_snapshot,omitempty"`
	AdminComment    string  `json:"admin_comment,omitempty"`
	ExternalRef     string  `json:"external_ref,omitempty"`
	RequestedAt     string  `json:"requested_at"`
	ProcessedAt     string  `json:"processed_at,omitempty"`
	TotalEarned     float64 `json:"partner_total_earned"`
	TotalPaid       float64 `json:"partner_total_paid"`
	PayoutIndex     int     `json:"payout_index"`
}

type adminPartnerOperationDTO struct {
	At     string  `json:"at"`
	Kind   string  `json:"kind"`
	Detail string  `json:"detail,omitempty"`
	Amount float64 `json:"amount"`
	Status string  `json:"status"`
	Ref    string  `json:"ref,omitempty"`
	Note   string  `json:"note,omitempty"`
}

// Карточка отдаёт партнёра, его потоки и размеры трёх журналов. Сами журналы
// приходят постранично из отдельных ручек: у активного партнёра там сотни
// строк, и грузить их все ради счётчика на вкладке незачем.
type adminPartnerDetailResp struct {
	Partner adminPartnerDTO       `json:"partner"`
	Links   []partnerLinkDTO      `json:"links"`
	Counts  adminPartnerCountsDTO `json:"counts"`
}

type adminPartnerCountsDTO struct {
	Customers  int `json:"customers"`
	Operations int `json:"operations"`
	Payouts    int `json:"payouts"`
}

// --- маппинг ---

// effectiveLinksLimit — сколько потоков партнёру доступно на самом деле.
// NULL в базе означает «как у всех», и подставляется общая настройка.
func effectiveLinksLimit(individual *int) int {
	if individual != nil && *individual > 0 {
		return *individual
	}
	return config.PartnerMaxLinks()
}

func adminPartnerToDTO(row database.PartnerAdminRow) adminPartnerDTO {
	return adminPartnerDTO{
		ID:     row.ID,
		Status: row.Status,
		Label: adminCustomerLabel(row.CustomerUsername, row.CustomerEmail,
			row.CustomerTelegramID, row.CustomerIsWebOnly),
		FirstPercent:      row.FirstPercent,
		RenewalPercent:    row.RenewalPercent,
		EffectiveFirst:    effectivePercent(row.FirstPercent, config.PartnerFirstPercent()),
		EffectiveRenew:    effectivePercent(row.RenewalPercent, config.PartnerRenewalPercent()),
		LinksLimit:        row.LinksLimit,
		EffectiveLinks:    effectiveLinksLimit(row.LinksLimit),
		Balance:           row.Balance,
		HoldBalance:       row.HoldBalance,
		ReservedBalance:   row.ReservedBalance,
		TotalEarned:       row.TotalEarned,
		TotalPaid:         row.TotalPaid,
		Customers:         row.Customers,
		PayingCustomers:   row.PayingCustomers,
		OpenPayouts:       row.OpenPayouts,
		CustomerSince:     row.CustomerCreatedAt.UTC().Format(time.RFC3339),
		CustomerPaidCount: row.CustomerPaidCount,
		CustomerPaidSum:   row.CustomerPaidSum,
		AppAbout:          ptrString(row.AppAbout),
		AppChannels:       ptrString(row.AppChannels),
		AppExpected:       ptrString(row.AppExpected),
		AppSubmitAt:       formatTimeRFC3339(row.AppSubmittedAt),
		AdminNote:         ptrString(row.AdminNote),
		PayoutMethod:      ptrString(row.PayoutMethod),
		PayoutDetails:     ptrString(row.PayoutDetails),
		CreatedAt:         row.CreatedAt.UTC().Format(time.RFC3339),
		ApprovedAt:        formatTimeRFC3339(row.ApprovedAt),
	}
}

// --- роутинг ---

// Виды маршрутов админки партнёров.
const (
	adminPartnerRouteList    = "list"
	adminPartnerRoutePending = "pending"
	adminPartnerRouteGrant   = "grant"
	adminPartnerRoutePayouts = "payouts"
	adminPartnerRoutePayout  = "payout"
	adminPartnerRoutePartner = "partner"
)

// adminPartnerRoute — разобранный путь запроса.
type adminPartnerRoute struct {
	Kind   string
	ID     int64
	Action string
}

// parseAdminPartnerPath разбирает путь в маршрут.
//
// Вынесено из обработчика чистой функцией намеренно: разбор путей — то место,
// где опечатка не падает, а тихо уводит запрос не туда, и покрыть её тестом
// дешевле, чем ловить руками.
func parseAdminPartnerPath(path string) (adminPartnerRoute, bool) {
	rest := strings.Trim(strings.TrimPrefix(path, "/cabinet/api/admin/partners"), "/")

	switch rest {
	case "":
		return adminPartnerRoute{Kind: adminPartnerRouteList}, true
	case "pending":
		return adminPartnerRoute{Kind: adminPartnerRoutePending}, true
	case "grant":
		return adminPartnerRoute{Kind: adminPartnerRouteGrant}, true
	case "payouts":
		return adminPartnerRoute{Kind: adminPartnerRoutePayouts}, true
	}

	kind := adminPartnerRoutePartner
	if after, ok := strings.CutPrefix(rest, "payouts/"); ok {
		kind = adminPartnerRoutePayout
		rest = after
	}

	idPart, action, _ := strings.Cut(rest, "/")
	id, err := strconv.ParseInt(idPart, 10, 64)
	if err != nil || id <= 0 {
		return adminPartnerRoute{}, false
	}
	// Вложенности глубже "<id>/<action>" у этого раздела нет: лишний сегмент
	// означает опечатку в клиенте, и молча трактовать его как известное
	// действие нельзя.
	if strings.Contains(action, "/") {
		return adminPartnerRoute{}, false
	}
	return adminPartnerRoute{Kind: kind, ID: id, Action: action}, true
}

// Handle обслуживает /cabinet/api/admin/partners и вложенные пути.
func (h *AdminPartnersHandler) Handle(w http.ResponseWriter, r *http.Request) {
	route, ok := parseAdminPartnerPath(r.URL.Path)
	if !ok {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	switch {
	case route.Kind == adminPartnerRouteList && r.Method == http.MethodGet:
		h.list(w, r)
	case route.Kind == adminPartnerRoutePending && r.Method == http.MethodGet:
		h.pending(w, r)
	case route.Kind == adminPartnerRouteGrant && r.Method == http.MethodPost:
		h.grant(w, r)
	case route.Kind == adminPartnerRoutePayouts && r.Method == http.MethodGet:
		h.listPayouts(w, r)
	case route.Kind == adminPartnerRoutePayout:
		h.payoutAction(w, r, route)
	case route.Kind == adminPartnerRoutePartner:
		h.partnerAction(w, r, route)
	default:
		w.Header().Set("Allow", "GET, POST")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// partnerAction обслуживает "<id>" и "<id>/<action>".
func (h *AdminPartnersHandler) partnerAction(w http.ResponseWriter, r *http.Request, route adminPartnerRoute) {
	partnerID := route.ID

	switch {
	case route.Action == "" && r.Method == http.MethodGet:
		h.detail(w, r, partnerID)
	case route.Action == "" && r.Method == http.MethodPatch:
		h.updateTerms(w, r, partnerID)
	case route.Action == "customers" && r.Method == http.MethodGet:
		h.partnerCustomers(w, r, partnerID)
	case route.Action == "operations" && r.Method == http.MethodGet:
		h.partnerOperations(w, r, partnerID)
	case route.Action == "payouts" && r.Method == http.MethodGet:
		h.partnerPayouts(w, r, partnerID)
	case route.Action == "approve" && r.Method == http.MethodPost:
		h.approve(w, r, partnerID)
	case route.Action == "reject" && r.Method == http.MethodPost:
		h.reject(w, r, partnerID)
	case route.Action == "status" && r.Method == http.MethodPost:
		h.setStatus(w, r, partnerID)
	case route.Action == "adjust" && r.Method == http.MethodPost:
		h.adjust(w, r, partnerID)
	default:
		http.Error(w, "not found", http.StatusNotFound)
	}
}

func (h *AdminPartnersHandler) payoutAction(w http.ResponseWriter, r *http.Request, route adminPartnerRoute) {
	payoutID, action := route.ID, route.Action
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ExternalRef string `json:"external_ref"`
		Comment     string `json:"comment"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	adminID := adminActorID(r)

	var (
		payout *database.PartnerPayout
		err    error
	)
	switch action {
	case "approve":
		payout, err = h.partners.ApprovePayout(r.Context(), payoutID, req.Comment, adminID)
	case "paid":
		payout, err = h.partners.MarkPayoutPaid(r.Context(), payoutID, req.ExternalRef, req.Comment, adminID)
	case "reject":
		payout, err = h.partners.RejectPayout(r.Context(), payoutID, req.Comment, adminID)
	default:
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	switch {
	case errors.Is(err, database.ErrPartnerPayoutNotFound):
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "payout_not_found"})
	case errors.Is(err, database.ErrPartnerPayoutClosed):
		writeJSON(w, http.StatusConflict, map[string]any{"error": "payout_closed"})
	case err != nil:
		slog.Error("admin partners: payout action", "action", action, "payout_id", payoutID, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
	default:
		slog.Info("admin partner payout processed", "action", action, "payout_id", payoutID, "admin_id", adminID)
		h.notifyPayoutProcessed(r, action, payout, req.ExternalRef, req.Comment)
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}

// notifyPayoutProcessed сообщает партнёру решение по его заявке на вывод.
//
// Партнёра ищем по заявке, а не по пути запроса: в URL лежит id выплаты, а
// адресат уведомления — владелец этой выплаты, и связь между ними знает только
// база.
func (h *AdminPartnersHandler) notifyPayoutProcessed(r *http.Request, action string, payout *database.PartnerPayout, externalRef, comment string) {
	if h.notify == nil || payout == nil {
		return
	}
	partner, err := h.partners.FindByID(r.Context(), payout.PartnerID)
	if err != nil || partner == nil {
		slog.Error("admin partners: notify payout, load partner", "error", err, "partner_id", payout.PartnerID)
		return
	}
	switch action {
	case "approve":
		h.notify.PayoutApproved(r.Context(), partner.CustomerID, payout.Amount)
	case "paid":
		h.notify.PayoutPaid(r.Context(), partner.CustomerID, payout.Amount, externalRef)
	case "reject":
		h.notify.PayoutRejected(r.Context(), partner.CustomerID, payout.Amount, comment)
	}
}

// adminActorID — кто выполняет действие. Аккаунт кабинета: другой личности у
// админа здесь нет, а колонка хранит идентификатор без внешнего ключа.
func adminActorID(r *http.Request) int64 {
	if claims := middleware.AuthClaims(r); claims != nil {
		return claims.AccountID
	}
	return 0
}

// --- чтение ---

func (h *AdminPartnersHandler) list(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	limit, offset := paginationParams(r, 50, 200)

	rows, total, err := h.partners.ListPartnersByStatus(r.Context(), status, limit, offset)
	if err != nil {
		slog.Error("admin partners: list", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	items := make([]adminPartnerDTO, 0, len(rows))
	for _, row := range rows {
		items = append(items, adminPartnerToDTO(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

func (h *AdminPartnersHandler) pending(w http.ResponseWriter, r *http.Request) {
	work, err := h.partners.PendingWork(r.Context())
	if err != nil {
		slog.Error("admin partners: pending work", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	skipped, err := h.partners.SkippedStarsEarnings(r.Context())
	if err != nil {
		slog.Error("admin partners: skipped stars", "error", err)
		skipped = 0 // не повод ронять экран
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"applications": work.Applications,
		"payouts":      work.Payouts,
		"total":        work.Applications + work.Payouts,
		// Пропущенные из-за незаданного RUB_PER_STAR начисления: молча терять
		// деньги партнёров нельзя, поэтому цифра едет в админку.
		"skipped_stars_earnings": skipped,
	})
}

func (h *AdminPartnersHandler) detail(w http.ResponseWriter, r *http.Request, partnerID int64) {
	row, err := h.partners.GetPartnerAdminRow(r.Context(), partnerID)
	if err != nil {
		slog.Error("admin partners: detail", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if row == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "partner_not_found"})
		return
	}

	links, err := h.partners.ListLinksWithStats(r.Context(), partnerID)
	if err != nil {
		slog.Error("admin partners: links", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	// Только размеры журналов: содержимое каждой вкладки грузится своей ручкой.
	_, customersTotal, err := h.partners.ListCustomers(r.Context(), partnerID, 1, 0)
	if err != nil {
		slog.Error("admin partners: customers count", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	_, opsTotal, err := h.partners.ListOperations(r.Context(), partnerID, 1, 0)
	if err != nil {
		slog.Error("admin partners: operations count", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	_, payoutsTotal, err := h.partners.ListPayouts(r.Context(), partnerID, 1, 0)
	if err != nil {
		slog.Error("admin partners: payouts count", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	resp := adminPartnerDetailResp{
		Partner: adminPartnerToDTO(*row),
		Links:   make([]partnerLinkDTO, 0, len(links)),
		Counts: adminPartnerCountsDTO{
			Customers:  customersTotal,
			Operations: opsTotal,
			Payouts:    payoutsTotal,
		},
	}
	for _, l := range links {
		resp.Links = append(resp.Links, partnerLinkDTO{
			ID:        l.Link.ID,
			Code:      l.Link.Code,
			Name:      l.Link.Name,
			IsDefault: l.Link.IsDefault,
			Archived:  l.Link.ArchivedAt != nil,
			BotLink:   partnerBotLink(h.botURL, l.Link.Code),
			Customers: l.Customers,
			Paying:    l.Paying,
			Earned:    l.Earned,
		})
	}

	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, resp)
}

// --- постраничные вкладки карточки ---

func (h *AdminPartnersHandler) partnerCustomers(w http.ResponseWriter, r *http.Request, partnerID int64) {
	limit, offset := paginationParams(r, 25, 100)
	rows, total, err := h.partners.ListCustomers(r.Context(), partnerID, limit, offset)
	if err != nil {
		slog.Error("admin partners: customers", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	items := make([]partnerCustomerDTO, 0, len(rows))
	for _, c := range rows {
		// Ярлык админский, без маскирования: партнёрская маска здесь помешала
		// бы разбирать спор — см. adminCustomerLabel.
		items = append(items, partnerCustomerDTO{
			Label:      adminCustomerLabel(c.TelegramUsername, c.Email, c.TelegramID, c.IsWebOnly),
			Active:     c.Active,
			HasPaid:    c.HasPaid,
			Earned:     c.Earned,
			LinkName:   ptrString(c.LinkName),
			AttachedAt: c.AttachedAt.UTC().Format(time.RFC3339),
		})
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

func (h *AdminPartnersHandler) partnerOperations(w http.ResponseWriter, r *http.Request, partnerID int64) {
	limit, offset := paginationParams(r, 25, 100)
	rows, total, err := h.partners.ListOperations(r.Context(), partnerID, limit, offset)
	if err != nil {
		slog.Error("admin partners: operations", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	items := make([]adminPartnerOperationDTO, 0, len(rows))
	for _, op := range rows {
		items = append(items, adminPartnerOperationDTO{
			At:     op.At.UTC().Format(time.RFC3339),
			Kind:   op.Kind,
			Detail: op.Detail,
			Amount: op.Amount,
			Status: op.Status,
			Ref:    ptrString(op.Ref),
			Note:   ptrString(op.Note),
		})
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

func (h *AdminPartnersHandler) partnerPayouts(w http.ResponseWriter, r *http.Request, partnerID int64) {
	limit, offset := paginationParams(r, 25, 100)
	rows, total, err := h.partners.ListPayouts(r.Context(), partnerID, limit, offset)
	if err != nil {
		slog.Error("admin partners: partner payouts", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	items := make([]adminPartnerPayoutDTO, 0, len(rows))
	for _, p := range rows {
		items = append(items, adminPartnerPayoutDTO{
			ID:              p.ID,
			PartnerID:       p.PartnerID,
			Amount:          p.Amount,
			Status:          p.Status,
			Method:          ptrString(p.Method),
			DetailsSnapshot: ptrString(p.DetailsSnapshot),
			AdminComment:    ptrString(p.AdminComment),
			ExternalRef:     ptrString(p.ExternalRef),
			RequestedAt:     p.RequestedAt.UTC().Format(time.RFC3339),
			ProcessedAt:     formatTimeRFC3339(p.ProcessedAt),
		})
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

func (h *AdminPartnersHandler) listPayouts(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	limit, offset := paginationParams(r, 50, 200)

	rows, total, err := h.partners.ListPayoutsAdmin(r.Context(), status, limit, offset)
	if err != nil {
		slog.Error("admin partners: list payouts", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	items := make([]adminPartnerPayoutDTO, 0, len(rows))
	for _, row := range rows {
		items = append(items, adminPartnerPayoutDTO{
			ID:        row.ID,
			PartnerID: row.PartnerID,
			PartnerLabel: adminCustomerLabel(row.CustomerUsername, row.CustomerEmail,
				row.CustomerTelegramID, row.CustomerIsWebOnly),
			Amount:          row.Amount,
			Status:          row.Status,
			Method:          ptrString(row.Method),
			DetailsSnapshot: ptrString(row.DetailsSnapshot),
			AdminComment:    ptrString(row.AdminComment),
			ExternalRef:     ptrString(row.ExternalRef),
			RequestedAt:     row.RequestedAt.UTC().Format(time.RFC3339),
			ProcessedAt:     formatTimeRFC3339(row.ProcessedAt),
			TotalEarned:     row.PartnerTotalEarned,
			TotalPaid:       row.PartnerTotalPaid,
			PayoutIndex:     row.PayoutIndex,
		})
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

// --- изменения ---

type adminPartnerTermsReq struct {
	// Указатели: null означает «вернуть к глобальному значению», и отличать
	// его от нуля обязательно — ноль это осмысленное «не платим».
	FirstPercent   *float64 `json:"first_percent"`
	RenewalPercent *float64 `json:"renewal_percent"`
	LinksLimit     *int     `json:"links_limit"`
	Comment        string   `json:"comment"`
}

// validatePartnerPercents отбивает значения вне 0..100 до похода в базу, чтобы
// админ увидел объяснение, а не отказ CHECK-ограничения.
func validatePartnerPercents(first, renewal *float64) error {
	for _, v := range []*float64{first, renewal} {
		if v == nil {
			continue
		}
		if *v < 0 || *v > 100 {
			return errors.New("percent must be between 0 and 100")
		}
	}
	return nil
}

func (h *AdminPartnersHandler) approve(w http.ResponseWriter, r *http.Request, partnerID int64) {
	var req adminPartnerTermsReq
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := validatePartnerPercents(req.FirstPercent, req.RenewalPercent); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_percent"})
		return
	}

	partner, err := h.partners.ApproveApplication(r.Context(), partnerID,
		req.FirstPercent, req.RenewalPercent, req.Comment, adminActorID(r))
	if errors.Is(err, database.ErrPartnerWrongStatus) {
		writeJSON(w, http.StatusConflict, map[string]any{"error": "wrong_status"})
		return
	}
	if err != nil {
		slog.Error("admin partners: approve", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	slog.Info("partner application approved", "partner_id", partner.ID, "admin_id", adminActorID(r))
	if h.notify != nil {
		h.notify.ApplicationApproved(r.Context(), partner.CustomerID,
			effectivePercent(partner.FirstPercent, config.PartnerFirstPercent()),
			effectivePercent(partner.RenewalPercent, config.PartnerRenewalPercent()))
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": partner.Status})
}

func (h *AdminPartnersHandler) reject(w http.ResponseWriter, r *http.Request, partnerID int64) {
	var req struct {
		Comment string `json:"comment"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}

	partner, err := h.partners.RejectApplication(r.Context(), partnerID, req.Comment, adminActorID(r))
	if errors.Is(err, database.ErrPartnerWrongStatus) {
		writeJSON(w, http.StatusConflict, map[string]any{"error": "wrong_status"})
		return
	}
	if err != nil {
		slog.Error("admin partners: reject", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	slog.Info("partner application rejected", "partner_id", partner.ID, "admin_id", adminActorID(r))
	if h.notify != nil {
		h.notify.ApplicationRejected(r.Context(), partner.CustomerID, req.Comment)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": partner.Status})
}

func (h *AdminPartnersHandler) setStatus(w http.ResponseWriter, r *http.Request, partnerID int64) {
	var req struct {
		Status  string `json:"status"`
		Comment string `json:"comment"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}

	partner, err := h.partners.SetPartnerStatus(r.Context(), partnerID, req.Status, req.Comment, adminActorID(r))
	switch {
	case errors.Is(err, database.ErrPartnerNotFound):
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "partner_not_found"})
	case err != nil && strings.Contains(err.Error(), "not settable"):
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_status"})
	case err != nil:
		slog.Error("admin partners: set status", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
	default:
		slog.Info("partner status changed", "partner_id", partner.ID, "status", partner.Status, "admin_id", adminActorID(r))
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": partner.Status})
	}
}

func (h *AdminPartnersHandler) updateTerms(w http.ResponseWriter, r *http.Request, partnerID int64) {
	var req adminPartnerTermsReq
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := validatePartnerPercents(req.FirstPercent, req.RenewalPercent); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_percent"})
		return
	}
	if req.LinksLimit != nil && (*req.LinksLimit < 1 || *req.LinksLimit > 100) {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_links_limit"})
		return
	}

	partner, err := h.partners.UpdatePartnerTerms(r.Context(), partnerID,
		req.FirstPercent, req.RenewalPercent, req.LinksLimit, req.Comment)
	if errors.Is(err, database.ErrPartnerNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "partner_not_found"})
		return
	}
	if err != nil {
		slog.Error("admin partners: update terms", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": partner.ID})
}

func (h *AdminPartnersHandler) grant(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CustomerID     int64    `json:"customer_id"`
		TelegramID     int64    `json:"telegram_id"`
		FirstPercent   *float64 `json:"first_percent"`
		RenewalPercent *float64 `json:"renewal_percent"`
		Comment        string   `json:"comment"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := validatePartnerPercents(req.FirstPercent, req.RenewalPercent); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_percent"})
		return
	}

	// Админ приходит из двух мест: из карточки пользователя (там известен
	// customer_id) и из списка партнёров, где под рукой telegram id.
	customerID := req.CustomerID
	if customerID == 0 && req.TelegramID != 0 {
		customer, err := h.customers.FindByTelegramId(r.Context(), req.TelegramID)
		if err != nil {
			slog.Error("admin partners: find customer", "error", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if customer == nil {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "customer_not_found"})
			return
		}
		customerID = customer.ID
	}
	if customerID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "customer_required"})
		return
	}

	partner, err := h.partners.GrantPartner(r.Context(), customerID,
		req.FirstPercent, req.RenewalPercent, req.Comment, adminActorID(r))
	if err != nil {
		slog.Error("admin partners: grant", "error", err, "customer_id", customerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	slog.Info("partner granted by admin", "partner_id", partner.ID, "admin_id", adminActorID(r))
	if h.notify != nil {
		h.notify.Granted(r.Context(), partner.CustomerID,
			effectivePercent(partner.FirstPercent, config.PartnerFirstPercent()),
			effectivePercent(partner.RenewalPercent, config.PartnerRenewalPercent()))
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": partner.ID, "status": partner.Status})
}

func (h *AdminPartnersHandler) adjust(w http.ResponseWriter, r *http.Request, partnerID int64) {
	var req struct {
		Amount  float64 `json:"amount"`
		Comment string  `json:"comment"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	amount := roundMoney(req.Amount)
	if amount == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_amount"})
		return
	}
	// Причина обязательна: без неё строка в ленте операций необъяснима, а
	// именно по ней потом разбирают расхождения.
	if strings.TrimSpace(req.Comment) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "comment_required"})
		return
	}

	err := h.partners.AdjustBalance(r.Context(), partnerID, amount, req.Comment, adminActorID(r))
	switch {
	case errors.Is(err, database.ErrPartnerNotFound):
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "partner_not_found"})
	case errors.Is(err, database.ErrPartnerBalanceTooLow):
		writeJSON(w, http.StatusConflict, map[string]any{"error": "balance_too_low"})
	case err != nil:
		slog.Error("admin partners: adjust", "error", err, "partner_id", partnerID)
		http.Error(w, "internal error", http.StatusInternalServerError)
	default:
		slog.Info("partner balance adjusted",
			"partner_id", partnerID, "amount", amount, "admin_id", adminActorID(r))
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}
