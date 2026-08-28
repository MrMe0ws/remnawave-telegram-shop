//go:build integration

package linking

// Матрица merge: все комбинации «есть/нет подписка», «есть/нет Telegram»,
// «есть/нет второй кабинет-аккаунт».
//
// Инварианты, которые проверяет весь файл (см. также README merge):
//
//	I1 Telegram-first — если в merge участвует РЕАЛЬНЫЙ telegram_id, выживший
//	   customer получает именно его, is_web_only=FALSE, а на аккаунте появляется
//	   cabinet_identity(telegram, <реальный id>).
//	I2 Выбранная сторона выигрывает целиком — и поля подписки в БД, и профиль
//	   в панели. Профиль проигравшей стороны удаляется, remnawave_user_id
//	   выжившего указывает на ЖИВОЙ профиль.
//	I3 Один customer — один кабинет-аккаунт. Второй аккаунт поглощается.
//	I4 Синтетический telegram_id никогда не становится cabinet_identity(telegram).
//	I5 Накопительные данные не теряются: XP суммируется, покупки/рефералы/
//	   промо-погашения/спины переезжают на выжившего.

import (
	"errors"
	"strconv"
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/utils"
)

// ============================================================================
// Общие ассерты матрицы
// ============================================================================

// survivorOf проверяет I3 и возвращает выжившего customer: у аккаунта ровно
// один link, он ведёт на одного из кандидатов, остальные кандидаты удалены.
func (e *mergeEnv) survivorOf(accountID int64, candidates ...int64) *database.Customer {
	e.t.Helper()
	cid, ok := e.linkedCustomerID(accountID)
	if !ok {
		e.t.Fatalf("после merge у аккаунта %d нет link на customer", accountID)
	}
	found := false
	for _, c := range candidates {
		if c == cid {
			found = true
			continue
		}
		if e.customerExists(c) {
			e.t.Errorf("проигравший customer %d не удалён (выжил %d)", c, cid)
		}
	}
	if !found {
		e.t.Fatalf("link ведёт на customer %d, которого нет среди кандидатов %v", cid, candidates)
	}
	if n := e.linksToCustomer(cid); n != 1 {
		e.t.Errorf("на выжившего customer %d ссылается %d link-строк, ожидалась 1", cid, n)
	}
	c := e.customerByID(cid)
	if c == nil {
		e.t.Fatalf("выживший customer %d не читается", cid)
	}
	return c
}

// assertRealTelegram проверяет I1 для выжившего customer и аккаунта.
func (e *mergeEnv) assertRealTelegram(accountID int64, c *database.Customer, tgID int64) {
	e.t.Helper()
	if c.TelegramID != tgID {
		e.t.Errorf("выживший customer.telegram_id = %d, ожидался реальный %d", c.TelegramID, tgID)
	}
	if c.IsWebOnly {
		e.t.Errorf("выживший customer остался is_web_only=TRUE при реальном telegram_id")
	}
	owner, ok := e.identityAccount(repository.ProviderTelegram, strconv.FormatInt(tgID, 10))
	if !ok {
		e.t.Errorf("не создана cabinet_identity(telegram, %d)", tgID)
	} else if owner != accountID {
		e.t.Errorf("cabinet_identity(telegram, %d) принадлежит аккаунту %d, ожидался %d", tgID, owner, accountID)
	}
}

// assertSubscription проверяет, что подписка выжившего взята с ожидаемой стороны.
func (e *mergeEnv) assertSubscription(c *database.Customer, wantExpire *time.Time, wantLink string) {
	e.t.Helper()
	switch {
	case wantExpire == nil && c.ExpireAt != nil:
		e.t.Errorf("ожидался пустой expire_at, получен %v", c.ExpireAt)
	case wantExpire != nil && c.ExpireAt == nil:
		e.t.Errorf("ожидался expire_at %v, получен nil", *wantExpire)
	case wantExpire != nil && !c.ExpireAt.Equal(*wantExpire):
		e.t.Errorf("expire_at = %v, ожидался %v", c.ExpireAt.UTC(), wantExpire.UTC())
	}
	got := ""
	if c.SubscriptionLink != nil {
		got = *c.SubscriptionLink
	}
	if got != wantLink {
		e.t.Errorf("subscription_link = %q, ожидался %q", got, wantLink)
	}
}

// assertPanelProfile проверяет I2: у выжившего customer живой профиль панели,
// он привязан к реальному telegram_id, а профиль проигравшего удалён.
func (e *mergeEnv) assertPanelProfile(c *database.Customer, wantPanelID, loserPanelID, wantTelegramID int64) {
	e.t.Helper()
	if c.RemnawaveUserID == nil {
		e.t.Fatalf("у выжившего customer %d не проставлен remnawave_user_id (ожидался %d)", c.ID, wantPanelID)
	}
	if *c.RemnawaveUserID != wantPanelID {
		e.t.Errorf("remnawave_user_id = %d, ожидался %d (профиль выбранной стороны)", *c.RemnawaveUserID, wantPanelID)
	}
	alive := e.panel.get(wantPanelID)
	if alive == nil {
		e.t.Fatalf("профиль панели %d, на который ссылается выживший customer, удалён", wantPanelID)
	}
	if wantTelegramID > 0 {
		if alive.TelegramID == nil {
			e.t.Errorf("у выжившего профиля панели %d не проставлен telegramId (ожидался %d)", wantPanelID, wantTelegramID)
		} else if *alive.TelegramID != wantTelegramID {
			e.t.Errorf("у выжившего профиля панели telegramId = %d, ожидался %d", *alive.TelegramID, wantTelegramID)
		}
	}
	if loserPanelID > 0 && e.panel.get(loserPanelID) != nil {
		e.t.Errorf("профиль панели проигравшей стороны %d не удалён", loserPanelID)
	}
}

// assertNoTelegramIdentity проверяет I4.
func (e *mergeEnv) assertNoTelegramIdentity(accountID int64) {
	e.t.Helper()
	var n int
	if err := e.pool.QueryRow(e.ctx,
		`SELECT COUNT(*) FROM cabinet_identity WHERE account_id = $1 AND provider = $2`,
		accountID, repository.ProviderTelegram).Scan(&n); err != nil {
		e.t.Fatalf("count telegram identities: %v", err)
	}
	if n != 0 {
		e.t.Errorf("на аккаунте %d появилось %d cabinet_identity(telegram), хотя реального Telegram в merge не было", accountID, n)
	}
}

// ============================================================================
// 1. Web без подписки + Telegram с подпиской → выбор не нужен, берём Telegram
// ============================================================================

func TestMerge_WebNoSub_TgWithSub(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("web-nosub")
	custWeb := e.webCustomerFor(acc, nil, "")
	e.link(acc, custWeb)
	webPanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/web", time.Now())
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custWeb.ID, webPanel.ID)

	tgID := e.nextTelegramID()
	tgExpire := activeUntil(30 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg", LoyaltyXP: 500})
	tgPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/tg", *tgExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, tgPanel.ID)

	e.addPurchase(custWeb, 100)
	e.addPurchase(custTg, 200)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, "tguser"); err != nil {
		t.Fatalf("save claim: %v", err)
	}

	res, err := e.svc.Merge(e.ctx, acc.ID, idemKey("web-nosub"), false, "")
	if err != nil {
		t.Fatalf("merge: %v", err)
	}
	if res.Result != "merged" {
		t.Fatalf("result = %q, ожидался merged", res.Result)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	e.assertRealTelegram(acc.ID, surv, tgID)
	e.assertSubscription(surv, tgExpire, "https://sub/tg")
	e.assertPanelProfile(surv, tgPanel.ID, webPanel.ID, tgID)

	if n := e.purchaseCount(surv.ID); n != 2 {
		t.Errorf("покупок у выжившего %d, ожидалось 2", n)
	}
	if surv.LoyaltyXP != 500 {
		t.Errorf("loyalty_xp = %d, ожидалось 500 (сумма)", surv.LoyaltyXP)
	}
}

// ============================================================================
// 2. Web с подпиской + Telegram без подписки → выбор не нужен, берём web,
//    но реальный telegram_id обязан переехать на выжившего (I1)
// ============================================================================

func TestMerge_WebWithSub_TgNoSub(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("web-sub")
	webExpire := activeUntil(45 * 24 * time.Hour)
	custWeb := e.webCustomerFor(acc, webExpire, "https://sub/web")
	e.link(acc, custWeb)
	webPanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/web", *webExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custWeb.ID, webPanel.ID)

	tgID := e.nextTelegramID()
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, LoyaltyXP: 120})
	tgPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/tg", time.Now())
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, tgPanel.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, "tguser"); err != nil {
		t.Fatalf("save claim: %v", err)
	}

	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("web-sub"), false, ""); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	e.assertRealTelegram(acc.ID, surv, tgID)
	e.assertSubscription(surv, webExpire, "https://sub/web")
	// Подписка взята с web-стороны → в панели обязан выжить именно web-профиль.
	e.assertPanelProfile(surv, webPanel.ID, tgPanel.ID, tgID)
	if surv.LoyaltyXP != 120 {
		t.Errorf("loyalty_xp = %d, ожидалось 120", surv.LoyaltyXP)
	}
}

// ============================================================================
// 3. Обе подписки активны, keep не передан → ошибка, БД не тронута
// ============================================================================

func TestMerge_BothActive_requiresChoice(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("both-choice")
	webExpire := activeUntil(10 * 24 * time.Hour)
	custWeb := e.webCustomerFor(acc, webExpire, "https://sub/web")
	e.link(acc, custWeb)
	webPanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/web", *webExpire)

	tgID := e.nextTelegramID()
	tgExpire := activeUntil(20 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg"})
	tgPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/tg", *tgExpire)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}

	_, err := e.svc.Merge(e.ctx, acc.ID, idemKey("both-choice"), false, "")
	if !errors.Is(err, ErrSubscriptionChoiceRequired) {
		t.Fatalf("ожидался ErrSubscriptionChoiceRequired, получено %v", err)
	}

	if !e.customerExists(custWeb.ID) || !e.customerExists(custTg.ID) {
		t.Error("при отказе merge ни один customer не должен быть удалён")
	}
	if cid, _ := e.linkedCustomerID(acc.ID); cid != custWeb.ID {
		t.Errorf("link изменился на %d, хотя merge не выполнялся", cid)
	}
	if e.panel.get(webPanel.ID) == nil || e.panel.get(tgPanel.ID) == nil {
		t.Error("при отказе merge панель не должна меняться")
	}

	// Preview на том же claim обязан подсветить необходимость выбора.
	prev, perr := e.svc.Preview(e.ctx, acc.ID)
	if perr != nil {
		t.Fatalf("preview: %v", perr)
	}
	if !prev.RequiresSubscriptionChoice {
		t.Error("preview.RequiresSubscriptionChoice = false при двух активных подписках")
	}
}

// ============================================================================
// 4-5. Обе активны + явный выбор
// ============================================================================

func TestMerge_BothActive_keepTg(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("keep-tg")
	webExpire := activeUntil(10 * 24 * time.Hour)
	custWeb := e.webCustomerFor(acc, webExpire, "https://sub/web")
	e.link(acc, custWeb)
	webPanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/web", *webExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custWeb.ID, webPanel.ID)

	tgID := e.nextTelegramID()
	tgExpire := activeUntil(20 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg"})
	tgPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/tg", *tgExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, tgPanel.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("keep-tg"), false, "tg"); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	e.assertRealTelegram(acc.ID, surv, tgID)
	e.assertSubscription(surv, tgExpire, "https://sub/tg")
	e.assertPanelProfile(surv, tgPanel.ID, webPanel.ID, tgID)
}

func TestMerge_BothActive_keepWeb_noTelegramIdentity(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("keep-web")
	webExpire := activeUntil(40 * 24 * time.Hour)
	custWeb := e.webCustomerFor(acc, webExpire, "https://sub/web")
	e.link(acc, custWeb)
	webPanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/web", *webExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custWeb.ID, webPanel.ID)

	tgID := e.nextTelegramID()
	tgExpire := activeUntil(5 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg"})
	tgPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/tg", *tgExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, tgPanel.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("keep-web"), false, "web"); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	e.assertRealTelegram(acc.ID, surv, tgID)
	e.assertSubscription(surv, webExpire, "https://sub/web")
	e.assertPanelProfile(surv, webPanel.ID, tgPanel.ID, tgID)
}

// ============================================================================
// 6. Ключевой кейс: вошёл через Telegram, привязывает email второго аккаунта
//    с активной подпиской и выбирает «оставить подписку с email».
//    Здесь у аккаунта УЖЕ есть cabinet_identity(telegram) — ветка, в которой
//    выживает tg-строка customer, но подписка берётся с web-стороны.
// ============================================================================

func TestMerge_EmailPeer_keepWeb_withTelegramIdentity(t *testing.T) {
	e := newMergeEnv(t)

	tgID := e.nextTelegramID()
	accTg := e.newAccount("")
	e.addTelegramIdentity(accTg, tgID)
	tgExpire := activeUntil(3 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg", LoyaltyXP: 100})
	e.link(accTg, custTg)
	tgPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/tg", *tgExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, tgPanel.ID)

	accPeer := e.newAccountWithPassword("peer", "$argon2id$fake")
	peerExpire := activeUntil(300 * 24 * time.Hour)
	custPeer := e.webCustomerFor(accPeer, peerExpire, "https://sub/peer")
	if _, err := e.pool.Exec(e.ctx, `UPDATE customer SET loyalty_xp = 700 WHERE id = $1`, custPeer.ID); err != nil {
		t.Fatalf("set xp: %v", err)
	}
	e.link(accPeer, custPeer)
	peerPanel := e.panel.addUser(custPeer.ID, custPeer.TelegramID, "https://sub/peer", *peerExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custPeer.ID, peerPanel.ID)
	e.addIdentity(accPeer, repository.ProviderGoogle, "google-sub-"+strconv.FormatInt(tgID, 10), "peer@merge.test")
	e.addPurchase(custPeer, 999)

	if err := e.svc.SaveEmailPeerClaim(e.ctx, accTg.ID, accPeer.ID); err != nil {
		t.Fatalf("save email peer claim: %v", err)
	}

	if _, err := e.svc.Merge(e.ctx, accTg.ID, idemKey("peer-keep-web"), false, "web"); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(accTg.ID, custTg.ID, custPeer.ID)
	// I1: Telegram сохранён, несмотря на выбор подписки с email-стороны.
	e.assertRealTelegram(accTg.ID, surv, tgID)
	// I2: подписка и профиль панели — с выбранной (peer) стороны.
	e.assertSubscription(surv, peerExpire, "https://sub/peer")
	e.assertPanelProfile(surv, peerPanel.ID, tgPanel.ID, tgID)
	// I5
	if surv.LoyaltyXP != 800 {
		t.Errorf("loyalty_xp = %d, ожидалось 800 (100+700)", surv.LoyaltyXP)
	}
	if n := e.purchaseCount(surv.ID); n != 1 {
		t.Errorf("покупок у выжившего %d, ожидалась 1 (перенос с peer)", n)
	}
	// I3: peer-аккаунт поглощён, его email и соц-привязки переехали.
	if e.accountExists(accPeer.ID) {
		t.Error("peer-аккаунт не удалён после merge")
	}
	if owner, ok := e.identityAccount(repository.ProviderGoogle, "google-sub-"+strconv.FormatInt(tgID, 10)); !ok {
		t.Error("Google-привязка peer-аккаунта потеряна при merge")
	} else if owner != accTg.ID {
		t.Errorf("Google-привязка осталась у аккаунта %d, ожидался %d", owner, accTg.ID)
	}
	survAcc, err := e.accounts.FindByID(e.ctx, accTg.ID)
	if err != nil {
		t.Fatalf("reload survivor account: %v", err)
	}
	if survAcc.Email == nil || *survAcc.Email == "" {
		t.Error("email peer-аккаунта не перенесён на выжившего")
	}
	if survAcc.PasswordHash == nil {
		t.Error("пароль peer-аккаунта не перенесён на выжившего")
	}
}

// ============================================================================
// 7. Триал против платника: обе активны → выбор обязателен, выбранный тариф
//    и его срок должны сохраниться целиком.
// ============================================================================

func TestMerge_TrialVsPaid_keepPaid(t *testing.T) {
	e := newMergeEnv(t)

	paidTariff := e.newTariff("paid")

	acc := e.newAccount("trial-vs-paid")
	trialExpire := activeUntil(2 * 24 * time.Hour)
	custWeb := e.webCustomerFor(acc, trialExpire, "https://sub/trial")
	e.link(acc, custWeb)
	trialPanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/trial", *trialExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custWeb.ID, trialPanel.ID)

	tgID := e.nextTelegramID()
	paidExpire := activeUntil(180 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{
		TelegramID: tgID, ExpireAt: paidExpire, SubLink: "https://sub/paid", TariffID: &paidTariff,
	})
	paidPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/paid", *paidExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, paidPanel.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("trial-paid"), false, "tg"); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	e.assertSubscription(surv, paidExpire, "https://sub/paid")
	e.assertPanelProfile(surv, paidPanel.ID, trialPanel.ID, tgID)
	if surv.CurrentTariffID == nil || *surv.CurrentTariffID != paidTariff {
		t.Errorf("current_tariff_id = %v, ожидался платный тариф %d", surv.CurrentTariffID, paidTariff)
	}
}

// ============================================================================
// 8. Одна подписка активна, вторая истекла → выбор НЕ требуется,
//    автоматически берём живую.
// ============================================================================

func TestMerge_OneExpired_autoKeepsActive(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("one-expired")
	// У web-стороны подписка давно истекла.
	deadExpire := expiredSince(90 * 24 * time.Hour)
	custWeb := e.webCustomerFor(acc, deadExpire, "https://sub/dead")
	e.link(acc, custWeb)
	deadPanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/dead", *deadExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custWeb.ID, deadPanel.ID)

	tgID := e.nextTelegramID()
	liveExpire := activeUntil(60 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: liveExpire, SubLink: "https://sub/live"})
	livePanel := e.panel.addUser(custTg.ID, tgID, "https://sub/live", *liveExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, livePanel.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}

	prev, err := e.svc.Preview(e.ctx, acc.ID)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if prev.RequiresSubscriptionChoice {
		t.Error("выбор подписки не должен требоваться, когда живая подписка одна")
	}

	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("one-expired"), false, ""); err != nil {
		t.Fatalf("merge без keep должен пройти: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	e.assertSubscription(surv, liveExpire, "https://sub/live")
	e.assertPanelProfile(surv, livePanel.ID, deadPanel.ID, tgID)
}

// TestMerge_OneExpired_activeOnWebSide — то же самое, но живая подписка на web-стороне.
func TestMerge_OneExpired_activeOnWebSide(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("one-expired-web")
	liveExpire := activeUntil(60 * 24 * time.Hour)
	custWeb := e.webCustomerFor(acc, liveExpire, "https://sub/live")
	e.link(acc, custWeb)
	livePanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/live", *liveExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custWeb.ID, livePanel.ID)

	tgID := e.nextTelegramID()
	deadExpire := expiredSince(30 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: deadExpire, SubLink: "https://sub/dead"})
	deadPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/dead", *deadExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, deadPanel.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("one-expired-web"), false, ""); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	e.assertRealTelegram(acc.ID, surv, tgID)
	e.assertSubscription(surv, liveExpire, "https://sub/live")
	e.assertPanelProfile(surv, livePanel.ID, deadPanel.ID, tgID)
}

// ============================================================================
// 9. Обе подписки истекли → выбор не нужен, берём ту, что истекла позже.
// ============================================================================

func TestMerge_BothExpired_keepsLater(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("both-expired")
	older := expiredSince(200 * 24 * time.Hour)
	custWeb := e.webCustomerFor(acc, older, "https://sub/older")
	e.link(acc, custWeb)
	olderPanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/older", *older)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custWeb.ID, olderPanel.ID)

	tgID := e.nextTelegramID()
	newer := expiredSince(2 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: newer, SubLink: "https://sub/newer"})
	newerPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/newer", *newer)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, newerPanel.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("both-expired"), false, ""); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	e.assertSubscription(surv, newer, "https://sub/newer")
	e.assertPanelProfile(surv, newerPanel.ID, olderPanel.ID, tgID)
}

// ============================================================================
// 10. Telegram-customer принадлежит ДРУГОМУ кабинет-аккаунту.
//     После merge не должно остаться ни второго link на выжившего,
//     ни осиротевшего аккаунта, ни украденной telegram-привязки.
// ============================================================================

func TestMerge_TelegramCustomerOwnedByAnotherAccount(t *testing.T) {
	e := newMergeEnv(t)

	// Аккаунт B — «телеграмный», к нему привязан customer с реальным tg_id.
	tgID := e.nextTelegramID()
	accB := e.newAccountWithPassword("owner", "$argon2id$fake")
	tgExpire := activeUntil(50 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg"})
	e.link(accB, custTg)
	e.addTelegramIdentity(accB, tgID)
	tgPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/tg", *tgExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, tgPanel.ID)

	// Аккаунт A — web, свой пустой customer; пользователь привязывает к нему тот же Telegram.
	accA := e.newAccount("linker")
	custWeb := e.webCustomerFor(accA, nil, "")
	e.link(accA, custWeb)
	webPanel := e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/web", time.Now())
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custWeb.ID, webPanel.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, accA.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, accA.ID, idemKey("owned-elsewhere"), false, ""); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(accA.ID, custWeb.ID, custTg.ID)
	e.assertRealTelegram(accA.ID, surv, tgID)
	e.assertSubscription(surv, tgExpire, "https://sub/tg")
	e.assertPanelProfile(surv, tgPanel.ID, webPanel.ID, tgID)

	// Второй аккаунт не имеет права остаться «висеть» рядом с тем же customer.
	if e.accountExists(accB.ID) {
		if cid, ok := e.linkedCustomerID(accB.ID); ok && cid == surv.ID {
			t.Error("второй кабинет-аккаунт всё ещё указывает на выжившего customer")
		} else {
			t.Error("второй кабинет-аккаунт остался живым, но без подписки — данные потеряны")
		}
	}
}

// ============================================================================
// 11. Два web-аккаунта, Telegram нет нигде: синтетический id не должен
//     превратиться в cabinet_identity(telegram) (I4), а customer обязан
//     остаться web-only.
// ============================================================================

func TestMerge_TwoWebAccounts_noTelegramAnywhere(t *testing.T) {
	e := newMergeEnv(t)

	accA := e.newAccount("weba")
	aExpire := activeUntil(15 * 24 * time.Hour)
	custA := e.webCustomerFor(accA, aExpire, "https://sub/a")
	e.link(accA, custA)
	aPanel := e.panel.addUser(custA.ID, custA.TelegramID, "https://sub/a", *aExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custA.ID, aPanel.ID)

	accB := e.newAccountWithPassword("webb", "$argon2id$fake")
	custB := e.webCustomerFor(accB, nil, "")
	e.link(accB, custB)
	bPanel := e.panel.addUser(custB.ID, custB.TelegramID, "https://sub/b", time.Now())
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custB.ID, bPanel.ID)

	if err := e.svc.SaveEmailPeerClaim(e.ctx, accA.ID, accB.ID); err != nil {
		t.Fatalf("save email peer claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, accA.ID, idemKey("two-web"), false, ""); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(accA.ID, custA.ID, custB.ID)
	e.assertNoTelegramIdentity(accA.ID)
	if !utils.IsSyntheticTelegramID(surv.TelegramID) {
		t.Errorf("telegram_id выжившего = %d, ожидался синтетический (реального Telegram не было)", surv.TelegramID)
	}
	if !surv.IsWebOnly {
		t.Error("customer без реального Telegram обязан остаться is_web_only=TRUE")
	}
	e.assertSubscription(surv, aExpire, "https://sub/a")
	if e.accountExists(accB.ID) {
		t.Error("peer-аккаунт не поглощён")
	}
}

// ============================================================================
// 12. У аккаунта нет link-строки (bootstrap падал) — merge обязан её создать
//     и всё равно поглотить peer, а не отрапортовать успех вхолостую.
// ============================================================================

func TestMerge_AccountWithoutLink(t *testing.T) {
	e := newMergeEnv(t)

	accA := e.newAccount("nolink")

	accB := e.newAccountWithPassword("nolink-peer", "$argon2id$fake")
	bExpire := activeUntil(25 * 24 * time.Hour)
	custB := e.webCustomerFor(accB, bExpire, "https://sub/b")
	e.link(accB, custB)
	e.addIdentity(accB, repository.ProviderVK, "vk-"+strconv.FormatInt(e.tgBase, 10), "")

	if err := e.svc.SaveEmailPeerClaim(e.ctx, accA.ID, accB.ID); err != nil {
		t.Fatalf("save email peer claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, accA.ID, idemKey("nolink"), false, ""); err != nil {
		t.Fatalf("merge: %v", err)
	}

	cid, ok := e.linkedCustomerID(accA.ID)
	if !ok {
		t.Fatal("merge отрапортовал успех, но link для аккаунта так и не создан")
	}
	if cid != custB.ID {
		t.Errorf("link ведёт на customer %d, ожидался %d", cid, custB.ID)
	}
	if e.accountExists(accB.ID) {
		t.Error("peer-аккаунт не поглощён в ветке без link")
	}
	if owner, ok := e.identityAccount(repository.ProviderVK, "vk-"+strconv.FormatInt(e.tgBase, 10)); !ok || owner != accA.ID {
		t.Errorf("VK-привязка peer не переехала на выжившего (ok=%v owner=%d)", ok, owner)
	}
}

// ============================================================================
// 13. Накопительные данные: промо-погашения, спины и рефералы переезжают.
// ============================================================================

func TestMerge_CarriesOverPerCustomerRecords(t *testing.T) {
	e := newMergeEnv(t)

	promoWeb := e.newPromoCode("MERGEWEB")
	promoBoth := e.newPromoCode("MERGEBOTH")

	acc := e.newAccount("records")
	custWeb := e.webCustomerFor(acc, nil, "")
	e.link(acc, custWeb)
	e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/web", time.Now())

	tgID := e.nextTelegramID()
	tgExpire := activeUntil(30 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg"})
	e.panel.addUser(custTg.ID, tgID, "https://sub/tg", *tgExpire)

	// Промокод, погашенный только web-стороной, и промокод, погашенный обеими.
	e.addPromoRedemption(promoWeb, custWeb)
	e.addPromoRedemption(promoBoth, custWeb)
	e.addPromoRedemption(promoBoth, custTg)
	e.addFortuneSpin(custWeb)
	e.addFortuneSpin(custWeb)
	e.addFortuneSpin(custTg)

	// Реферал: web-сторону пригласил кто-то третий.
	referrerTG := e.nextTelegramID()
	referrer := e.newCustomer(customerSpec{TelegramID: referrerTG})
	_ = referrer
	e.addReferral(referrerTG, custWeb.TelegramID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("records"), false, ""); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)

	// Одноразовые промокоды должны остаться погашенными: 2 разных кода.
	if n := e.promoRedemptionCount(surv.ID); n != 2 {
		t.Errorf("promo_redemption у выжившего = %d, ожидалось 2 (оба кода остаются погашенными)", n)
	}
	if n := e.fortuneSpinCount(surv.ID); n != 3 {
		t.Errorf("fortune_spins у выжившего = %d, ожидалось 3 (история обеих сторон)", n)
	}
	if n := e.referralCount(surv.TelegramID); n != 1 {
		t.Errorf("рефералов у выжившего = %d, ожидался 1 (перенесён с web-стороны)", n)
	}
}

// TestMerge_ReferralSelfLinkRemoved — если стороны реферили друг друга,
// после слияния строка стала бы self-referral и должна исчезнуть.
func TestMerge_ReferralSelfLinkRemoved(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("selfref")
	custWeb := e.webCustomerFor(acc, nil, "")
	e.link(acc, custWeb)
	e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/web", time.Now())

	tgID := e.nextTelegramID()
	tgExpire := activeUntil(30 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg"})
	e.panel.addUser(custTg.ID, tgID, "https://sub/tg", *tgExpire)

	// tg-сторона «пригласила» web-сторону — после merge это один человек.
	e.addReferral(tgID, custWeb.TelegramID)

	// Посторонняя пара рефералов не должна пострадать от глобальной чистки.
	outsiderA := e.nextTelegramID()
	outsiderB := e.nextTelegramID()
	e.newCustomer(customerSpec{TelegramID: outsiderA})
	e.newCustomer(customerSpec{TelegramID: outsiderB})
	e.addReferral(outsiderA, outsiderB)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}
	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("selfref"), false, ""); err != nil {
		t.Fatalf("merge: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	if n := e.referralCount(surv.TelegramID); n != 0 {
		t.Errorf("self-referral не удалён: у выжившего %d строк referral", n)
	}
	if n := e.referralCount(outsiderA); n != 1 {
		t.Errorf("чужая пара рефералов пострадала: %d строк вместо 1", n)
	}
}

// ============================================================================
// 14. Идемпотентность: повтор с тем же ключом не выполняет merge второй раз.
// ============================================================================

func TestMerge_IdempotencyKeyReuse(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("idem")
	custWeb := e.webCustomerFor(acc, nil, "")
	e.link(acc, custWeb)
	e.panel.addUser(custWeb.ID, custWeb.TelegramID, "https://sub/web", time.Now())

	tgID := e.nextTelegramID()
	tgExpire := activeUntil(30 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg"})
	tgPanel := e.panel.addUser(custTg.ID, tgID, "https://sub/tg", *tgExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, custTg.ID, tgPanel.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}

	key := idemKey("idem")
	first, err := e.svc.Merge(e.ctx, acc.ID, key, false, "")
	if err != nil {
		t.Fatalf("первый merge: %v", err)
	}

	second, err := e.svc.Merge(e.ctx, acc.ID, key, false, "")
	if !errors.Is(err, ErrMergeAlreadyDone) {
		t.Fatalf("повтор с тем же ключом: ожидался ErrMergeAlreadyDone, получено %v", err)
	}
	if second == nil || second.CustomerID != first.CustomerID {
		t.Errorf("повтор вернул другой customer_id: %+v vs %+v", second, first)
	}
	if n := e.linksToCustomer(first.CustomerID); n != 1 {
		t.Errorf("после повтора на customer ссылается %d link-строк", n)
	}
}

// ============================================================================
// 15. Панель недоступна: merge уже закоммичен в БД, ошибка панели не фатальна.
// ============================================================================

func TestMerge_PanelUnavailable_isNotFatal(t *testing.T) {
	e := newMergeEnv(t)

	acc := e.newAccount("panel-down")
	custWeb := e.webCustomerFor(acc, nil, "")
	e.link(acc, custWeb)

	tgID := e.nextTelegramID()
	tgExpire := activeUntil(30 * 24 * time.Hour)
	custTg := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg"})

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}

	e.panel.mu.Lock()
	e.panel.listErr = true
	e.panel.mu.Unlock()

	if _, err := e.svc.Merge(e.ctx, acc.ID, idemKey("panel-down"), false, ""); err != nil {
		t.Fatalf("недоступная панель не должна ронять merge: %v", err)
	}

	surv := e.survivorOf(acc.ID, custWeb.ID, custTg.ID)
	e.assertRealTelegram(acc.ID, surv, tgID)
	e.assertSubscription(surv, tgExpire, "https://sub/tg")
}

// ============================================================================
// 16. Повторный merge того же Telegram — noop, состояние не разъезжается.
// ============================================================================

func TestMerge_SameCustomerBothSides_isNoop(t *testing.T) {
	e := newMergeEnv(t)

	tgID := e.nextTelegramID()
	acc := e.newAccount("noop")
	tgExpire := activeUntil(30 * 24 * time.Hour)
	cust := e.newCustomer(customerSpec{TelegramID: tgID, ExpireAt: tgExpire, SubLink: "https://sub/tg"})
	e.link(acc, cust)
	panelUser := e.panel.addUser(cust.ID, tgID, "https://sub/tg", *tgExpire)
	e.pool.Exec(e.ctx, `UPDATE customer SET remnawave_user_id = $2 WHERE id = $1`, cust.ID, panelUser.ID)

	if err := e.svc.SaveTelegramOIDCClaim(e.ctx, acc.ID, tgID, ""); err != nil {
		t.Fatalf("save claim: %v", err)
	}
	res, err := e.svc.Merge(e.ctx, acc.ID, idemKey("noop"), false, "")
	if err != nil {
		t.Fatalf("merge: %v", err)
	}
	if res.Result != "noop" {
		t.Errorf("result = %q, ожидался noop", res.Result)
	}
	if e.panel.get(panelUser.ID) == nil {
		t.Error("noop-merge удалил профиль в панели")
	}
	surv := e.survivorOf(acc.ID, cust.ID)
	e.assertSubscription(surv, tgExpire, "https://sub/tg")
	// Даже в noop привязка Telegram должна быть зафиксирована.
	e.assertRealTelegram(acc.ID, surv, tgID)
}
