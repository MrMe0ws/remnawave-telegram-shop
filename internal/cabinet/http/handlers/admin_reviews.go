package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
)

// AdminReviewsHandler — модерация отзывов: список, правка, ответ, удаление,
// отзыв от имени клиента.
type AdminReviewsHandler struct {
	reviews   *repository.ReviewRepo
	links     *repository.AccountCustomerLinkRepo
	customers *database.CustomerRepository
	user      *ReviewsHandler // сборка отзыва тем же кодом, что у клиента
	notifier  *reviewNotifier
}

func NewAdminReviews(
	reviews *repository.ReviewRepo,
	links *repository.AccountCustomerLinkRepo,
	customers *database.CustomerRepository,
	user *ReviewsHandler,
) *AdminReviewsHandler {
	return &AdminReviewsHandler{reviews: reviews, links: links, customers: customers, user: user, notifier: newReviewNotifier()}
}

type adminReviewDTO struct {
	reviewPublicDTO
	Status       string `json:"status"`
	Visibility   string `json:"visibility"`
	DisplayName  string `json:"display_name"`
	OriginalBody string `json:"original_body,omitempty"`
	ByAdmin      bool   `json:"by_admin"`
	CustomerID   *int64 `json:"customer_id"`
	TelegramID   *int64 `json:"telegram_id"`
	UpdatedAt    string `json:"updated_at"`
}

type adminReviewCounts struct {
	All       int64 `json:"all"`
	Pending   int64 `json:"pending"`
	Published int64 `json:"published"`
	Hidden    int64 `json:"hidden"`
}

type adminReviewUpdateReq struct {
	Rating      *int    `json:"rating"`
	Body        *string `json:"body"`
	Visibility  *string `json:"visibility"`
	DisplayName *string `json:"display_name"`
	Status      *string `json:"status"`
	Reply       *string `json:"reply"`
}

type adminReviewCreateReq struct {
	CustomerID  int64  `json:"customer_id"`
	Rating      int    `json:"rating"`
	Body        string `json:"body"`
	Visibility  string `json:"visibility"`
	DisplayName string `json:"display_name"`
	Status      string `json:"status"`
}

func toAdminReview(rev *repository.Review) adminReviewDTO {
	pub := toPublicReview(rev)
	// В админке дата — всегда создания: у «на проверке» нет даты публикации.
	pub.CreatedAt = rev.CreatedAt.UTC().Format(time.RFC3339)
	return adminReviewDTO{
		reviewPublicDTO: pub, Status: rev.Status, Visibility: rev.Visibility, DisplayName: rev.DisplayName,
		OriginalBody: rev.OriginalBody, ByAdmin: rev.ByAdmin, CustomerID: rev.CustomerID, TelegramID: rev.TelegramID,
		UpdatedAt: rev.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

// List — GET /cabinet/api/admin/reviews?status=&q=&limit=&offset=
func (h *AdminReviewsHandler) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	items, total, err := h.reviews.AdminList(r.Context(), repository.ReviewAdminFilter{
		Status: strings.TrimSpace(q.Get("status")), Search: q.Get("q"),
	}, limit, offset)
	if err != nil {
		if errors.Is(err, repository.ErrReviewValidation) {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		slog.Error("admin reviews list", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	counts, err := h.reviews.Counts(r.Context())
	if err != nil {
		slog.Error("admin reviews counts", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]adminReviewDTO, 0, len(items))
	for i := range items {
		out = append(out, toAdminReview(&items[i]))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled": config.ReviewsEnabled(),
		"items":   out,
		"total":   total,
		"counts":  adminReviewCounts{All: counts.All, Pending: counts.Pending, Published: counts.Published, Hidden: counts.Hidden},
	})
}

// Create — POST /cabinet/api/admin/reviews: отзыв от имени клиента.
func (h *AdminReviewsHandler) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	var req adminReviewCreateReq
	if !decodeJSON(w, r, &req) {
		return
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = repository.ReviewStatusPublished
	}
	cust, cerr := h.customers.FindById(r.Context(), req.CustomerID)
	if cerr != nil || cust == nil {
		http.Error(w, "customer not found", http.StatusNotFound)
		return
	}
	// У клиента может не быть аккаунта кабинета (бот-пользователь): тогда отзыв
	// привязывается прямо к клиенту, автор — Telegram-профиль из бота.
	var accountID int64
	if link, lerr := h.links.FindByCustomerID(r.Context(), cust.ID); lerr == nil && link != nil {
		accountID = link.AccountID
	}
	if existing, ferr := h.findExisting(r, cust.ID, accountID); ferr == nil {
		// Отзыв уже есть: правим его через AdminUpdate, чтобы не потерять оригинал текста.
		vis, dn := strings.TrimSpace(req.Visibility), strings.TrimSpace(req.DisplayName)
		rev, _, uerr := h.reviews.AdminUpdate(r.Context(), existing.ID, repository.ReviewAdminUpdate{
			Rating: &req.Rating, Body: &req.Body, Visibility: &vis, DisplayName: &dn, Status: &status,
		})
		if uerr != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusOK, toAdminReview(rev))
		return
	}
	in, ok := h.user.buildInput(r.Context(), accountID, reviewUpsertReq{
		Rating: req.Rating, Body: req.Body, Visibility: req.Visibility, DisplayName: req.DisplayName,
	})
	if !ok {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if accountID == 0 {
		h.user.fillBotAuthor(r.Context(), &in, cust)
	}
	rev, err := h.reviews.UpsertByAdmin(r.Context(), in, status)
	if err != nil {
		if errors.Is(err, repository.ErrReviewValidation) {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		slog.Error("admin review create", "customer_id", req.CustomerID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, toAdminReview(rev))
}

// HandleByID — /cabinet/api/admin/reviews/{id} (PUT, DELETE) и
// /cabinet/api/admin/reviews/customer/{customer_id} (GET).
func (h *AdminReviewsHandler) HandleByID(w http.ResponseWriter, r *http.Request) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/cabinet/api/admin/reviews/"), "/")
	if cid, ok := strings.CutPrefix(rest, "customer/"); ok {
		h.byCustomer(w, r, cid)
		return
	}
	id, err := strconv.ParseInt(rest, 10, 64)
	if err != nil || id <= 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	switch r.Method {
	case http.MethodPut:
		h.update(w, r, id)
	case http.MethodDelete:
		h.delete(w, r, id)
	default:
		w.Header().Set("Allow", http.MethodPut+", "+http.MethodDelete)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// findExisting — отзыв клиента: по аккаунту кабинета, а без него — по самому клиенту.
func (h *AdminReviewsHandler) findExisting(r *http.Request, customerID, accountID int64) (*repository.Review, error) {
	if accountID > 0 {
		return h.reviews.FindByAccountID(r.Context(), accountID)
	}
	return h.reviews.FindByCustomerNoAccount(r.Context(), customerID)
}

// byCustomer — отзыв клиента для окна «от имени клиента» в карточке пользователя.
func (h *AdminReviewsHandler) byCustomer(w http.ResponseWriter, r *http.Request, rawID string) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	cid, err := strconv.ParseInt(rawID, 10, 64)
	if err != nil || cid <= 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	resp := map[string]any{"customer_found": false, "has_account": false, "review": nil}
	if cust, cerr := h.customers.FindById(r.Context(), cid); cerr == nil && cust != nil {
		resp["customer_found"] = true
		var accountID int64
		if link, lerr := h.links.FindByCustomerID(r.Context(), cid); lerr == nil && link != nil {
			accountID = link.AccountID
			resp["has_account"] = true
		}
		if rev, ferr := h.findExisting(r, cid, accountID); ferr == nil {
			resp["review"] = toAdminReview(rev)
		} else if !errors.Is(ferr, repository.ErrNotFound) {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AdminReviewsHandler) update(w http.ResponseWriter, r *http.Request, id int64) {
	var req adminReviewUpdateReq
	if !decodeJSON(w, r, &req) {
		return
	}
	rev, replyChanged, err := h.reviews.AdminUpdate(r.Context(), id, repository.ReviewAdminUpdate{
		Rating: req.Rating, Body: req.Body, Visibility: req.Visibility, DisplayName: req.DisplayName,
		Status: req.Status, ReplyBody: req.Reply,
	})
	switch {
	case errors.Is(err, repository.ErrNotFound):
		http.Error(w, "not found", http.StatusNotFound)
		return
	case errors.Is(err, repository.ErrReviewValidation):
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	case err != nil:
		slog.Error("admin review update", "id", id, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if replyChanged && rev.CustomerID != nil {
		h.notifyReply(r, rev)
	}
	writeJSON(w, http.StatusOK, toAdminReview(rev))
}

func (h *AdminReviewsHandler) notifyReply(r *http.Request, rev *repository.Review) {
	lang := ""
	if cust, err := h.customers.FindById(r.Context(), *rev.CustomerID); err == nil && cust != nil {
		lang = cust.Language
	}
	h.notifier.notifyReply(r.Context(), *rev.CustomerID, lang, rev)
}

func (h *AdminReviewsHandler) delete(w http.ResponseWriter, r *http.Request, id int64) {
	if err := h.reviews.Delete(r.Context(), id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		slog.Error("admin review delete", "id", id, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
