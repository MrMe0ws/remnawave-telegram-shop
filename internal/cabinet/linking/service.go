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
)

// ============================================================================
// Sentinel errors
// ============================================================================

var (
	// ErrNoClaimFound — /merge/preview|confirm вызван без предварительного /telegram/confirm.
	ErrNoClaimFound = errors.New("linking: no confirmed telegram claim; call /link/telegram/confirm first")

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
	IsDangerous     bool              // требует force=true
	DangerReason    string
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
	return &claim, nil
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
	preview, _, _, err := s.doMerge(ctx, accountID, claim, true, false, "preview")
	return preview, err
}

// ============================================================================
// POST /link/merge/confirm
// ============================================================================

// Merge выполняет реальный merge с Idempotency-Key.
// idempotencyKey — строка из заголовка Idempotency-Key.
// force=true снимает защиту от «опасного» merge.
func (s *MergeService) Merge(ctx context.Context, accountID int64, idempotencyKey string, force bool) (*MergeResult, error) {
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

	preview, mergeResult, auditIn, err := s.doMerge(ctx, accountID, claim, false, force, idempotencyKey)
	_ = preview // не нужен в ответе на confirm
	if err != nil {
		return nil, err
	}

	// Успех — удаляем claim и отправляем письмо.
	s.claims.Delete(accountID)

	// Шлём email best-effort.
	if mergeResult.Result != "noop" {
		acc, accErr := s.accounts.FindByID(ctx, accountID)
		if accErr == nil && acc.Email != nil {
			lang := acc.Language
			if err := s.mailer.SendTelegramLinked(ctx, *acc.Email, lang, auditIn.Result); err != nil {
				slog.Warn("linking: send telegram_linked email failed", "error", err)
			}
		}
	}

	return mergeResult, nil
}

// ============================================================================
// Ядро merge (используется и в dry-run, и в реальном merge)
// ============================================================================

// doMerge выполняет merge-транзакцию.
// dryRun=true → ROLLBACK в конце, preview заполнен, mergeResult=nil.
// dryRun=false → COMMIT, mergeResult заполнен.
func (s *MergeService) doMerge(
	ctx context.Context,
	accountID int64,
	claim TelegramClaim,
	dryRun bool,
	force bool,
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
		if err != nil {
			return nil, nil, auditIn, fmt.Errorf("linking: lock customer_tg: %w", err)
		}
	}

	preview = &MergePreview{}
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

	// Считаем, сколько purchase и referral переедет.
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

	// Merge-правила 10.2.
	mergedExpire := maxExpireAt(custWeb.ExpireAt, custTg.ExpireAt)
	mergedXP := custWeb.LoyaltyXP + custTg.LoyaltyXP
	mergedExtraHwid := maxInt(custWeb.ExtraHwid, custTg.ExtraHwid)
	preview.MergedExpireAt = mergedExpire
	preview.MergedLoyaltyXP = mergedXP
	preview.MergedExtraHwid = mergedExtraHwid

	// Проверка «опасного» merge.
	isDangerous, dangerReason := detectDanger(custWeb, custTg)
	preview.IsDangerous = isDangerous
	preview.DangerReason = dangerReason

	if isDangerous && !force {
		return preview, nil, auditIn, ErrDangerousConflict
	}

	if dryRun {
		auditIn = auditInput(accountID, &custWeb.ID, &custTg.ID, repository.MergeResultDryRun, "dry_run", idempotencyKey, true)
		_, _ = s.auditRepo.Create(ctx, tx, auditIn)
		// dry-run → rollback (defer).
		return preview, nil, auditIn, nil
	}

	// Реальный merge — выполняем все UPDATE/DELETE внутри транзакции.

	// 1. Перенос purchase.
	if err := movePurchases(ctx, tx, custWeb.ID, custTg.ID); err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: move purchases: %w", err)
	}

	// 2. Перенос referral (по telegram_id).
	if err := moveReferrals(ctx, tx, custWeb.TelegramID, custTg.TelegramID); err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: move referrals: %w", err)
	}

	// 3. Обновляем поля customer_tg по merge-правилам.
	if err := applyMergeFields(ctx, tx, custTg, mergedExpire, mergedXP, mergedExtraHwid, custWeb); err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: apply merge fields: %w", err)
	}

	// 4. Remnawave: удаляем web-only user best-effort (не фатально, tx уже идёт).
	if s.remnawave != nil {
		s.updateRemnawaveForMerge(ctx, custWeb.TelegramID)
	}

	// 5. Переключаем link аккаунта на custTg.
	if _, err := tx.Exec(ctx,
		`UPDATE cabinet_account_customer_link SET customer_id = $2, link_status = 'linked', updated_at = NOW() WHERE account_id = $1`,
		accountID, custTg.ID); err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: update link: %w", err)
	}

	// 6. Удаляем customer_web.
	if _, err := tx.Exec(ctx, `DELETE FROM customer WHERE id = $1`, custWeb.ID); err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: delete customer_web: %w", err)
	}

	// 7. Пишем аудит.
	auditIn = auditInput(accountID, &custWeb.ID, &custTg.ID, repository.MergeResultMerged, "", idempotencyKey, false)
	if _, err := s.auditRepo.Create(ctx, tx, auditIn); err != nil {
		if !errors.Is(err, repository.ErrMergeAuditConflict) {
			return nil, nil, auditIn, fmt.Errorf("linking: write audit: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, auditIn, fmt.Errorf("linking: commit merge: %w", err)
	}
	committed = true

	result = &MergeResult{
		Result:         "merged",
		CustomerID:     custTg.ID,
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
	_, err := tx.Exec(ctx, `UPDATE referral SET referee_id = $2 WHERE referee_id = $1`, fromTgID, toTgID)
	return err
}

func applyMergeFields(ctx context.Context, tx pgx.Tx, tg *database.Customer,
	mergedExpire *time.Time, mergedXP int64, mergedExtraHwid int, web *database.Customer) error {

	subscriptionLink := mergedSubscriptionLink(web, tg)

	// current_tariff_id: приоритет у записи с активной подпиской, иначе — у tg.
	tariffID := tg.CurrentTariffID
	if tg.CurrentTariffID == nil && web.CurrentTariffID != nil {
		tariffID = web.CurrentTariffID
	}

	// extra_hwid_expires_at: максимум.
	extraExp := tg.ExtraHwidExpiresAt
	if web.ExtraHwidExpiresAt != nil {
		if extraExp == nil || web.ExtraHwidExpiresAt.After(*extraExp) {
			extraExp = web.ExtraHwidExpiresAt
		}
	}

	_, err := tx.Exec(ctx, `
		UPDATE customer SET
			expire_at                  = $2,
			subscription_link          = $3,
			loyalty_xp                 = $4,
			extra_hwid                 = $5,
			extra_hwid_expires_at      = $6,
			current_tariff_id          = $7,
			is_web_only                = FALSE,
			telegram_username          = COALESCE(telegram_username, $8)
		WHERE id = $1`,
		tg.ID,
		mergedExpire,
		subscriptionLink,
		mergedXP,
		mergedExtraHwid,
		extraExp,
		tariffID,
		web.TelegramUsername,
	)
	return err
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

// updateRemnawaveForMerge удаляет Remnawave-пользователя web-only customer (best-effort).
// Если customer_tg уже имеет своего Remnawave-пользователя, web-only становится дублем —
// его нужно убрать. Ошибки не фатальны: miss в RW не ломает консистентность БД.
func (s *MergeService) updateRemnawaveForMerge(ctx context.Context, webCustomerTgID int64) {
	_ = config.RemnawaveTag() // использует config, чтобы import не убрался линтером
	user, err := s.remnawave.GetUserTrafficInfo(ctx, webCustomerTgID)
	if err != nil {
		slog.Warn("linking: remnawave get web user failed (non-fatal)", "telegram_id", webCustomerTgID, "error", err)
		return
	}
	if user == nil {
		return
	}
	if err := s.remnawave.DeleteUser(ctx, user.UUID); err != nil {
		slog.Warn("linking: remnawave delete web user failed (non-fatal)", "uuid", user.UUID, "error", err)
	}
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
