package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	googleoauth "remnawave-tg-shop-bot/internal/cabinet/auth/oauth"
	"remnawave-tg-shop-bot/internal/cabinet/auth/service"
	"remnawave-tg-shop-bot/internal/cabinet/bootstrap"
	"remnawave-tg-shop-bot/internal/cabinet/http/middleware"
	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/payment"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/utils"
)

// MeHandler — эндпоинты /cabinet/api/me/*.
type MeHandler struct {
	svc                  *service.Service
	accounts             *repository.AccountRepo
	ids                  *repository.IdentityRepo
	links                *repository.AccountCustomerLinkRepo
	customers            *database.CustomerRepository
	bootstrap            *bootstrap.CustomerBootstrap
	payments             *payment.PaymentService
	rw                   *remnawave.Client
	cookieDomain         string
	telegramWidgetBot    string // username без @ для Login Widget; "" — виджет недоступен
	googleOAuthEnabled   bool
	telegramOIDCEnabled  bool
	devTelegramUnlink    bool // CABINET_DEV_TELEGRAM_UNLINK — см. PostTelegramUnlinkDev
}

// NewMe — конструктор. links может быть nil в тестах; тогда /me не отдаст
// customer_id, но работать будет.
func NewMe(
	svc *service.Service,
	accounts *repository.AccountRepo,
	ids *repository.IdentityRepo,
	links *repository.AccountCustomerLinkRepo,
	boot *bootstrap.CustomerBootstrap,
	payments *payment.PaymentService,
	rw *remnawave.Client,
	customers *database.CustomerRepository,
	cookieDomain string,
	telegramWidgetBot string,
	googleOAuthEnabled bool,
	telegramOIDCEnabled bool,
	devTelegramUnlink bool,
) *MeHandler {
	return &MeHandler{
		svc: svc, accounts: accounts, ids: ids, links: links, bootstrap: boot, payments: payments, rw: rw,
		customers: customers, cookieDomain: cookieDomain, telegramWidgetBot: telegramWidgetBot,
		googleOAuthEnabled: googleOAuthEnabled, telegramOIDCEnabled: telegramOIDCEnabled, devTelegramUnlink: devTelegramUnlink,
	}
}

type meDeviceItem struct {
	HWID        string `json:"hwid"`
	Platform    string `json:"platform,omitempty"`
	OSVersion   string `json:"os_version,omitempty"`
	DeviceModel string `json:"device_model,omitempty"`
	UserAgent   string `json:"user_agent,omitempty"`
	CreatedAt   string `json:"created_at,omitempty"`
	UpdatedAt   string `json:"updated_at,omitempty"`
}

type meDevicesResp struct {
	Enabled      bool           `json:"enabled"`
	DeviceLimit  int            `json:"device_limit"`
	Connected    int            `json:"connected"`
	Devices      []meDeviceItem `json:"devices"`
}

type meDeleteDeviceReq struct {
	HWID string `json:"hwid"`
}

type meResp struct {
	ID              int64    `json:"id"`
	Email           *string  `json:"email,omitempty"`
	EmailVerified   bool     `json:"email_verified"`
	Language        string   `json:"language"`
	Providers       []string `json:"providers"`
	HasTelegramLink bool     `json:"has_telegram_link"` // true, если identity провайдера telegram привязана
	HasPassword     bool     `json:"has_password"`      // false — только OAuth/Telegram, смена пароля недоступна
	// CustomerID — id customer'а, привязанного к этому аккаунту. nil в редком
	// случае, если bootstrap ещё не успел отработать (сразу после регистрации,
	// до первого обращения к /me). UI должен перезапросить /me.
	CustomerID *int64 `json:"customer_id,omitempty"`
	// TelegramWidgetBot — username бота (без @) для Telegram Login Widget при привязке.
	TelegramWidgetBot string `json:"telegram_widget_bot,omitempty"`
	GoogleOAuthEnabled bool  `json:"google_oauth_enabled"`
	TelegramOIDCEnabled bool `json:"telegram_oidc_enabled"`
	// DevTelegramUnlink — true, если на сервере включён CABINET_DEV_TELEGRAM_UNLINK (кнопка в SPA).
	DevTelegramUnlink bool `json:"dev_telegram_unlink,omitempty"`
	// RegisteredAt — дата создания аккаунта кабинета (ISO 8601).
	RegisteredAt string `json:"registered_at"`
	// TelegramID — числовой id пользователя Telegram, если известен (identity или customer без synthetic).
	TelegramID *int64 `json:"telegram_id,omitempty"`
}

// Me — GET /cabinet/api/me.
func (h *MeHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	acc, err := h.accounts.FindByID(r.Context(), claims.AccountID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			http.Error(w, "account not found", http.StatusNotFound)
			return
		}
		slog.Error("me: find account failed", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	ids, err := h.ids.ListByAccount(r.Context(), acc.ID)
	if err != nil {
		slog.Error("me: list identities failed", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	providers := make([]string, 0, len(ids))
	hasTelegram := false
	var telegramUserID *int64
	for _, id := range ids {
		providers = append(providers, id.Provider)
		if id.Provider == repository.ProviderTelegram {
			hasTelegram = true
			if telegramUserID == nil {
				s := strings.TrimSpace(id.ProviderUserID)
				if s != "" {
					if v, perr := strconv.ParseInt(s, 10, 64); perr == nil {
						telegramUserID = &v
					}
				}
			}
		}
	}

	// customer_id: читаем из link'а. Если link'а ещё нет — пробуем дошить через
	// bootstrap (idempotent). Ошибки bootstrap не роняют /me — поле просто
	// останется nil, клиент перезапросит.
	var customerID *int64
	if h.links != nil {
		link, err := h.links.FindByAccountID(r.Context(), acc.ID)
		if err == nil {
			id := link.CustomerID
			customerID = &id
		} else if errors.Is(err, repository.ErrNotFound) && h.bootstrap != nil {
			if link2, err2 := h.bootstrap.EnsureForAccount(r.Context(), acc.ID, acc.Language); err2 == nil {
				id := link2.CustomerID
				customerID = &id
			} else {
				slog.Warn("me: bootstrap failed", "account_id", acc.ID, "error", err2)
			}
		} else if err != nil {
			slog.Warn("me: find link failed", "account_id", acc.ID, "error", err)
		}
	}

	var linkedCustomer *database.Customer
	if h.customers != nil && customerID != nil {
		cust, errCust := h.customers.FindById(r.Context(), *customerID)
		if errCust != nil {
			slog.Warn("me: find customer failed", "customer_id", *customerID, "error", errCust.Error())
		} else if cust != nil {
			linkedCustomer = cust
		}
	}

	if telegramUserID == nil && linkedCustomer != nil && !linkedCustomer.IsWebOnly &&
		!utils.IsSyntheticTelegramID(linkedCustomer.TelegramID) {
		v := linkedCustomer.TelegramID
		telegramUserID = &v
	}

	// После link/merge у customer реальный telegram_id, но cabinet_identity(telegram)
	// могла не создаваться — считаем «привязан», если customer не web-only и не synthetic.
	if !hasTelegram && linkedCustomer != nil && !linkedCustomer.IsWebOnly &&
		!utils.IsSyntheticTelegramID(linkedCustomer.TelegramID) {
		hasTelegram = true
	}
	if hasTelegram {
		found := false
		for _, p := range providers {
			if p == repository.ProviderTelegram {
				found = true
				break
			}
		}
		if !found {
			providers = append(providers, repository.ProviderTelegram)
		}
	}

	resp := meResp{
		ID:                 acc.ID,
		Email:              acc.Email,
		EmailVerified:      acc.EmailVerified(),
		Language:           acc.Language,
		Providers:          providers,
		HasTelegramLink:    hasTelegram,
		HasPassword:        acc.PasswordHash != nil,
		CustomerID:         customerID,
		GoogleOAuthEnabled: h.googleOAuthEnabled,
		TelegramOIDCEnabled: h.telegramOIDCEnabled,
		RegisteredAt:       acc.CreatedAt.UTC().Format(time.RFC3339),
		TelegramID:         telegramUserID,
	}
	if h.telegramWidgetBot != "" {
		resp.TelegramWidgetBot = h.telegramWidgetBot
	}
	if h.devTelegramUnlink {
		resp.DevTelegramUnlink = true
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *MeHandler) TelegramLinkOIDCStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	redirectURL, err := h.svc.TelegramOIDCStart(service.TelegramOIDCStartInput{
		Mode:      googleoauth.TelegramOIDCModeLink,
		AccountID: claims.AccountID,
	})
	if err != nil {
		if errors.Is(err, service.ErrTelegramOIDCDisabled) {
			http.Error(w, "telegram oidc disabled", http.StatusNotImplemented)
			return
		}
		slog.Error("telegram link oidc start failed", "account_id", claims.AccountID, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	// fetch() с redirect:manual на внешний oauth.telegram.org даёт opaqueredirect (status 0)
	// без читаемого Location — SPA запрашивает JSON и сама делает assign.
	accept := strings.ToLower(r.Header.Get("Accept"))
	if strings.Contains(accept, "application/json") || r.URL.Query().Get("format") == "json" {
		writeJSON(w, http.StatusOK, map[string]string{"redirect_url": redirectURL})
		return
	}
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

type putLanguageReq struct {
	Language string `json:"language"`
}

// PutLanguage — PUT /cabinet/api/me/language. Принимает "ru" | "en".
// При наличии связки account↔customer обновляет и customer.language (бот, письма).
func (h *MeHandler) PutLanguage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req putLanguageReq
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := h.accounts.UpdateLanguage(r.Context(), claims.AccountID, req.Language); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if h.links != nil && h.customers != nil {
		if link, err := h.links.FindByAccountID(r.Context(), claims.AccountID); err == nil && link != nil {
			if err := h.customers.UpdateFields(r.Context(), link.CustomerID, map[string]interface{}{"language": req.Language}); err != nil {
				slog.Error("me: sync customer language failed", "error", err.Error(), "customer_id", link.CustomerID)
			}
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			slog.Error("me: find link for language sync failed", "error", err.Error())
		}
	}
	writeJSON(w, http.StatusOK, messageResp{Message: "language updated"})
}

type changePasswordReq struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// PutPassword — PUT /cabinet/api/me/password. Меняет пароль и выдаёт новую сессию
// (как login), чтобы SPA не теряла авторизацию.
func (h *MeHandler) PutPassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req changePasswordReq
	if !decodeJSON(w, r, &req) {
		return
	}
	pair, err := h.svc.ChangePassword(r.Context(), claims.AccountID,
		req.CurrentPassword, req.NewPassword, r.UserAgent(), middleware.ClientIP(r))
	if err != nil {
		writeServiceErr(w, err, "change_password")
		return
	}
	setRefreshCookie(w, pair, h.cookieDomain, refreshCookiePath)
	writeJSON(w, http.StatusOK, loginResp{
		AccessToken: pair.AccessToken,
		AccessExp:   pair.AccessExp.Unix(),
		CSRFToken:   pair.CSRFToken,
	})
}

// ResendVerifyEmail — POST /cabinet/api/me/email/verify/resend.
func (h *MeHandler) ResendVerifyEmail(w http.ResponseWriter, r *http.Request) {
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if err := h.svc.ResendVerify(r.Context(), claims.AccountID); err != nil {
		slog.Warn("resend verify failed", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, messageResp{Message: "verification email sent"})
}

// PostTelegramUnlinkDev — POST /cabinet/api/me/telegram/unlink-dev.
// Только при CABINET_DEV_TELEGRAM_UNLINK=true: удаляет cabinet_identity(provider=telegram)
// и при реальном telegram_id у связанного customer сбрасывает его на synthetic(account_id),
// чтобы снова показался виджет привязки и не срабатывала блокировка «уже привязан».
func (h *MeHandler) PostTelegramUnlinkDev(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.devTelegramUnlink {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	n, err := h.ids.DeleteByAccountAndProvider(r.Context(), claims.AccountID, repository.ProviderTelegram)
	if err != nil {
		slog.Error("me: dev unlink telegram identity", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	var customerReset bool
	if h.links != nil && h.customers != nil {
		link, lerr := h.links.FindByAccountID(r.Context(), claims.AccountID)
		if lerr == nil {
			u, rerr := h.customers.DevCabinetResetTelegramToSynthetic(r.Context(), link.CustomerID, claims.AccountID)
			if rerr != nil {
				slog.Error("me: dev unlink reset customer telegram", "error", rerr.Error())
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			customerReset = u
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "deleted": n, "customer_telegram_reset": customerReset,
	})
}

func (h *MeHandler) GetDevices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if h.rw == nil || h.bootstrap == nil || h.customers == nil {
		writeJSON(w, http.StatusOK, meDevicesResp{Enabled: false, Devices: []meDeviceItem{}})
		return
	}
	link, err := h.bootstrap.EnsureForAccount(r.Context(), claims.AccountID, "")
	if err != nil || link == nil {
		writeJSON(w, http.StatusOK, meDevicesResp{Enabled: false, Devices: []meDeviceItem{}})
		return
	}
	c, err := h.customers.FindById(r.Context(), link.CustomerID)
	if err != nil || c == nil {
		writeJSON(w, http.StatusOK, meDevicesResp{Enabled: false, Devices: []meDeviceItem{}})
		return
	}
	if c.IsWebOnly || utils.IsSyntheticTelegramID(c.TelegramID) {
		writeJSON(w, http.StatusOK, meDevicesResp{Enabled: false, Devices: []meDeviceItem{}})
		return
	}
	userUUID, limit, err := h.rw.GetUserInfo(r.Context(), c.TelegramID)
	if err != nil {
		writeJSON(w, http.StatusOK, meDevicesResp{Enabled: true, DeviceLimit: limit, Devices: []meDeviceItem{}})
		return
	}
	devs, err := h.rw.GetUserDevicesByUuid(r.Context(), userUUID)
	if err != nil {
		writeJSON(w, http.StatusOK, meDevicesResp{Enabled: true, DeviceLimit: limit, Devices: []meDeviceItem{}})
		return
	}
	out := make([]meDeviceItem, 0, len(devs))
	for _, d := range devs {
		item := meDeviceItem{
			HWID:      d.Hwid,
			CreatedAt: d.CreatedAt.UTC().Format(time.RFC3339),
			UpdatedAt: d.UpdatedAt.UTC().Format(time.RFC3339),
		}
		if d.Platform != nil {
			item.Platform = *d.Platform
		}
		if d.OsVersion != nil {
			item.OSVersion = *d.OsVersion
		}
		if d.DeviceModel != nil {
			item.DeviceModel = *d.DeviceModel
		}
		if d.UserAgent != nil {
			item.UserAgent = *d.UserAgent
		}
		out = append(out, item)
	}
	writeJSON(w, http.StatusOK, meDevicesResp{
		Enabled:     true,
		DeviceLimit: limit,
		Connected:   len(out),
		Devices:     out,
	})
}

func (h *MeHandler) DeleteDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req meDeleteDeviceReq
	if !decodeJSON(w, r, &req) {
		return
	}
	hwid := strings.TrimSpace(req.HWID)
	if hwid == "" {
		http.Error(w, "missing hwid", http.StatusBadRequest)
		return
	}
	if h.rw == nil || h.bootstrap == nil || h.customers == nil {
		http.Error(w, "devices are unavailable", http.StatusNotImplemented)
		return
	}
	link, err := h.bootstrap.EnsureForAccount(r.Context(), claims.AccountID, "")
	if err != nil || link == nil {
		http.Error(w, "subscription not found", http.StatusNotFound)
		return
	}
	c, err := h.customers.FindById(r.Context(), link.CustomerID)
	if err != nil || c == nil || c.IsWebOnly || utils.IsSyntheticTelegramID(c.TelegramID) {
		http.Error(w, "subscription not found", http.StatusNotFound)
		return
	}
	userUUID, _, err := h.rw.GetUserInfo(r.Context(), c.TelegramID)
	if err != nil {
		http.Error(w, "subscription not found", http.StatusNotFound)
		return
	}
	if err := h.rw.DeleteUserDevice(r.Context(), userUUID, hwid); err != nil {
		slog.Warn("me: delete device failed", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "delete device failed", http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

type deleteAccountReq struct {
	Confirm string `json:"confirm"`
}

type trialResp struct {
	Enabled      bool `json:"enabled"`
	CanActivate  bool `json:"can_activate"`
	Days         int  `json:"days"`
	TrafficGB    int  `json:"traffic_gb"`
	DeviceLimit  int  `json:"device_limit"`
}

// PostAccountDelete — POST /cabinet/api/me/account/delete.
// Тело: {"confirm":"DELETE"}. Необратимо: удаляет аккаунт кабинета; web-only customer
// удаляется вместе с покупками (CASCADE). Сессии и cookies сбрасываются.
func (h *MeHandler) PostAccountDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req deleteAccountReq
	if !decodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Confirm) != "DELETE" {
		http.Error(w, "confirmation required: send {\"confirm\":\"DELETE\"}", http.StatusBadRequest)
		return
	}
	if err := h.accounts.DeleteAccountForUser(r.Context(), claims.AccountID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		slog.Error("me: delete account", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	clearCabinetSessionCookies(w, h.cookieDomain)
	writeJSON(w, http.StatusOK, messageResp{Message: "account deleted"})
}

// GetTrial — GET /cabinet/api/me/trial.
// Возвращает trial-параметры из env и можно ли активировать trial для текущего аккаунта.
func (h *MeHandler) GetTrial(w http.ResponseWriter, r *http.Request) {
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	resp := trialResp{
		Enabled:     config.TrialDays() > 0,
		Days:        config.TrialDays(),
		TrafficGB:   int(config.TrialTrafficLimit() / (1024 * 1024 * 1024)),
		DeviceLimit: config.TrialHwidLimit(),
		CanActivate: false,
	}
	if !resp.Enabled || h.links == nil || h.customers == nil {
		writeJSON(w, http.StatusOK, resp)
		return
	}
	link, err := h.links.FindByAccountID(r.Context(), claims.AccountID)
	if err != nil {
		if !errors.Is(err, repository.ErrNotFound) {
			slog.Warn("me trial: link lookup failed", "account_id", claims.AccountID, "error", err.Error())
		}
		writeJSON(w, http.StatusOK, resp)
		return
	}
	cust, err := h.customers.FindById(r.Context(), link.CustomerID)
	if err != nil {
		slog.Warn("me trial: customer lookup failed", "customer_id", link.CustomerID, "error", err.Error())
		writeJSON(w, http.StatusOK, resp)
		return
	}
	resp.CanActivate = cust != nil && strings.TrimSpace(derefStr(cust.SubscriptionLink)) == ""
	writeJSON(w, http.StatusOK, resp)
}

// PostTrialActivate — POST /cabinet/api/me/trial/activate.
// Активирует trial через ту же логику PaymentService, что и в Telegram-боте.
func (h *MeHandler) PostTrialActivate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if config.TrialDays() <= 0 || h.payments == nil || h.links == nil || h.customers == nil {
		http.Error(w, "trial disabled", http.StatusNotFound)
		return
	}
	link, err := h.links.FindByAccountID(r.Context(), claims.AccountID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			http.Error(w, "customer link not found", http.StatusNotFound)
			return
		}
		slog.Error("me trial: find link", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	cust, err := h.customers.FindById(r.Context(), link.CustomerID)
	if err != nil || cust == nil {
		slog.Error("me trial: find customer", "customer_id", link.CustomerID, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if strings.TrimSpace(derefStr(cust.SubscriptionLink)) != "" {
		http.Error(w, "trial already used", http.StatusConflict)
		return
	}
	linkURL, err := h.payments.ActivateTrial(r.Context(), cust.TelegramID)
	if err != nil {
		slog.Error("me trial: activate failed", "customer_id", cust.ID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"subscription_link": linkURL,
		"message": "trial activated",
	})
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
