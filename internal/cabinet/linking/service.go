package linking

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"

	tgverify "remnawave-tg-shop-bot/internal/cabinet/auth/telegram"
	"remnawave-tg-shop-bot/internal/cabinet/mail"
	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/utils"
)

// ============================================================================
// Sentinel errors
// ============================================================================

var (
	// ErrNoClaimFound — /merge/preview|confirm без claim: нужен /link/telegram/confirm или привязка email с merge (пароль «чужого» аккаунта).
	ErrNoClaimFound = errors.New("linking: no merge claim; confirm Telegram or complete email link with merge")

	// ErrDangerousConflict — merge опасен (две активные подписки с разными ссылками).
	// Требует force=true.
	ErrDangerousConflict = errors.New("linking: dangerous merge conflict; pass force=true to proceed")

	// ErrMergeAlreadyDone — Idempotency-Key уже был использован, merge выполнен ранее.
	ErrMergeAlreadyDone = errors.New("linking: merge already completed (idempotency key reuse)")

	// ErrTelegramDisabled — токен бота не прокинут в сервис.
	ErrTelegramDisabled = errors.New("linking: telegram token not configured")

	// ErrNonceInvalid — nonce не найден или просрочен.
	ErrNonceInvalid = errors.New("linking: nonce invalid or expired")

	// ErrTelegramAlreadyLinked — этот Telegram уже привязан к другому аккаунту кабинета
	// (cabinet_identity или customer↔link), повторная привязка запрещена.
	ErrTelegramAlreadyLinked = errors.New("linking: telegram already linked to another cabinet account")

	// ErrSubscriptionChoiceRequired — у обоих customer есть подписка (expire_at);
	// клиент должен передать keep_subscription web|tg в /link/merge/confirm.
	ErrSubscriptionChoiceRequired = errors.New("linking: subscription keep side required (web or tg)")
)

// ============================================================================
// DTOs
// ============================================================================

// CustomerSnapshot — короткое описание customer для preview.
type CustomerSnapshot struct {
	ID               int64
	ExpireAt         *time.Time
	LoyaltyXP        int64
	ExtraHwid        int
	IsWebOnly        bool
	TelegramID       int64
	SubscriptionLink *string
	CurrentTariffID  *int64
}

// MergePreview — результат dry-run, возвращается из Preview.
type MergePreview struct {
	CustomerWeb     *CustomerSnapshot // nil если нет web-customer
	CustomerTg      *CustomerSnapshot // Telegram customer
	MergedExpireAt  *time.Time        // результирующий expire_at
	MergedLoyaltyXP int64             // суммарный XP
	MergedExtraHwid int               // max(extra_hwid)
	PurchasesMoved  int               // кол-во переносимых purchase
	ReferralsMoved  int               // кол-во переnosимых referral
	IsNoop          bool              // customer_web == customer_tg
	IsDangerous     bool              // устарело: для UI слияния используйте RequiresSubscriptionChoice
	DangerReason    string
	// RequiresSubscriptionChoice — оба профиля имеют expire_at; нужен явный выбор подписки (web|tg).
	RequiresSubscriptionChoice bool
	// UISwapSides — подсказка UI: при merge с peer по email при привязанном Telegram
	// у текущего аккаунта в JSON customer_web — peer (email), customer_tg — текущий
	// кабинет; карточки «текущий / найденный» должны брать снимки наоборот от имён полей.
	UISwapSides bool
	// ClaimExpiresAt — срок действия подтверждённого Telegram claim (для таймера в UI).
	ClaimExpiresAt *time.Time
}

// MergeResult — итог реального merge.
type MergeResult struct {
	Result         string // "linked" | "merged" | "noop"
	CustomerID     int64  // итоговый customer_id
	PurchasesMoved int
	ReferralsMoved int
}

// ============================================================================
// MergeService
// ============================================================================

// MergeService реализует поток link/merge.
type MergeService struct {
	pool          *pgxpool.Pool
	nonces        *NonceStore
	claims        *ClaimStore
	customers     *database.CustomerRepository
	links         *repository.AccountCustomerLinkRepo
	auditRepo     *repository.MergeAuditRepo
	mailer        *mail.Mailer
	accounts      *repository.AccountRepo
	identities    *repository.IdentityRepo
	telegramToken string
	remnawave     *remnawave.Client // опционально; если nil — шаг RW пропускается
}

// Config — параметры конструктора.
type Config struct {
	TelegramToken string
}

// New — конструктор.
func New(
	pool *pgxpool.Pool,
	nonces *NonceStore,
	claims *ClaimStore,
	customers *database.CustomerRepository,
	links *repository.AccountCustomerLinkRepo,
	auditRepo *repository.MergeAuditRepo,
	accounts *repository.AccountRepo,
	identities *repository.IdentityRepo,
	mailer *mail.Mailer,
	telegramToken string,
	rw *remnawave.Client,
) *MergeService {
	return &MergeService{
		pool:          pool,
		nonces:        nonces,
		claims:        claims,
		customers:     customers,
		links:         links,
		auditRepo:     auditRepo,
		accounts:      accounts,
		identities:    identities,
		mailer:        mailer,
		telegramToken: telegramToken,
		remnawave:     rw,
	}
}

// ============================================================================
// POST /link/telegram/start
// ============================================================================

// Start генерирует nonce (TTL 10 мин) для использования в Telegram Login Widget.
func (s *MergeService) Start(ctx context.Context, accountID int64) (nonce string, err error) {
	nonce, genErr := generateRandHex(16)
	if genErr != nil {
		return "", fmt.Errorf("linking start: %w", genErr)
	}
	s.nonces.Save(accountID, nonce)
	return nonce, nil
}

// ============================================================================
// POST /link/telegram/confirm
// ============================================================================

// ConfirmInput — тело /link/telegram/confirm.
type ConfirmInput struct {
	Source    string // "widget" | "miniapp"
	Nonce     string // из /start
	UserAgent string
	IP        string

	// Widget-поля
	ID        int64
	FirstName string
	LastName  string
	Username  string
	PhotoURL  string
	AuthDate  int64
	Hash      string

	// MiniApp-поля
	InitData string
}

// Confirm проверяет Telegram payload + nonce, ищет/сохраняет claim.
// После успешного Confirm можно вызывать Preview и Merge.
func (s *MergeService) Confirm(ctx context.Context, accountID int64, in ConfirmInput) (*TelegramClaim, error) {
	if s.telegramToken == "" {
		return nil, ErrTelegramDisabled
	}

	// Проверяем nonce.
	savedNonce, ok := s.nonces.Peek(accountID)
	if !ok {
		return nil, ErrNonceInvalid
	}
	if savedNonce != in.Nonce {
		return nil, ErrNonceInvalid
	}

	// Проверяем Telegram HMAC.
	var tgID int64
	var username string

	switch in.Source {
	case "widget":
		wd := tgverify.WidgetData{
			ID: in.ID, FirstName: in.FirstName, LastName: in.LastName,
			Username: in.Username, PhotoURL: in.PhotoURL,
			AuthDate: in.AuthDate, Hash: in.Hash,
		}
		if err := tgverify.VerifyWidget(wd, s.telegramToken); err != nil {
			return nil, mapTgErr(err)
		}
		tgID, username = in.ID, in.Username

	case "miniapp":
		data, err := tgverify.ParseAndVerifyMiniApp(in.InitData, s.telegramToken)
		if err != nil {
			return nil, mapTgErr(err)
		}
		tgID, username = data.UserID, data.Username

	default:
		return nil, fmt.Errorf("linking confirm: unknown source %q", in.Source)
	}

	if err := s.assertTelegramFreeForAccount(ctx, accountID, tgID); err != nil {
		return nil, err
	}

	// Ищем customer по telegram_id в БД бота.
	var customerTgID *int64
	cust, err := s.customers.FindByTelegramId(ctx, tgID)
	if err == nil && cust != nil {
		id := cust.ID
		customerTgID = &id
	}

	// Потребляем nonce — одноразовый.
	s.nonces.Consume(accountID)

	claim := TelegramClaim{
		TelegramID:       tgID,
		TelegramUsername: username,
		CustomerTgID:     customerTgID,
	}
	s.claims.Save(accountID, claim)
	slog.Info("claim_saved",
		"source", in.Source,
		"kind", "telegram",
		"account_id", accountID,
		"telegram_id", tgID,
		"has_customer_tg_id", customerTgID != nil,
	)
	return &claim, nil
}

// SaveEmailPeerClaim сохраняет merge-claim для текущей сессии после проверки пароля
// аккаунта peer (email уже занят у peer). Дальше клиент идёт на /link/merge как после Telegram.
func (s *MergeService) SaveEmailPeerClaim(ctx context.Context, currentAccountID, peerAccountID int64) error {
	if currentAccountID <= 0 || peerAccountID <= 0 || currentAccountID == peerAccountID {
		return fmt.Errorf("linking: invalid account ids for email peer claim")
	}
	linkPeer, err := s.links.FindByAccountID(ctx, peerAccountID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("linking: peer account has no customer link")
		}
		return fmt.Errorf("linking: peer link: %w", err)
	}
	cust, err := s.customers.FindById(ctx, linkPeer.CustomerID)
	if err != nil {
		return fmt.Errorf("linking: peer customer: %w", err)
	}
	if cust == nil {
		return fmt.Errorf("linking: peer customer not found")
	}
	linkCur, errCur := s.links.FindByAccountID(ctx, currentAccountID)
	if errCur == nil && linkCur != nil && linkCur.CustomerID == linkPeer.CustomerID {
		return fmt.Errorf("linking: peer customer same as current")
	}

	tgUser := ""
	if cust.TelegramUsername != nil {
		tgUser = strings.TrimSpace(*cust.TelegramUsername)
	}
	peerTelegramID, peerHasRealTelegram := s.telegramIDFromIdentity(ctx, peerAccountID)
	if !peerHasRealTelegram && !utils.IsSyntheticTelegramID(cust.TelegramID) && cust.TelegramID > 0 {
		peerTelegramID = cust.TelegramID
		peerHasRealTelegram = true
	}

	claimTelegramID := cust.TelegramID
	cid := cust.ID
	// Если peer-email аккаунт не содержит реального Telegram, пробуем взять его
	// у текущего аккаунта, чтобы merge не «потерял» bot-facing привязку.
	if !peerHasRealTelegram {
		if linkCur, err := s.links.FindByAccountID(ctx, currentAccountID); err == nil && linkCur != nil {
			if curCust, cerr := s.customers.FindById(ctx, linkCur.CustomerID); cerr == nil && curCust != nil {
				if curTelegramID, curHasRealTelegram := s.telegramIDFromIdentity(ctx, currentAccountID); curHasRealTelegram {
					claimTelegramID = curTelegramID
					cid = curCust.ID
					if curCust.TelegramUsername != nil && strings.TrimSpace(*curCust.TelegramUsername) != "" {
						tgUser = strings.TrimSpace(*curCust.TelegramUsername)
					}
				} else if !utils.IsSyntheticTelegramID(curCust.TelegramID) && curCust.TelegramID > 0 {
					claimTelegramID = curCust.TelegramID
					cid = curCust.ID
					if curCust.TelegramUsername != nil && strings.TrimSpace(*curCust.TelegramUsername) != "" {
						tgUser = strings.TrimSpace(*curCust.TelegramUsername)
					}
				}
			}
		}
	} else {
		claimTelegramID = peerTelegramID
	}

	claim := TelegramClaim{
		TelegramID:       claimTelegramID,
		TelegramUsername: tgUser,
		CustomerTgID:     &cid,
		PeerAccountID:    peerAccountID,
	}
	s.claims.Save(currentAccountID, claim)
	return nil
}

// telegramIDFromIdentity возвращает real Telegram ID из cabinet_identity(account, provider=telegram).
func (s *MergeService) telegramIDFromIdentity(ctx context.Context, accountID int64) (int64, bool) {
	if s.pool == nil || accountID <= 0 {
		return 0, false
	}
	var providerUID string
	err := s.pool.QueryRow(ctx, `
		SELECT provider_user_id
		  FROM cabinet_identity
		 WHERE account_id = $1 AND provider = $2
		 ORDER BY id DESC
		 LIMIT 1`,
		accountID, repository.ProviderTelegram,
	).Scan(&providerUID)
	if err != nil {
		return 0, false
	}
	parsed, perr := strconv.ParseInt(strings.TrimSpace(providerUID), 10, 64)
	if perr != nil || parsed <= 0 {
		return 0, false
	}
	return parsed, true
}

// SaveTelegramOIDCClaim сохраняет merge-claim после Telegram OIDC link/start callback.
// Используется auth/service для маршрута /auth/telegram/callback, чтобы /link/merge/preview
// имел валидный claim и не падал merge_claim_missing.
func (s *MergeService) SaveTelegramOIDCClaim(ctx context.Context, currentAccountID, telegramID int64, telegramUsername string) error {
	if currentAccountID <= 0 || telegramID <= 0 {
		return fmt.Errorf("linking: invalid account or telegram id for telegram claim")
	}
	var customerTgID *int64
	cust, err := s.customers.FindByTelegramId(ctx, telegramID)
	if err == nil && cust != nil {
		id := cust.ID
		customerTgID = &id
	}
	claim := TelegramClaim{
		TelegramID:       telegramID,
		TelegramUsername: strings.TrimSpace(telegramUsername),
		CustomerTgID:     customerTgID,
	}
	s.claims.Save(currentAccountID, claim)
	slog.Info("claim_saved",
		"source", "oidc",
		"kind", "telegram",
		"account_id", currentAccountID,
		"telegram_id", telegramID,
		"has_customer_tg_id", customerTgID != nil,
	)
	return nil
}

// ============================================================================
// POST /link/merge/preview (dry-run)
// ============================================================================

// Preview выполняет dry-run merge и возвращает ожидаемые изменения.
// Транзакция в конце делает ROLLBACK, БД не меняется.
func (s *MergeService) Preview(ctx context.Context, accountID int64) (*MergePreview, error) {
	claim, ok := s.claims.Get(accountID)
	if !ok {
		return nil, ErrNoClaimFound
	}
	preview, _, _, err := s.doMerge(ctx, accountID, claim, true, false, "", "preview")
	if preview != nil {
		exp := claim.ExpiresAt
		preview.ClaimExpiresAt = &exp
	}
	return preview, err
}

// ============================================================================
// POST /link/merge/confirm
// ============================================================================

// Merge выполняет реальный merge с Idempotency-Key.
// idempotencyKey — строка из заголовка Idempotency-Key.
// force=true снимает защиту от «опасного» merge.
func (s *MergeService) Merge(ctx context.Context, accountID int64, idempotencyKey string, force bool, keepSubscription string) (*MergeResult, error) {
	// Проверяем идемпотентность: уже выполнен?
	existing, err := s.auditRepo.FindByIdempotencyKey(ctx, accountID, idempotencyKey)
	if err == nil {
		// Нашли — merge уже выполнен ранее; возвращаем cached result.
		cid := int64(0)
		if existing.TargetCustomerID != nil {
			cid = *existing.TargetCustomerID
		}
		return &MergeResult{
			Result:     existing.Result,
			CustomerID: cid,
		}, ErrMergeAlreadyDone
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("linking merge: find audit: %w", err)
	}

	claim, ok := s.claims.Get(accountID)
	if !ok {
		return nil, ErrNoClaimFound
	}

	preview, mergeResult, _, err := s.doMerge(ctx, accountID, claim, false, force, keepSubscription, idempotencyKey)
	_ = preview // не нужен в ответе на confirm
	if err != nil {
		return nil, err
	}

	// Успех — удаляем claim.
	s.claims.Delete(accountID)

	return mergeResult, nil
}

// ============================================================================
// Ядро merge (используется и в dry-run, и в реальном merge)
// ============================================================================

// mergePreservesTelegramCustomerRow — инвариант «Telegram-first»: при привязанном
// Telegram к cabinet-аккаунту строка customer с реальным telegram_id не удаляется
// merge'ом в пользу другого customer; keep=web означает только перенос полей
// подписки с web-customer на telegram-customer (см. mergeWinner/mergeLoser ниже).
// keep — нормализованное "web" | "tg" (после логики reqChoice).
func mergePreservesTelegramCustomerRow(keep string, accountHasTelegramIdentity bool) bool {
	k := strings.TrimSpace(strings.ToLower(keep))
	return k == "tg" || accountHasTelegramIdentity
}

// doMerge выполняет merge-транзакцию.
// dryRun=true → ROLLBACK в конце, preview заполнен, mergeResult=nil.
// dryRun=false → COMMIT, mergeResult заполнен.
func (s *MergeService) doMerge(
	ctx context.Context,
	accountID int64,
	claim TelegramClaim,
	dryRun bool,
	force bool,
	keepSubscription string,
	idempotencyKey string,
) (preview *MergePreview, result *MergeResult, auditIn repository.MergeAuditCreateInput, err error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: begin tx: %w", err)
	}

	// При любом выходе — rollback если не закоммичено.
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	// Читаем customer_web (текущий link аккаунта).
	link, linkErr := s.links.FindByAccountID(ctx, accountID)
	var custWeb *database.Customer
	if linkErr == nil {
		custWeb, err = lockCustomerByID(ctx, tx, link.CustomerID)
		if err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: lock customer_web: %w", err)
		}
	}

	// Читаем customer_tg по telegram_id из claim.
	var custTg *database.Customer
	if claim.CustomerTgID != nil {
		custTg, err = lockCustomerByID(ctx, tx, *claim.CustomerTgID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, nil, auditIn, fmt.Errorf("linking: lock customer_tg: %w", err)
		}
		if errors.Is(err, repository.ErrNotFound) {
			// Stale in-memory claim: customer id from claim may disappear after admin/sync actions.
			// Fallback to current customer row by real telegram_id to avoid false 500 on confirm.
			custTg, err = lockCustomerByTelegramID(ctx, tx, claim.TelegramID)
			if err != nil && !errors.Is(err, repository.ErrNotFound) {
				return nil, nil, auditIn, fmt.Errorf("linking: lock customer_tg by telegram_id: %w", err)
			}
			if errors.Is(err, repository.ErrNotFound) {
				custTg = nil
			}
		}
	}
	// Инвариант Telegram-first: если у текущего cabinet-аккаунта уже есть
	// telegram identity, каноническим TG-customer должен быть именно customer
	// с этим реальным telegram_id (а не peer из email/oauth merge-flow).
	currentTelegramID, currentHasTelegram := s.telegramIDFromIdentity(ctx, accountID)
	if currentHasTelegram {
		tgCanonical, tgErr := lockCustomerByTelegramID(ctx, tx, currentTelegramID)
		if tgErr != nil && !errors.Is(tgErr, repository.ErrNotFound) {
			return nil, nil, auditIn, fmt.Errorf("linking: lock current telegram customer: %w", tgErr)
		}
		if tgErr == nil && tgCanonical != nil {
			custTg = tgCanonical
			claim.TelegramID = currentTelegramID
		}
	}
	// Email-driven merge uses peer account as the second side. After Telegram-first
	// override above custTg may point to current canonical customer; keep peer
	// customer in custWeb so conflict detection and subscription choice remain valid.
	previewUISwap := false
	if claim.PeerAccountID > 0 {
		peerLink, peerErr := s.links.FindByAccountID(ctx, claim.PeerAccountID)
		if peerErr != nil && !errors.Is(peerErr, repository.ErrNotFound) {
			return nil, nil, auditIn, fmt.Errorf("linking: peer link lookup: %w", peerErr)
		}
		if peerErr == nil && peerLink != nil {
			peerCustomer, lockErr := lockCustomerByID(ctx, tx, peerLink.CustomerID)
			if lockErr != nil {
				return nil, nil, auditIn, fmt.Errorf("linking: lock peer customer: %w", lockErr)
			}
			if currentHasTelegram {
				// Telegram-first mode: current TG customer stays in custTg, peer becomes web-side.
				custWeb = peerCustomer
				previewUISwap = true
			} else if custTg == nil {
				// Legacy mode without bound telegram identity.
				custTg = peerCustomer
			}
		}
	}

	preview = &MergePreview{}
	preview.UISwapSides = previewUISwap
	if custWeb != nil {
		preview.CustomerWeb = snapshotCustomer(custWeb)
	}
	if custTg != nil {
		preview.CustomerTg = snapshotCustomer(custTg)
	}

	// ─────────────────────────────────────────────────────────────
	// No-op cases
	// ─────────────────────────────────────────────────────────────
	if custTg == nil && custWeb == nil {
		// Оба отсутствуют — нечего делать в рамках MVP.
		preview.IsNoop = true
		result = &MergeResult{Result: "noop"}
		if !dryRun {
			auditIn = auditInput(accountID, nil, nil, repository.MergeResultLinked, "no customers to merge", idempotencyKey, dryRun)
			_, _ = s.auditRepo.Create(ctx, tx, auditIn)
			if err := tx.Commit(ctx); err != nil {
				return nil, nil, auditIn, fmt.Errorf("linking: commit noop: %w", err)
			}
			committed = true
		}
		return preview, result, auditIn, nil
	}

	if custTg == nil {
		// Telegram claim не привязан к существующему customer в боте.
		// Просто обновляем customer_web: is_web_only=false, telegram_id=claim.TelegramID.
		preview.IsNoop = false
		if !dryRun {
			if err := promoteWebCustomer(ctx, tx, custWeb.ID, custWeb.TelegramID, claim.TelegramID); err != nil {
				return nil, nil, auditIn, fmt.Errorf("linking: promote web customer: %w", err)
			}
			auditIn = auditInput(accountID, &custWeb.ID, &custWeb.ID, repository.MergeResultLinked, "telegram linked to web customer", idempotencyKey, false)
			_, _ = s.auditRepo.Create(ctx, tx, auditIn)
			if err := tx.Commit(ctx); err != nil {
				return nil, nil, auditIn, fmt.Errorf("linking: commit promote: %w", err)
			}
			committed = true
		}
		result = &MergeResult{Result: "linked", CustomerID: custWeb.ID}
		return preview, result, auditIn, nil
	}

	if custWeb != nil && custWeb.ID == custTg.ID {
		// Уже один и тот же customer.
		preview.IsNoop = true
		result = &MergeResult{Result: "noop", CustomerID: custTg.ID}
		if !dryRun {
			auditIn = auditInput(accountID, &custWeb.ID, &custTg.ID, repository.MergeResultLinked, "noop: same customer", idempotencyKey, false)
			_, _ = s.auditRepo.Create(ctx, tx, auditIn)
			_ = tx.Commit(ctx)
			committed = true
		}
		return preview, result, auditIn, nil
	}

	if custWeb == nil {
		// Нет web-customer, есть TG-customer → просто переключаем link.
		preview.IsNoop = false
		if !dryRun {
			if err := s.links.UpdateCustomerID(ctx, accountID, custTg.ID); err != nil {
				return nil, nil, auditIn, fmt.Errorf("linking: update link: %w", err)
			}
			auditIn = auditInput(accountID, nil, &custTg.ID, repository.MergeResultLinked, "link to existing tg customer", idempotencyKey, false)
			_, _ = s.auditRepo.Create(ctx, tx, auditIn)
			if err := tx.Commit(ctx); err != nil {
				return nil, nil, auditIn, fmt.Errorf("linking: commit link: %w", err)
			}
			committed = true
		}
		result = &MergeResult{Result: "linked", CustomerID: custTg.ID}
		return preview, result, auditIn, nil
	}

	// ─────────────────────────────────────────────────────────────
	// Полный MERGE: custWeb != nil, custTg != nil, custWeb.ID != custTg.ID
	// ─────────────────────────────────────────────────────────────

	purchaseCount, err := countPurchases(ctx, tx, custWeb.ID)
	if err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: count purchases: %w", err)
	}
	referralCount, err := countReferrals(ctx, tx, custWeb.TelegramID)
	if err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: count referrals: %w", err)
	}
	preview.PurchasesMoved = purchaseCount
	preview.ReferralsMoved = referralCount

	mergedXP := custWeb.LoyaltyXP + custTg.LoyaltyXP
	mergedExtraHwid := maxInt(custWeb.ExtraHwid, custTg.ExtraHwid)
	preview.MergedLoyaltyXP = mergedXP
	preview.MergedExtraHwid = mergedExtraHwid

	reqChoice := subscriptionChoiceRequired(custWeb, custTg)
	preview.RequiresSubscriptionChoice = reqChoice
	preview.IsDangerous = false
	preview.DangerReason = ""

	keep := strings.TrimSpace(strings.ToLower(keepSubscription))
	if !reqChoice {
		if custWeb.ExpireAt != nil && custTg.ExpireAt == nil {
			keep = "web"
		} else {
			keep = "tg"
		}
	}
	if reqChoice {
		if keep != "web" && keep != "tg" && force {
			keep = "tg"
		}
		if keep != "web" && keep != "tg" {
			if dryRun {
				preview.MergedExpireAt = nil
				auditIn = auditInput(accountID, &custWeb.ID, &custTg.ID, repository.MergeResultDryRun, "dry_run", idempotencyKey, true)
				_, _ = s.auditRepo.Create(ctx, tx, auditIn)
				return preview, nil, auditIn, nil
			}
			return preview, nil, auditIn, ErrSubscriptionChoiceRequired
		}
	}
	if keep == "web" {
		preview.MergedExpireAt = custWeb.ExpireAt
	} else {
		preview.MergedExpireAt = custTg.ExpireAt
	}
	slog.Info("merge_decision",
		"stage", "pre_commit",
		"account_id", accountID,
		"keep_subscription", keep,
		"requires_choice", reqChoice,
		"customer_web_id", custWeb.ID,
		"customer_web_tg_id", custWeb.TelegramID,
		"customer_web_has_sub", custWeb.ExpireAt != nil,
		"customer_tg_id", custTg.ID,
		"customer_tg_tg_id", custTg.TelegramID,
		"customer_tg_has_sub", custTg.ExpireAt != nil,
	)

	if dryRun {
		auditIn = auditInput(accountID, &custWeb.ID, &custTg.ID, repository.MergeResultDryRun, "dry_run", idempotencyKey, true)
		_, _ = s.auditRepo.Create(ctx, tx, auditIn)
		return preview, nil, auditIn, nil
	}

	var finalCustomerID int64
	var loserForRemnawave *database.Customer
	var winnerForRemnawave *database.Customer
	// Если у текущего аккаунта есть telegram identity, customer c telegram_id
	// должен выживать всегда. keep=web в таком случае означает только выбор
	// стороны подписки/плана, но не смену канонического customer.
	if mergePreservesTelegramCustomerRow(keep, currentHasTelegram) {
		finalTelegramID := claim.TelegramID
		if finalTelegramID <= 0 {
			finalTelegramID = custTg.TelegramID
		}
		// If loser currently holds real Telegram ID, temporarily detach it to satisfy UNIQUE(customer.telegram_id)
		// before rebinding winner to the same ID.
		if custWeb.TelegramID == finalTelegramID && custTg.TelegramID != finalTelegramID {
			tempTG := mergeTempTelegramID(custWeb.ID)
			if _, err := tx.Exec(ctx, `UPDATE customer SET telegram_id = $2 WHERE id = $1`, custWeb.ID, tempTG); err != nil {
				return nil, nil, auditIn, fmt.Errorf("linking: detach web telegram_id: %w", err)
			}
		}
		if err := movePurchases(ctx, tx, custWeb.ID, custTg.ID); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: move purchases: %w", err)
		}
		if err := rebindCustomerTelegram(ctx, tx, custTg.ID, custTg.TelegramID, finalTelegramID); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: rebind winner telegram_id: %w", err)
		}
		if err := moveReferrals(ctx, tx, custWeb.TelegramID, finalTelegramID); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: move referrals: %w", err)
		}
		// По умолчанию поля подписки берём с tg-side; при keep=web переносим
		// подписочные поля с web-side в telegram-customer.
		mergeWinner := custTg
		mergeLoser := custWeb
		if keep == "web" {
			mergeWinner = custWeb
			mergeLoser = custTg
		}
		if err := applyWinnerMergedFields(ctx, tx, custTg.ID, mergeWinner, mergeLoser, mergedXP, mergedExtraHwid); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: apply merge fields: %w", err)
		}
		loserForRemnawave = custWeb
		winnerForRemnawave = custTg
		if _, err := tx.Exec(ctx,
			`UPDATE cabinet_account_customer_link SET customer_id = $2, link_status = 'linked', updated_at = NOW() WHERE account_id = $1`,
			accountID, custTg.ID); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: update link: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM customer WHERE id = $1`, custWeb.ID); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: delete customer_web: %w", err)
		}
		finalCustomerID = custTg.ID
	} else {
		if err := movePurchases(ctx, tx, custTg.ID, custWeb.ID); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: move purchases: %w", err)
		}
		// Освобождаем реальный telegram_id у customer_tg (UNIQUE), чтобы web мог занять T.
		tempTG := mergeTempTelegramID(custTg.ID)
		if _, err := tx.Exec(ctx, `UPDATE customer SET telegram_id = $2 WHERE id = $1`, custTg.ID, tempTG); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: detach tg telegram_id: %w", err)
		}
		if err := promoteWebCustomer(ctx, tx, custWeb.ID, custWeb.TelegramID, claim.TelegramID); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: promote web customer: %w", err)
		}
		if err := applyWinnerMergedFields(ctx, tx, custWeb.ID, custWeb, custTg, mergedXP, mergedExtraHwid); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: apply merge fields (keep web): %w", err)
		}
		// keep=web: loser is customer_tg, cleanup in RW only after successful DB commit.
		loserForRemnawave = custTg
		winnerForRemnawave = custWeb
		if _, err := tx.Exec(ctx, `DELETE FROM customer WHERE id = $1`, custTg.ID); err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: delete customer_tg: %w", err)
		}
		finalCustomerID = custWeb.ID
	}

	auditReason := "merged_keep_" + keep
	if force && reqChoice {
		auditReason += "_legacy_force"
	}
	auditIn = auditInput(accountID, &custWeb.ID, &custTg.ID, repository.MergeResultMerged, auditReason, idempotencyKey, false)
	if _, err := s.auditRepo.Create(ctx, tx, auditIn); err != nil {
		if !errors.Is(err, repository.ErrMergeAuditConflict) {
			return nil, nil, auditIn, fmt.Errorf("linking: write audit: %w", err)
		}
	}

	if claim.PeerAccountID > 0 {
		if err := s.absorbEmailPeerAccountTx(ctx, tx, accountID, claim.PeerAccountID); err != nil {
			return nil, nil, auditIn, err
		}
		if err := s.ensureCabinetEmailIdentityTx(ctx, tx, accountID); err != nil {
			return nil, nil, auditIn, err
		}
	}
	if claim.TelegramID > 0 {
		if err := s.ensureCabinetTelegramIdentityTx(ctx, tx, accountID, claim.TelegramID); err != nil {
			return nil, nil, auditIn, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: commit merge: %w", err)
	}
	committed = true
	if s.remnawave != nil && loserForRemnawave != nil {
		// Critical ordering: RW cleanup must run only after DB merge is committed.
		// Otherwise user may lose RW profile even when merge transaction fails.
		s.updateRemnawaveForMerge(ctx, loserForRemnawave, finalCustomerID, claim.TelegramID)
	}
	if s.remnawave != nil && winnerForRemnawave != nil && claim.TelegramID > 0 {
		// After loser cleanup, ensure winner profile in panel is bound to real telegram_id.
		// This prevents "user not found" in bot/cabinet after keep=web merges.
		s.syncRemnawaveWinnerAfterMerge(ctx, winnerForRemnawave, claim.TelegramID, claim.TelegramUsername)
	}
	slog.Info("merge_decision",
		"stage", "post_commit",
		"account_id", accountID,
		"keep_subscription", keep,
		"final_customer_id", finalCustomerID,
		"loser_customer_id", func() int64 {
			if loserForRemnawave == nil {
				return 0
			}
			return loserForRemnawave.ID
		}(),
		"loser_customer_tg_id", func() int64 {
			if loserForRemnawave == nil {
				return 0
			}
			return loserForRemnawave.TelegramID
		}(),
	)

	result = &MergeResult{
		Result:         "merged",
		CustomerID:     finalCustomerID,
		PurchasesMoved: purchaseCount,
		ReferralsMoved: referralCount,
	}
	return preview, result, auditIn, nil
}

// ============================================================================
// SQL helpers (all use pgx.Tx)
// ============================================================================

func lockCustomerByID(ctx context.Context, tx pgx.Tx, id int64) (*database.Customer, error) {
	const q = `SELECT id, telegram_id, expire_at, created_at, subscription_link, language,
		extra_hwid, extra_hwid_expires_at, current_tariff_id, subscription_period_start,
		subscription_period_months, loyalty_xp, telegram_username, is_web_only
		FROM customer WHERE id = $1 FOR UPDATE`
	row := tx.QueryRow(ctx, q, id)
	var c database.Customer
	err := row.Scan(
		&c.ID, &c.TelegramID, &c.ExpireAt, &c.CreatedAt, &c.SubscriptionLink, &c.Language,
		&c.ExtraHwid, &c.ExtraHwidExpiresAt, &c.CurrentTariffID, &c.SubscriptionPeriodStart,
		&c.SubscriptionPeriodMonths, &c.LoyaltyXP, &c.TelegramUsername, &c.IsWebOnly,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, fmt.Errorf("lock customer %d: %w", id, err)
	}
	return &c, nil
}

func lockCustomerByTelegramID(ctx context.Context, tx pgx.Tx, telegramID int64) (*database.Customer, error) {
	const q = `SELECT id, telegram_id, expire_at, created_at, subscription_link, language,
		extra_hwid, extra_hwid_expires_at, current_tariff_id, subscription_period_start,
		subscription_period_months, loyalty_xp, telegram_username, is_web_only
		FROM customer WHERE telegram_id = $1 FOR UPDATE`
	row := tx.QueryRow(ctx, q, telegramID)
	var c database.Customer
	err := row.Scan(
		&c.ID, &c.TelegramID, &c.ExpireAt, &c.CreatedAt, &c.SubscriptionLink, &c.Language,
		&c.ExtraHwid, &c.ExtraHwidExpiresAt, &c.CurrentTariffID, &c.SubscriptionPeriodStart,
		&c.SubscriptionPeriodMonths, &c.LoyaltyXP, &c.TelegramUsername, &c.IsWebOnly,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, fmt.Errorf("lock customer by telegram_id %d: %w", telegramID, err)
	}
	return &c, nil
}

func countPurchases(ctx context.Context, tx pgx.Tx, customerID int64) (int, error) {
	var n int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM purchase WHERE customer_id = $1`, customerID).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

func countReferrals(ctx context.Context, tx pgx.Tx, telegramID int64) (int, error) {
	var n int
	err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM referral WHERE referrer_id = $1 OR referee_id = $1`, telegramID).Scan(&n)
	return n, err
}

func movePurchases(ctx context.Context, tx pgx.Tx, fromID, toID int64) error {
	_, err := tx.Exec(ctx, `UPDATE purchase SET customer_id = $2 WHERE customer_id = $1`, fromID, toID)
	return err
}

func moveReferrals(ctx context.Context, tx pgx.Tx, fromTgID, toTgID int64) error {
	if _, err := tx.Exec(ctx, `UPDATE referral SET referrer_id = $2 WHERE referrer_id = $1`, fromTgID, toTgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE referral SET referee_id = $2 WHERE referee_id = $1`, fromTgID, toTgID); err != nil {
		return err
	}
	// После merge возможен self-referral (referrer_id == referee_id), его нужно удалить.
	_, err := tx.Exec(ctx, `DELETE FROM referral WHERE referrer_id = referee_id`)
	return err
}

func applyWinnerMergedFields(ctx context.Context, tx pgx.Tx, targetID int64, winner, loser *database.Customer, mergedXP int64, mergedExtra int) error {
	extraExp := winner.ExtraHwidExpiresAt
	if loser.ExtraHwidExpiresAt != nil {
		if extraExp == nil || loser.ExtraHwidExpiresAt.After(*extraExp) {
			extraExp = loser.ExtraHwidExpiresAt
		}
	}
	incomingUsername := pickTelegramUsername(winner, loser)
	var unameArg any
	if incomingUsername != nil {
		unameArg = *incomingUsername
	}
	_, err := tx.Exec(ctx, `
		UPDATE customer SET
			expire_at                     = $2,
			subscription_link             = $3,
			loyalty_xp                    = $4,
			extra_hwid                    = $5,
			extra_hwid_expires_at         = $6,
			current_tariff_id             = $7,
			subscription_period_start     = $8,
			subscription_period_months    = $9,
			is_web_only                   = FALSE,
			telegram_username             = COALESCE(telegram_username, $10)
		WHERE id = $1`,
		targetID,
		winner.ExpireAt,
		winner.SubscriptionLink,
		mergedXP,
		mergedExtra,
		extraExp,
		winner.CurrentTariffID,
		winner.SubscriptionPeriodStart,
		winner.SubscriptionPeriodMonths,
		unameArg,
	)
	return err
}

func pickTelegramUsername(a, b *database.Customer) *string {
	if a.TelegramUsername != nil && strings.TrimSpace(*a.TelegramUsername) != "" {
		return a.TelegramUsername
	}
	if b.TelegramUsername != nil && strings.TrimSpace(*b.TelegramUsername) != "" {
		return b.TelegramUsername
	}
	return nil
}

// mergeTempTelegramID — временный telegram_id при merge (keep web), чтобы
// освободить реальный id под customer_web (UNIQUE customer.telegram_id).
func mergeTempTelegramID(customerID int64) int64 {
	return -(100_000_000_000_000 + customerID)
}

func subscriptionChoiceRequired(web, tg *database.Customer) bool {
	if web == nil || tg == nil {
		return false
	}
	return web.ExpireAt != nil && tg.ExpireAt != nil
}

// promoteWebCustomer переводит web-only customer на реальный telegram_id и переносит
// строки referral с synthetic id (требуются DEFERRABLE FK на referral).
func promoteWebCustomer(ctx context.Context, tx pgx.Tx, customerID, oldTelegramID, newTelegramID int64) error {
	if _, err := tx.Exec(ctx,
		`UPDATE customer SET is_web_only = FALSE, telegram_id = $2 WHERE id = $1`,
		customerID, newTelegramID); err != nil {
		return err
	}
	return moveReferrals(ctx, tx, oldTelegramID, newTelegramID)
}

// rebindCustomerTelegram ensures the winner customer is attached to a real telegram_id
// and moves referral rows from old telegram_id to the new one.
func rebindCustomerTelegram(ctx context.Context, tx pgx.Tx, customerID, oldTelegramID, newTelegramID int64) error {
	if oldTelegramID == newTelegramID {
		_, err := tx.Exec(ctx, `UPDATE customer SET is_web_only = FALSE WHERE id = $1`, customerID)
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE customer SET is_web_only = FALSE, telegram_id = $2 WHERE id = $1`,
		customerID, newTelegramID); err != nil {
		return err
	}
	return moveReferrals(ctx, tx, oldTelegramID, newTelegramID)
}

// updateRemnawaveForMerge удаляет Remnawave-пользователя проигравшего customer (best-effort).
// Сначала lookup по устойчивым loser-маркерам (subscription_link / username "<loserID>_").
// Fallback по telegram_id разрешён только если он не совпадает с финальным winner telegram_id.
// Ошибки не фатальны: miss в RW не ломает консистентность БД merge.
func (s *MergeService) updateRemnawaveForMerge(ctx context.Context, loser *database.Customer, winnerCustomerID, winnerTelegramID int64) {
	if loser == nil {
		return
	}
	_ = config.RemnawaveTag() // использует config, чтобы import не убрался линтером
	users, listErr := s.remnawave.GetUsers(ctx)
	if listErr != nil {
		slog.Warn("linking: remnawave list users failed (non-fatal)", "customer_id", loser.ID, "error", listErr)
		return
	}

	subURL := strings.TrimSpace(valOrEmpty(loser.SubscriptionLink))
	namePrefix := strconv.FormatInt(loser.ID, 10) + "_"
	winnerPrefix := strconv.FormatInt(winnerCustomerID, 10) + "_"
	var user *remnawave.User
	for i := range users {
		u := &users[i]
		if subURL != "" && strings.TrimSpace(u.SubscriptionUrl) == subURL {
			user = u
			break
		}
		if strings.HasPrefix(strings.TrimSpace(u.Username), namePrefix) {
			user = u
			break
		}
	}

	// Telegram-id fallback can point to winner after keep=web (winner gets real tg id).
	if user == nil && loser.TelegramID > 0 && loser.TelegramID != winnerTelegramID {
		u, err := s.remnawave.GetUserTrafficInfo(ctx, loser.TelegramID)
		if err != nil {
			if !errors.Is(err, remnawave.ErrUserNotFound) {
				slog.Warn("linking: remnawave get loser user failed (non-fatal)", "telegram_id", loser.TelegramID, "error", err)
			}
		} else if u != nil {
			if strings.HasPrefix(strings.TrimSpace(u.Username), winnerPrefix) {
				slog.Warn("linking: remnawave fallback resolved winner profile; skip delete",
					"winner_customer_id", winnerCustomerID,
					"telegram_id", loser.TelegramID,
					"username", u.Username,
				)
			} else {
				user = u
			}
		}
	}

	if user == nil {
		slog.Info("linking: remnawave loser profile not found; skip delete",
			"loser_customer_id", loser.ID,
			"loser_telegram_id", loser.TelegramID,
		)
		return
	}
	if strings.HasPrefix(strings.TrimSpace(user.Username), winnerPrefix) {
		slog.Warn("linking: skip remnawave delete, matched winner profile",
			"winner_customer_id", winnerCustomerID,
			"user_uuid", user.UUID,
			"username", user.Username,
		)
		return
	}
	if err := s.remnawave.DeleteUser(ctx, user.UUID); err != nil {
		slog.Warn("linking: remnawave delete loser user failed (non-fatal)", "uuid", user.UUID, "error", err)
		return
	}
	slog.Info("linking: remnawave loser user deleted",
		"loser_customer_id", loser.ID,
		"user_uuid", user.UUID,
		"username", user.Username,
	)
}

// syncRemnawaveWinnerAfterMerge makes sure winner panel profile is rebound to real telegram_id
// and carries Telegram description for bot-facing UX.
func (s *MergeService) syncRemnawaveWinnerAfterMerge(ctx context.Context, winner *database.Customer, realTelegramID int64, telegramUsername string) {
	if winner == nil || realTelegramID <= 0 || utils.IsSyntheticTelegramID(realTelegramID) {
		return
	}
	users, err := s.remnawave.GetUsers(ctx)
	if err != nil {
		slog.Warn("linking: remnawave list users for winner sync failed (non-fatal)", "winner_customer_id", winner.ID, "error", err)
		return
	}
	winnerPrefix := strconv.FormatInt(winner.ID, 10) + "_"
	subURL := strings.TrimSpace(valOrEmpty(winner.SubscriptionLink))
	var target *remnawave.User
	for i := range users {
		u := &users[i]
		if strings.HasPrefix(strings.TrimSpace(u.Username), winnerPrefix) {
			target = u
			break
		}
		if subURL != "" && strings.TrimSpace(u.SubscriptionUrl) == subURL {
			target = u
			break
		}
	}
	if target == nil {
		slog.Info("linking: remnawave winner profile not found; skip winner sync", "winner_customer_id", winner.ID)
		return
	}

	req := &remnawave.UpdateUserRequest{UUID: &target.UUID}
	tid := int(realTelegramID)
	req.TelegramID = &tid
	if name := strings.TrimSpace(telegramUsername); name != "" {
		req.Description = &name
	}
	if _, err := s.remnawave.PatchUser(ctx, req); err != nil {
		slog.Warn("linking: remnawave winner sync failed (non-fatal)",
			"winner_customer_id", winner.ID,
			"user_uuid", target.UUID,
			"telegram_id", realTelegramID,
			"error", err,
		)
		return
	}
	slog.Info("linking: remnawave winner synced",
		"winner_customer_id", winner.ID,
		"user_uuid", target.UUID,
		"telegram_id", realTelegramID,
	)
}

// ============================================================================
// Merge helpers (правила 10.2)
// ============================================================================

func maxExpireAt(a, b *time.Time) *time.Time {
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	if a.After(*b) {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// activeSubscriptionConflict — оба профиля сейчас с активной подпиской и разные
// непустые subscription_link (merge изменит каноническую ссылку VPN).
func activeSubscriptionConflict(web, tg *database.Customer) bool {
	now := time.Now()
	webActive := web.ExpireAt != nil && web.ExpireAt.After(now)
	tgActive := tg.ExpireAt != nil && tg.ExpireAt.After(now)
	if !webActive || !tgActive {
		return false
	}
	webLink := strings.TrimSpace(valOrEmpty(web.SubscriptionLink))
	tgLink := strings.TrimSpace(valOrEmpty(tg.SubscriptionLink))
	return webLink != "" && tgLink != "" && webLink != tgLink
}

func valOrEmpty(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// mergedSubscriptionLink — итоговая ссылка на каноническом customer_tg.
// При конфликте двух активных подписок с разными ссылками приоритет у Telegram
// (канонический профиль бота); иначе — как в ТЗ 10.2: у кого позже expire_at.
func mergedSubscriptionLink(web, tg *database.Customer) *string {
	if activeSubscriptionConflict(web, tg) {
		return tg.SubscriptionLink
	}
	if web.ExpireAt != nil && (tg.ExpireAt == nil || web.ExpireAt.After(*tg.ExpireAt)) {
		return web.SubscriptionLink
	}
	return tg.SubscriptionLink
}

// detectDanger — возвращает true если у обоих есть активная подписка и разные
// subscription_link (пользователь рискует потерять одну из них).
func detectDanger(web, tg *database.Customer) (bool, string) {
	if !activeSubscriptionConflict(web, tg) {
		return false, ""
	}
	return true, "both customers have active subscriptions with different links"
}

func snapshotCustomer(c *database.Customer) *CustomerSnapshot {
	return &CustomerSnapshot{
		ID:               c.ID,
		ExpireAt:         c.ExpireAt,
		LoyaltyXP:        c.LoyaltyXP,
		ExtraHwid:        c.ExtraHwid,
		IsWebOnly:        c.IsWebOnly,
		TelegramID:       c.TelegramID,
		SubscriptionLink: c.SubscriptionLink,
		CurrentTariffID:  c.CurrentTariffID,
	}
}

func auditInput(accountID int64, srcID, dstID *int64, result, reason, ikey string, dryRun bool) repository.MergeAuditCreateInput {
	return repository.MergeAuditCreateInput{
		AccountID:        accountID,
		SourceCustomerID: srcID,
		TargetCustomerID: dstID,
		Actor:            repository.MergeActorUser,
		Result:           result,
		Reason:           reason,
		DryRun:           dryRun,
		IdempotencyKey:   ikey,
	}
}

// ============================================================================
// Misc helpers
// ============================================================================

func (s *MergeService) ensureCabinetEmailIdentity(ctx context.Context, accountID int64) error {
	acc, err := s.accounts.FindByID(ctx, accountID)
	if err != nil {
		return err
	}
	if acc.Email == nil {
		return nil
	}
	addr := strings.TrimSpace(*acc.Email)
	if addr == "" {
		return nil
	}
	pid := strconv.FormatInt(accountID, 10)
	_, err = s.identities.FindByProvider(ctx, repository.ProviderEmail, pid)
	if errors.Is(err, repository.ErrNotFound) {
		_, err = s.identities.Create(ctx, accountID, repository.ProviderEmail, pid, addr, nil)
		return err
	}
	return err
}

func (s *MergeService) ensureCabinetEmailIdentityTx(ctx context.Context, tx pgx.Tx, accountID int64) error {
	var email *string
	if err := tx.QueryRow(ctx, `SELECT email FROM cabinet_account WHERE id = $1`, accountID).Scan(&email); err != nil {
		return fmt.Errorf("linking: ensure email identity tx: load account: %w", err)
	}
	if email == nil || strings.TrimSpace(*email) == "" {
		return nil
	}
	pid := strconv.FormatInt(accountID, 10)
	ident, err := s.identities.FindByProvider(ctx, repository.ProviderEmail, pid)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return fmt.Errorf("linking: ensure email identity tx: find identity: %w", err)
	}
	if ident != nil {
		return nil
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO cabinet_identity (account_id, provider, provider_user_id, provider_email, raw_profile_json)
		VALUES ($1, $2, $3, $4, NULL)
		ON CONFLICT (provider, provider_user_id) DO NOTHING`,
		accountID, repository.ProviderEmail, pid, strings.TrimSpace(*email)); err != nil {
		return fmt.Errorf("linking: ensure email identity tx: insert identity: %w", err)
	}
	return nil
}

func (s *MergeService) ensureCabinetTelegramIdentityTx(ctx context.Context, tx pgx.Tx, accountID, telegramID int64) error {
	if accountID <= 0 || telegramID <= 0 {
		return fmt.Errorf("linking: ensure telegram identity tx: invalid ids")
	}
	pid := strconv.FormatInt(telegramID, 10)
	if _, err := tx.Exec(ctx, `
		INSERT INTO cabinet_identity (account_id, provider, provider_user_id, provider_email, raw_profile_json)
		VALUES ($1, $2, $3, NULL, NULL)
		ON CONFLICT (provider, provider_user_id)
		DO UPDATE SET account_id = EXCLUDED.account_id`,
		accountID, repository.ProviderTelegram, pid); err != nil {
		return fmt.Errorf("linking: ensure telegram identity tx: upsert identity: %w", err)
	}
	return nil
}

func (s *MergeService) absorbEmailPeerAccountTx(ctx context.Context, tx pgx.Tx, survivorID, peerID int64) error {
	if survivorID <= 0 || peerID <= 0 || survivorID == peerID {
		return fmt.Errorf("linking: absorb email peer tx: invalid account ids")
	}
	var email *string
	var pwd *string
	var ev *time.Time
	err := tx.QueryRow(ctx, `
		SELECT email, password_hash, email_verified_at
		  FROM cabinet_account WHERE id = $1 FOR UPDATE`, peerID).Scan(&email, &pwd, &ev)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("linking: absorb email peer tx: read peer: %w", err)
	}
	if email == nil || strings.TrimSpace(*email) == "" {
		// Peer could be already transformed (or stale claim from previous email-merge attempt).
		// Do not fail Telegram/social merge confirm in this case.
		slog.Warn("linking: absorb email peer tx skipped: peer has no email",
			"survivor_account_id", survivorID,
			"peer_account_id", peerID,
		)
		return nil
	}
	// Переносим identity peer-аккаунта на survivor до удаления peer.
	// Важно для кейса "привязал Google -> после merge в UI пропал Google".
	// Дубликаты provider/provider_user_id пропускаем (unique-key), затем чистим хвосты peer.
	if _, err := tx.Exec(ctx, `
		UPDATE cabinet_identity AS ci
		   SET account_id = $1
		 WHERE ci.account_id = $2
		   AND NOT EXISTS (
		     SELECT 1
		       FROM cabinet_identity s
		      WHERE s.account_id = $1
		        AND s.provider = ci.provider
		        AND s.provider_user_id = ci.provider_user_id
		   )`,
		survivorID, peerID); err != nil {
		return fmt.Errorf("linking: absorb email peer tx: move identities: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM cabinet_identity WHERE account_id = $1`, peerID); err != nil {
		return fmt.Errorf("linking: absorb email peer tx: cleanup peer identities: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM cabinet_account WHERE id = $1`, peerID); err != nil {
		return fmt.Errorf("linking: absorb email peer tx: delete peer: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE cabinet_account
		   SET email = $2, password_hash = $3, email_verified_at = $4, updated_at = NOW()
		 WHERE id = $1`,
		survivorID, strings.TrimSpace(strings.ToLower(*email)), pwd, ev); err != nil {
		return fmt.Errorf("linking: absorb email peer tx: update survivor: %w", err)
	}
	return nil
}

// assertTelegramFreeForAccount — один Telegram user id не может быть привязан
// к двум разным cabinet_account (ни через identity, ни через customer↔link).
func (s *MergeService) assertTelegramFreeForAccount(ctx context.Context, accountID, tgID int64) error {
	pid := strconv.FormatInt(tgID, 10)
	if s.identities != nil {
		ident, err := s.identities.FindByProvider(ctx, repository.ProviderTelegram, pid)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("linking: check telegram identity: %w", err)
		}
		if ident != nil && ident.AccountID != accountID {
			return ErrTelegramAlreadyLinked
		}
	}
	cust, err := s.customers.FindByTelegramId(ctx, tgID)
	if err != nil {
		return fmt.Errorf("linking: find customer by telegram: %w", err)
	}
	if cust == nil {
		return nil
	}
	link, err := s.links.FindByCustomerID(ctx, cust.ID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil
		}
		return fmt.Errorf("linking: find link by customer: %w", err)
	}
	if link.AccountID != accountID {
		return ErrTelegramAlreadyLinked
	}
	return nil
}

func mapTgErr(err error) error {
	switch {
	case errors.Is(err, tgverify.ErrInvalidHash):
		return fmt.Errorf("telegram: invalid signature")
	case errors.Is(err, tgverify.ErrAuthDateExpired):
		return fmt.Errorf("telegram: auth_date expired")
	case errors.Is(err, tgverify.ErrMissingFields):
		return fmt.Errorf("telegram: missing required fields")
	default:
		return err
	}
}

func generateRandHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", b), nil
}
