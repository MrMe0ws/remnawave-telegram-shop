package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/avatartoken"
	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/database"
)

// avatarMaxAge — сколько браузер держит картинку, не переспрашивая. Час:
// смена аватарки в Telegram доезжает до кабинета в пределах часа, а листание
// страниц не порождает ни одного запроса.
const avatarMaxAge = time.Hour

// Avatar — GET /cabinet/api/avatar?t=<token>.
//
// Эндпоинт публичный по маршруту, но не по данным: доступ открывает
// подписанный токен из /me (см. avatartoken). Так <img src> работает без
// Authorization, а картинка кэшируется браузером как обычная статика.
func (h *MeHandler) Avatar(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	telegramID := h.avatarSubject(r.Context(), r.URL.Query().Get("t"))
	if telegramID == nil {
		// Просроченная и поддельная ссылка отвечают одинаково: по разнице
		// ответов не должно быть видно, существует ли аккаунт.
		http.NotFound(w, r)
		return
	}

	avatar, ok, err := h.tgProfiles.Avatar(r.Context(), *telegramID)
	if err != nil {
		slog.Warn("avatar: fetch failed", "error", err.Error())
		http.NotFound(w, r)
		return
	}
	if !ok {
		// Аватарки нет или её закрыли приватностью — это не ошибка, UI
		// нарисует инициалы.
		http.NotFound(w, r)
		return
	}

	h2 := w.Header()
	h2.Set("ETag", avatar.ETag)
	h2.Set("Cache-Control", "private, max-age="+strconv.Itoa(int(avatarMaxAge.Seconds())))
	if matchesETag(r.Header.Get("If-None-Match"), avatar.ETag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	h2.Set("Content-Type", avatar.ContentType)
	h2.Set("Content-Length", strconv.Itoa(len(avatar.Body)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(avatar.Body)
}

// avatarSubject — telegram id, на который выписан токен.
//
// Токенов два вида: ссылка из /me выписана на аккаунт кабинета (её надо ещё
// развернуть в telegram id), ссылка из админской карточки — сразу на telegram
// id, потому что у пользователя бота аккаунта в кабинете может не быть.
func (h *MeHandler) avatarSubject(ctx context.Context, token string) *int64 {
	if accountID, err := avatartoken.Parse(h.avatarSecret, token, time.Now()); err == nil {
		return h.telegramIDForAccount(ctx, accountID)
	}
	telegramID, err := avatartoken.ParseTelegram(h.avatarSecret, token, time.Now())
	if err != nil {
		return nil
	}
	return &telegramID
}

// matchesETag — разбор If-None-Match: список тегов через запятую, возможен «*»
// и слабые теги вида W/"...".
func matchesETag(header, etag string) bool {
	header = strings.TrimSpace(header)
	if header == "" || etag == "" {
		return false
	}
	if header == "*" {
		return true
	}
	for _, part := range strings.Split(header, ",") {
		if strings.TrimPrefix(strings.TrimSpace(part), "W/") == etag {
			return true
		}
	}
	return false
}

// telegramIDForAccount — telegram id владельца аккаунта по тем же правилам,
// что и в /me. Отдельный путь, потому что здесь не нужен ни bootstrap, ни
// остальной ответ /me: только идентичности и связанный customer.
func (h *MeHandler) telegramIDForAccount(ctx context.Context, accountID int64) *int64 {
	if h.ids == nil {
		return nil
	}
	ids, err := h.ids.ListLinkedByAccount(ctx, accountID)
	if err != nil {
		slog.Warn("avatar: list identities failed", "account_id", accountID, "error", err.Error())
		return nil
	}
	var identityIDs []int64
	for _, id := range ids {
		if id.Provider != repository.ProviderTelegram {
			continue
		}
		if v, perr := strconv.ParseInt(strings.TrimSpace(id.ProviderUserID), 10, 64); perr == nil {
			identityIDs = append(identityIDs, v)
		}
	}

	var cust *database.Customer
	if h.links != nil && h.customers != nil {
		if link, lerr := h.links.FindByAccountID(ctx, accountID); lerr == nil {
			if c, cerr := h.customers.FindById(ctx, link.CustomerID); cerr == nil {
				cust = c
			}
		}
	}
	return pickTelegramID(identityIDs, cust)
}
