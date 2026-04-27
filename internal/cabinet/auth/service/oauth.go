package service

// oauth.go — методы Google OAuth и Telegram Login для *Service.
//
// Расширяет auth.go новыми методами; опциональные зависимости (Google, Telegram)
// подключаются через SetGoogle / SetTelegramToken после New().

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	googleoauth "remnawave-tg-shop-bot/internal/cabinet/auth/oauth"
	tgverify "remnawave-tg-shop-bot/internal/cabinet/auth/telegram"
	"remnawave-tg-shop-bot/internal/cabinet/auth/tokens"
	"remnawave-tg-shop-bot/internal/cabinet/bootstrap"
	"remnawave-tg-shop-bot/internal/cabinet/repository"
)

// oauthGoogleProviderWrapper — тонкая обёртка вокруг *googleoauth.GoogleProvider.
// Объявлена здесь, чтобы auth.go не тянул импорт пакета oauth напрямую.
type oauthGoogleProviderWrapper struct {
	p *googleoauth.GoogleProvider
}

type oauthTelegramOIDCWrapper struct {
	p *googleoauth.TelegramOIDCProvider
}

// ============================================================================
// Sentinel ошибки
// ============================================================================

// ErrGoogleDisabled — Google OAuth не настроен.
var ErrGoogleDisabled = errors.New("auth: google oauth disabled")

// ErrTelegramDisabled — Telegram-токен не прокинут.
var ErrTelegramDisabled = errors.New("auth: telegram login disabled")

// ErrGoogleLinkRequired — Google email совпадает с существующим аккаунтом.
// Требуется подтверждение через email перед привязкой.
var ErrGoogleLinkRequired = errors.New("auth: google link confirmation required")
var ErrTelegramOIDCDisabled = errors.New("auth: telegram oidc disabled")

// ============================================================================
// Pending link store
// ============================================================================

// pendingLink — запись ожидающего подтверждения Google-OAuth логина.
type pendingLink struct {
	accountID   int64
	googleSub   string
	googleEmail string
	rawProfile  []byte
	expiresAt   time.Time
}

const pendingLinkTTL = 15 * time.Minute

type pendingLinkStore struct {
	mu    sync.Mutex
	store map[string]pendingLink
}

func newPendingLinkStore() *pendingLinkStore {
	return &pendingLinkStore{store: make(map[string]pendingLink)}
}

func (s *pendingLinkStore) save(tok string, link pendingLink) {
	link.expiresAt = time.Now().Add(pendingLinkTTL)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.store[tok] = link
}

func (s *pendingLinkStore) pop(tok string) (pendingLink, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	link, ok := s.store[tok]
	if !ok {
		return pendingLink{}, false
	}
	delete(s.store, tok)
	if time.Now().After(link.expiresAt) {
		return pendingLink{}, false
	}
	return link, true
}

func (s *pendingLinkStore) runGC(ctx context.Context) {
	go func() {
		t := time.NewTicker(time.Minute)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				now := time.Now()
				s.mu.Lock()
				for k, v := range s.store {
					if now.After(v.expiresAt) {
						delete(s.store, k)
					}
				}
				s.mu.Unlock()
			}
		}
	}()
}

// ============================================================================
// Setter-методы (вызываются из router.go один раз при инициализации)
// ============================================================================

// SetGoogle подключает Google OAuth provider. ctx нужен для GC горутины.
func (s *Service) SetGoogle(ctx context.Context, p *googleoauth.GoogleProvider) {
	s.googleProvider = &oauthGoogleProviderWrapper{p: p}
	s.linkStore = newPendingLinkStore()
	s.linkStore.runGC(ctx)
}

func (s *Service) SetTelegramOIDC(ctx context.Context, p *googleoauth.TelegramOIDCProvider) {
	if p == nil {
		s.telegramOIDC = nil
		return
	}
	s.telegramOIDC = &oauthTelegramOIDCWrapper{p: p}
	p.RunGC(ctx)
}

// SetTelegramToken задаёт токен бота для Telegram HMAC.
func (s *Service) SetTelegramToken(token string) {
	t := strings.TrimSpace(token)
	s.telegramToken = t
	if t == "" {
		s.telegramTokens = nil
		return
	}
	s.telegramTokens = []string{t}
}

// SetTelegramTokens задаёт несколько токенов ботов для валидации Telegram HMAC.
// Это нужно, когда Mini App открывается из одного бота, а Login Widget настроен на другой.
func (s *Service) SetTelegramTokens(tokens ...string) {
	uniq := make([]string, 0, len(tokens))
	seen := make(map[string]struct{}, len(tokens))
	for _, raw := range tokens {
		t := strings.TrimSpace(raw)
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		uniq = append(uniq, t)
	}
	s.telegramTokens = uniq
	if len(uniq) > 0 {
		s.telegramToken = uniq[0]
	} else {
		s.telegramToken = ""
	}
}

func (s *Service) effectiveTelegramTokens() []string {
	if len(s.telegramTokens) > 0 {
		return s.telegramTokens
	}
	if strings.TrimSpace(s.telegramToken) != "" {
		return []string{strings.TrimSpace(s.telegramToken)}
	}
	return nil
}

// ============================================================================
// Google OAuth
// ============================================================================

// GoogleStart возвращает URL редиректа на Google.
// referralCode — опционально тот же ref, что у /register?ref= (сохраняется в OAuth state).
func (s *Service) GoogleStart(referralCode string) (string, error) {
	if s.googleProvider == nil {
		return "", ErrGoogleDisabled
	}
	res, err := s.googleProvider.p.Start(referralCode)
	if err != nil {
		return "", err
	}
	return res.RedirectURL, nil
}

// GoogleLinkContext — доп. данные при ErrGoogleLinkRequired.
type GoogleLinkContext struct {
	MaskedEmail string // «u***@example.com» — чтобы пользователь понял, куда ждать письмо
}

// GoogleCallbackResult — возвращается из GoogleCallback.
type GoogleCallbackResult struct {
	Pair    *TokenPair         // !=nil при успехе (новый/существующий аккаунт)
	LinkCtx *GoogleLinkContext // !=nil при ErrGoogleLinkRequired
}

// GoogleCallback обрабатывает code + state от Google и выдаёт сессию.
//
// Три ветки:
//  1. Identity(google, sub) найдена → login.
//  2. Email совпадает с существующим аккаунтом → pending link + ErrGoogleLinkRequired.
//  3. Нет совпадений → новый аккаунт + identity → login.
func (s *Service) GoogleCallback(
	ctx context.Context,
	state, code, userAgent, ip string,
) (GoogleCallbackResult, error) {
	var empty GoogleCallbackResult
	if s.googleProvider == nil {
		return empty, ErrGoogleDisabled
	}

	info, referralRaw, err := s.googleProvider.p.Callback(ctx, state, code)
	if err != nil {
		if errors.Is(err, googleoauth.ErrStateInvalid) {
			return empty, ErrInvalidToken
		}
		return empty, fmt.Errorf("google callback: %w", err)
	}

	// 1. Identity уже существует → логиним.
	ident, err := s.ids.FindByProvider(ctx, repository.ProviderGoogle, info.Sub)
	if err == nil {
		acc, err := s.accounts.FindByID(ctx, ident.AccountID)
		if err != nil {
			return empty, fmt.Errorf("google callback: load account: %w", err)
		}
		if acc.Status != repository.AccountStatusActive {
			return empty, ErrInvalidCredentials
		}
		_ = s.accounts.UpdateLastLogin(ctx, acc.ID)
		s.ensureCustomer(ctx, acc.ID, acc.Language)
		pair, err := s.issueSession(ctx, acc, uuid.New(), userAgent, ip)
		if err != nil {
			return empty, err
		}
		return GoogleCallbackResult{Pair: pair}, nil
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return empty, fmt.Errorf("google callback: find identity: %w", err)
	}

	// 2. Identity не найдена. Проверяем email.
	normEmail := normalizeEmail(info.Email)
	if normEmail != "" {
		existingAcc, err := s.accounts.FindByEmail(ctx, normEmail)
		if err == nil {
			// Email занят → pending link.
			linkToken, _, genErr := tokens.Generate(0)
			if genErr != nil {
				return empty, fmt.Errorf("google callback: gen link token: %w", genErr)
			}
			rawProfile, _ := json.Marshal(info)
			s.linkStore.save(linkToken, pendingLink{
				accountID:   existingAcc.ID,
				googleSub:   info.Sub,
				googleEmail: info.Email,
				rawProfile:  rawProfile,
			})
			confirmURL := cabinetAppURL(s.cfg.PublicURL, "/cabinet/api/auth/google/confirm?token="+url.QueryEscape(linkToken))
			if sendErr := s.mailer.SendGoogleLinkConfirm(ctx, normEmail, existingAcc.Language, confirmURL); sendErr != nil {
				slog.Warn("google callback: send link confirm email", "error", sendErr)
			}
			return GoogleCallbackResult{
				LinkCtx: &GoogleLinkContext{MaskedEmail: maskEmail(normEmail)},
			}, ErrGoogleLinkRequired
		}
		if !errors.Is(err, repository.ErrNotFound) {
			return empty, fmt.Errorf("google callback: find by email: %w", err)
		}
	}

	// 3. Новый пользователь → создаём аккаунт.
	acc, err := s.accounts.Create(ctx, normEmail, "", s.cfg.DefaultLanguage)
	if err != nil {
		return empty, fmt.Errorf("google callback: create account: %w", err)
	}
	// Google сам верифицирует email — сразу помечаем.
	if info.EmailVerified && acc.Email != nil {
		if err := s.accounts.MarkEmailVerified(ctx, acc.ID); err != nil {
			slog.Warn("google callback: mark email verified", "error", err)
		}
		if fresh, ferr := s.accounts.FindByID(ctx, acc.ID); ferr == nil {
			acc = fresh
		}
	}
	rawProfile, _ := json.Marshal(info)
	if _, err := s.ids.Create(ctx, acc.ID, repository.ProviderGoogle, info.Sub, info.Email, rawProfile); err != nil {
		return empty, fmt.Errorf("google callback: create identity: %w", err)
	}
	s.ensureCustomer(ctx, acc.ID, acc.Language)
	s.attachReferralBestEffort(ctx, acc.ID, acc.Language, referralRaw)
	pair, err := s.issueSession(ctx, acc, uuid.New(), userAgent, ip)
	if err != nil {
		return empty, err
	}
	return GoogleCallbackResult{Pair: pair}, nil
}

// GoogleLinkConfirm — пользователь кликнул ссылку из письма; привязываем
// Google identity к существующему аккаунту и выдаём сессию.
func (s *Service) GoogleLinkConfirm(ctx context.Context, token, userAgent, ip string) (*TokenPair, error) {
	if s.googleProvider == nil || s.linkStore == nil {
		return nil, ErrGoogleDisabled
	}
	link, ok := s.linkStore.pop(token)
	if !ok {
		return nil, ErrInvalidToken
	}
	acc, err := s.accounts.FindByID(ctx, link.accountID)
	if err != nil {
		return nil, fmt.Errorf("google link confirm: load account: %w", err)
	}
	if acc.Status != repository.AccountStatusActive {
		return nil, ErrInvalidCredentials
	}
	// Создаём identity. Ошибка UNIQUE-нарушения — допустима (повторный confirm).
	if _, err := s.ids.Create(ctx, acc.ID, repository.ProviderGoogle, link.googleSub, link.googleEmail, link.rawProfile); err != nil {
		slog.Debug("google link confirm: create identity (may be duplicate)", "error", err)
	}
	_ = s.accounts.UpdateLastLogin(ctx, acc.ID)
	s.ensureCustomer(ctx, acc.ID, acc.Language)
	return s.issueSession(ctx, acc, uuid.New(), userAgent, ip)
}

// ============================================================================
// Telegram Login
// ============================================================================

// TelegramWidgetInput — данные от Telegram Login Widget.
type TelegramWidgetInput struct {
	ID        int64
	FirstName string
	LastName  string
	Username  string
	PhotoURL  string
	AuthDate  int64
	Hash      string
	// ReferralCode — опционально ref_<tg> реферера (регистрация по ссылке кабинета).
	ReferralCode string
	UserAgent    string
	IP           string
}

// TelegramMiniAppInput — данные от Telegram Mini App.
type TelegramMiniAppInput struct {
	InitData     string
	ReferralCode string // из start_param WebApp или query; опционально
	UserAgent    string
	IP           string
}

// TelegramLoginWidget аутентифицирует через Telegram Login Widget.
func (s *Service) TelegramLoginWidget(ctx context.Context, in TelegramWidgetInput) (*TokenPair, error) {
	tokens := s.effectiveTelegramTokens()
	if len(tokens) == 0 {
		return nil, ErrTelegramDisabled
	}
	wd := tgverify.WidgetData{
		ID:        in.ID,
		FirstName: in.FirstName,
		LastName:  in.LastName,
		Username:  in.Username,
		PhotoURL:  in.PhotoURL,
		AuthDate:  in.AuthDate,
		Hash:      in.Hash,
	}
	var lastErr error
	verified := false
	for _, token := range tokens {
		if err := tgverify.VerifyWidget(wd, token); err == nil {
			verified = true
			break
		} else {
			lastErr = err
		}
	}
	if !verified {
		return nil, mapTgErr(lastErr)
	}
	return s.telegramFindOrCreate(ctx, in.ID, in.Username, in.ReferralCode, in.UserAgent, in.IP)
}

// TelegramLoginMiniApp аутентифицирует через initData из Telegram Mini App.
func (s *Service) TelegramLoginMiniApp(ctx context.Context, in TelegramMiniAppInput) (*TokenPair, error) {
	tokens := s.effectiveTelegramTokens()
	if len(tokens) == 0 {
		return nil, ErrTelegramDisabled
	}
	var (
		data    *tgverify.MiniAppData
		lastErr error
	)
	for _, token := range tokens {
		parsed, err := tgverify.ParseAndVerifyMiniApp(in.InitData, token)
		if err == nil {
			data = parsed
			break
		}
		lastErr = err
	}
	if data == nil {
		return nil, mapTgErr(lastErr)
	}
	return s.telegramFindOrCreate(ctx, data.UserID, data.Username, in.ReferralCode, in.UserAgent, in.IP)
}

type TelegramOIDCStartInput struct {
	Mode        googleoauth.TelegramOIDCMode
	ReferralRaw string
	AccountID   int64
}

type TelegramOIDCCallbackResult struct {
	Mode             googleoauth.TelegramOIDCMode
	Pair             *TokenPair
	HasMergeCandidate bool
}

func (s *Service) TelegramOIDCStart(in TelegramOIDCStartInput) (string, error) {
	if s.telegramOIDC == nil || s.telegramOIDC.p == nil {
		return "", ErrTelegramOIDCDisabled
	}
	res, err := s.telegramOIDC.p.Start(googleoauth.TelegramOIDCStartInput{
		Mode:        in.Mode,
		ReferralRaw: in.ReferralRaw,
		AccountID:   in.AccountID,
	})
	if err != nil {
		return "", err
	}
	return res.RedirectURL, nil
}

func (s *Service) TelegramOIDCCallback(ctx context.Context, state, code, userAgent, ip string) (*TelegramOIDCCallbackResult, error) {
	if s.telegramOIDC == nil || s.telegramOIDC.p == nil {
		return nil, ErrTelegramOIDCDisabled
	}
	cb, err := s.telegramOIDC.p.Callback(ctx, state, code)
	if err != nil {
		return nil, err
	}
	switch cb.Mode {
	case googleoauth.TelegramOIDCModeLink:
		hasMerge, err := s.linkTelegramIdentity(ctx, cb.AccountID, cb.TelegramID, cb.Username)
		if err != nil {
			return nil, err
		}
		return &TelegramOIDCCallbackResult{Mode: cb.Mode, HasMergeCandidate: hasMerge}, nil
	default:
		pair, err := s.telegramFindOrCreate(ctx, cb.TelegramID, cb.Username, cb.ReferralRaw, userAgent, ip)
		if err != nil {
			return nil, err
		}
		return &TelegramOIDCCallbackResult{Mode: googleoauth.TelegramOIDCModeLogin, Pair: pair}, nil
	}
}

func (s *Service) linkTelegramIdentity(ctx context.Context, accountID, tgID int64, username string) (hasMergeCandidate bool, err error) {
	if accountID <= 0 || tgID <= 0 {
		return false, fmt.Errorf("%w: bad telegram link input", ErrInvalidInput)
	}
	linkedAcc := s.findAccountLinkedToTelegramCustomer(ctx, tgID)
	if linkedAcc != nil && linkedAcc.ID != accountID {
		return false, bootstrap.ErrTelegramCustomerLinkedElsewhere
	}

	pid := strconv.FormatInt(tgID, 10)
	ident, err := s.ids.FindByProvider(ctx, repository.ProviderTelegram, pid)
	if err == nil {
		if ident.AccountID != accountID {
			return false, bootstrap.ErrTelegramCustomerLinkedElsewhere
		}
		acc, aerr := s.accounts.FindByID(ctx, accountID)
		if aerr == nil && acc != nil {
			_ = s.ensureCustomerTelegram(ctx, accountID, acc.Language, tgID)
		}
		return linkedAcc != nil, nil
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return false, err
	}
	rawProfile, _ := json.Marshal(map[string]any{"id": tgID, "username": username})
	if _, err := s.ids.Create(ctx, accountID, repository.ProviderTelegram, pid, "", rawProfile); err != nil {
		return false, err
	}
	acc, aerr := s.accounts.FindByID(ctx, accountID)
	if aerr == nil && acc != nil {
		if err := s.ensureCustomerTelegram(ctx, accountID, acc.Language, tgID); err != nil {
			return false, err
		}
	}
	return linkedAcc != nil, nil
}

// findAccountLinkedToTelegramCustomer — аккаунт кабинета, у которого в боте
// уже есть customer с этим telegram_id (после link/merge или promote web).
func (s *Service) findAccountLinkedToTelegramCustomer(ctx context.Context, tgID int64) *repository.Account {
	if s.lookupCustomers == nil || s.lookupLinks == nil {
		return nil
	}
	cust, err := s.lookupCustomers.FindByTelegramId(ctx, tgID)
	if err != nil || cust == nil {
		return nil
	}
	link, err := s.lookupLinks.FindByCustomerID(ctx, cust.ID)
	if err != nil || link == nil {
		return nil
	}
	acc, err := s.accounts.FindByID(ctx, link.AccountID)
	if err != nil || acc == nil || acc.Status != repository.AccountStatusActive {
		return nil
	}
	return acc
}

// preferReassignTelegramIdentity — «осиротевший» tg-only аккаунт (без email)
// уступает аккаунту с почтой/Google, к которому уже привязан этот Telegram в боте.
func preferReassignTelegramIdentity(linked, orphan *repository.Account) bool {
	if linked == nil || orphan == nil || linked.ID == orphan.ID {
		return false
	}
	if linked.Email == nil || strings.TrimSpace(*linked.Email) == "" {
		return false
	}
	return orphan.Email == nil || strings.TrimSpace(*orphan.Email) == ""
}

// telegramFindOrCreate — ищет cabinet_identity(telegram) → login; иначе
// аккаунт по customer.telegram_id + link (после merge); иначе создаёт новый.
func (s *Service) telegramFindOrCreate(ctx context.Context, tgID int64, username, referralCode, userAgent, ip string) (*TokenPair, error) {
	pid := strconv.FormatInt(tgID, 10)
	linkedAcc := s.findAccountLinkedToTelegramCustomer(ctx, tgID)

	ident, err := s.ids.FindByProvider(ctx, repository.ProviderTelegram, pid)
	if err == nil {
		acc, err := s.accounts.FindByID(ctx, ident.AccountID)
		if err != nil {
			return nil, fmt.Errorf("telegram login: load account: %w", err)
		}
		if acc == nil || acc.Status != repository.AccountStatusActive {
			return nil, ErrInvalidCredentials
		}

		if linkedAcc != nil && acc.ID != linkedAcc.ID && preferReassignTelegramIdentity(linkedAcc, acc) {
			if err := s.ids.UpdateTelegramIdentityAccountID(ctx, pid, linkedAcc.ID); err != nil {
				return nil, fmt.Errorf("telegram login: reassign identity: %w", err)
			}
			if _, err := s.sess.RevokeAllForAccount(ctx, acc.ID); err != nil {
				slog.Warn("telegram login: revoke orphan sessions after identity reassign",
					"orphan_account_id", acc.ID, "error", err)
			}
			acc = linkedAcc
		}

		_ = s.accounts.UpdateLastLogin(ctx, acc.ID)
		if err := s.ensureCustomerTelegram(ctx, acc.ID, acc.Language, tgID); err != nil {
			return nil, err
		}
		return s.issueSession(ctx, acc, uuid.New(), userAgent, ip)
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("telegram login: find identity: %w", err)
	}

	if linkedAcc != nil {
		rawProfile, _ := json.Marshal(map[string]any{"id": tgID, "username": username})
		if _, err := s.ids.Create(ctx, linkedAcc.ID, repository.ProviderTelegram, pid, "", rawProfile); err != nil {
			return nil, fmt.Errorf("telegram login: create identity on linked account: %w", err)
		}
		_ = s.accounts.UpdateLastLogin(ctx, linkedAcc.ID)
		if err := s.ensureCustomerTelegram(ctx, linkedAcc.ID, linkedAcc.Language, tgID); err != nil {
			return nil, err
		}
		return s.issueSession(ctx, linkedAcc, uuid.New(), userAgent, ip)
	}

	// Новый аккаунт без email/пароля.
	acc, err := s.accounts.Create(ctx, "", "", s.cfg.DefaultLanguage)
	if err != nil {
		return nil, fmt.Errorf("telegram login: create account: %w", err)
	}
	rawProfile, _ := json.Marshal(map[string]any{"id": tgID, "username": username})
	if _, err := s.ids.Create(ctx, acc.ID, repository.ProviderTelegram, pid, "", rawProfile); err != nil {
		return nil, fmt.Errorf("telegram login: create identity: %w", err)
	}
	if err := s.ensureCustomerTelegram(ctx, acc.ID, acc.Language, tgID); err != nil {
		return nil, err
	}
	s.attachReferralBestEffort(ctx, acc.ID, acc.Language, referralCode)
	return s.issueSession(ctx, acc, uuid.New(), userAgent, ip)
}

// ============================================================================
// Helpers
// ============================================================================

func mapTgErr(err error) error {
	switch {
	case errors.Is(err, tgverify.ErrInvalidHash):
		return ErrInvalidCredentials
	case errors.Is(err, tgverify.ErrAuthDateExpired):
		return fmt.Errorf("%w: auth_date expired", ErrInvalidToken)
	case errors.Is(err, tgverify.ErrMissingFields):
		return fmt.Errorf("%w: missing telegram fields", ErrInvalidInput)
	default:
		return err
	}
}

func maskEmail(email string) string {
	at := strings.IndexByte(email, '@')
	if at < 1 {
		return email
	}
	local := email[:at]
	domain := email[at:]
	if len(local) <= 2 {
		return local[:1] + "***" + domain
	}
	return local[:1] + "***" + local[len(local)-1:] + domain
}
