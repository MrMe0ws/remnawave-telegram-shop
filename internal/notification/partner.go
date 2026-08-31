package notification

import (
	"context"
	"fmt"
	"html"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/translation"
	"remnawave-tg-shop-bot/utils"
)

// PartnerNotifier — уведомления партнёрской программы в Telegram.
//
// Шлём только транзакционные события: те, на которые собеседник сам ждёт
// ответа. Админу — «пришла заявка» и «запросили вывод», партнёру — решение по
// его заявке и по его выводу. Начисления, переходы по ссылкам и дозревание
// холда сюда намеренно не входят: отключить уведомления партнёр не может, а
// поток «вам начислено» превращается в спам ровно тогда, когда программа
// начинает работать. Всё это партнёр и так видит в кабинете, когда захочет.
//
// Отправка асинхронная и никогда не влияет на результат операции: заявка уже
// создана, вывод уже одобрен, и падение Telegram не должно этого отменять —
// как и в applyPartnerCommission, где откат стоил бы дороже потери события.
type PartnerNotifier struct {
	bot       *bot.Bot
	customers *database.CustomerRepository
	tm        *translation.Manager
	publicURL string
}

// NewPartnerNotifier возвращает nil, если слать некому или нечем: тогда
// вызывающая сторона хранит nil-указатель, и все вызовы становятся no-op без
// единой проверки на месте вызова.
func NewPartnerNotifier(b *bot.Bot, customers *database.CustomerRepository, tm *translation.Manager, publicURL string) *PartnerNotifier {
	if b == nil || customers == nil || tm == nil {
		return nil
	}
	return &PartnerNotifier{
		bot:       b,
		customers: customers,
		tm:        tm,
		publicURL: strings.TrimRight(strings.TrimSpace(publicURL), "/"),
	}
}

// --- события админу ---

// PartnerApplication — данные заявки для админского уведомления. Подпись
// клиента приходит готовой: правило «админу — без маскирования» живёт в
// хендлерах вместе с остальными подписями, и дублировать его здесь значило бы
// однажды разъехаться с ним.
type PartnerApplication struct {
	Label    string
	About    string
	Channels string
	Expected string
	// AutoApproved — модерация выключена, и человек уже партнёр. Уведомление
	// тогда не «разберите заявку», а «у вас новый партнёр».
	AutoApproved bool
}

func (n *PartnerNotifier) ApplicationSubmitted(ctx context.Context, app PartnerApplication) {
	if n == nil {
		return
	}
	key := "admin_partner_application_new"
	if app.AutoApproved {
		key = "admin_partner_application_auto"
	}
	// Анкета режется: «о себе» разрешено до 2000 символов, площадки до 1000, а
	// сообщение Telegram обрывается на 4096 — целиком анкета в уведомление не
	// поместится. Полный текст всегда есть в карточке, ссылка на неё ниже.
	n.notifyAdmin(ctx, key, "admin_partner_notify_open_link", "/admin/partners",
		esc(app.Label), escOrDash(trunc(app.About, 600)),
		escOrDash(trunc(app.Channels, 400)), escOrDash(trunc(app.Expected, 200)))
}

// PayoutRequested — партнёр запросил вывод. Реквизиты идут в <code>, чтобы
// админ копировал их одним тапом, а не выделял пальцем в середине строки.
func (n *PartnerNotifier) PayoutRequested(ctx context.Context, label string, amount float64, method, details string) {
	if n == nil {
		return
	}
	n.notifyAdmin(ctx, "admin_partner_payout_request", "admin_partner_notify_open_link", "/admin/partners",
		esc(label), esc(formatAmount(amount)), escOrDash(trunc(method, 100)), escOrDash(trunc(details, 300)))
}

// --- события партнёру ---

func (n *PartnerNotifier) ApplicationApproved(ctx context.Context, customerID int64, firstPercent, renewalPercent float64) {
	if n == nil {
		return
	}
	n.notifyPartner(ctx, customerID, "partner_application_approved",
		esc(formatPercent(firstPercent)), esc(formatPercent(renewalPercent)))
}

// Granted — партнёрство выдано админом вручную, без заявки. Отдельный текст:
// человек ничего не подавал, и «ваша заявка одобрена» его только запутает.
func (n *PartnerNotifier) Granted(ctx context.Context, customerID int64, firstPercent, renewalPercent float64) {
	if n == nil {
		return
	}
	n.notifyPartner(ctx, customerID, "partner_granted",
		esc(formatPercent(firstPercent)), esc(formatPercent(renewalPercent)))
}

func (n *PartnerNotifier) ApplicationRejected(ctx context.Context, customerID int64, comment string) {
	if n == nil {
		return
	}
	n.notifyPartner(ctx, customerID, "partner_application_rejected", escOrDash(trunc(comment, 600)))
}

func (n *PartnerNotifier) PayoutApproved(ctx context.Context, customerID int64, amount float64) {
	if n == nil {
		return
	}
	n.notifyPartner(ctx, customerID, "partner_payout_approved", esc(formatAmount(amount)))
}

func (n *PartnerNotifier) PayoutPaid(ctx context.Context, customerID int64, amount float64, externalRef string) {
	if n == nil {
		return
	}
	n.notifyPartner(ctx, customerID, "partner_payout_paid",
		esc(formatAmount(amount)), escOrDash(trunc(externalRef, 200)))
}

func (n *PartnerNotifier) PayoutRejected(ctx context.Context, customerID int64, amount float64, comment string) {
	if n == nil {
		return
	}
	n.notifyPartner(ctx, customerID, "partner_payout_rejected",
		esc(formatAmount(amount)), escOrDash(trunc(comment, 600)))
}

// --- доставка ---

// notifyAdmin отправляет в чат партнёрки: PARTNER_NOTIFY_CHAT_ID, а если он не
// задан — в личку админу. Пустой chat id это не «выключено», а «настройка по
// умолчанию»: чат под партнёрку заводят не все.
func (n *PartnerNotifier) notifyAdmin(ctx context.Context, key, linkKey, path string, args ...any) {
	if !config.PartnerNotifyEnabled() {
		return
	}
	chatID, threadID := config.PartnerNotifyChatID(), config.PartnerNotifyMessageThreadID()
	if chatID == 0 {
		chatID, threadID = config.GetAdminTelegramId(), 0
	}
	if chatID == 0 {
		return
	}
	lang := config.DefaultLanguage()
	text := n.render(lang, key, args...)
	if text == "" {
		return
	}
	text += n.linkLine(lang, linkKey, path)
	n.deliver(ctx, chatID, threadID, text, "admin")
}

// notifyPartner отправляет в личку партнёру. Партнёр — обычный клиент, поэтому
// язык берём его собственный, а не язык админки.
func (n *PartnerNotifier) notifyPartner(ctx context.Context, customerID int64, key string, args ...any) {
	if !config.PartnerNotifyEnabled() || customerID <= 0 {
		return
	}
	go func() {
		// Контекст запроса умирает вместе с HTTP-ответом, а отправка живёт
		// дольше него. WithoutCancel сохраняет значения (трассировку), но
		// отвязывает отмену.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
		defer cancel()

		customer, err := n.customers.FindById(ctx, customerID)
		if err != nil {
			slog.Error("partner notify: load customer", "error", err, "customer_id", utils.MaskHalfInt64(customerID))
			return
		}
		if customer == nil {
			return
		}
		// Партнёру из веб-кабинета писать некому: synthetic telegram_id не
		// соответствует ни одному чату, и Bot API ответит ошибкой на каждое
		// сообщение. Это штатная ситуация, а не сбой.
		if customer.IsWebOnly || utils.IsSyntheticTelegramID(customer.TelegramID) || customer.TelegramID <= 0 {
			return
		}
		lang := customer.Language
		text := n.render(lang, key, args...)
		if text == "" {
			return
		}
		text += n.linkLine(lang, "partner_notify_open_link", "/partner")
		n.send(ctx, customer.TelegramID, 0, text, "partner")
	}()
}

func (n *PartnerNotifier) deliver(ctx context.Context, chatID int64, threadID int, text, audience string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
		defer cancel()
		n.send(ctx, chatID, threadID, text, audience)
	}()
}

func (n *PartnerNotifier) send(ctx context.Context, chatID int64, threadID int, text, audience string) {
	disabled := true
	params := &bot.SendMessageParams{
		ChatID:             chatID,
		Text:               text,
		ParseMode:          models.ParseModeHTML,
		LinkPreviewOptions: &models.LinkPreviewOptions{IsDisabled: &disabled},
	}
	if threadID > 0 {
		params.MessageThreadID = threadID
	}
	if _, err := n.bot.SendMessage(ctx, params); err != nil {
		// Заблокированный бот и удалённый чат — норма, а не поломка: партнёр
		// вправе не читать бота. Поэтому Warn, и без ретраев.
		slog.Warn("partner notify: send failed", "audience", audience, "error", err)
	}
}

// render подставляет аргументы в шаблон перевода. Пустой шаблон означает
// потерянный ключ — отправлять «%!s(MISSING)» хуже, чем не отправить ничего.
func (n *PartnerNotifier) render(lang, key string, args ...any) string {
	tpl := strings.TrimSpace(n.tm.GetText(lang, key))
	if tpl == "" {
		slog.Warn("partner notify: missing translation", "key", key, "lang", lang)
		return ""
	}
	if len(args) == 0 {
		return tpl
	}
	return fmt.Sprintf(tpl, args...)
}

// linkLine добавляет ссылку в кабинет отдельной строкой, а не плейсхолдером в
// шаблоне: PublicURL может быть не задан, и тогда в тексте не должно остаться
// ни дырки от аргумента, ни ссылки в никуда.
func (n *PartnerNotifier) linkLine(lang, key, path string) string {
	if n.publicURL == "" {
		return ""
	}
	caption := strings.TrimSpace(n.tm.GetText(lang, key))
	if caption == "" {
		return ""
	}
	return fmt.Sprintf("\n\n<a href=\"%s%s\">%s</a>", esc(n.publicURL), path, esc(caption))
}

// --- форматирование ---

func esc(s string) string { return html.EscapeString(strings.TrimSpace(s)) }

// trunc режет по рунам, а не по байтам: обрыв кириллицы посередине символа даёт
// битый UTF-8, и Telegram отвергает всё сообщение целиком.
func trunc(s string, max int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) <= max {
		return string(r)
	}
	return strings.TrimSpace(string(r[:max])) + "…"
}

func escOrDash(s string) string {
	if v := esc(s); v != "" {
		return v
	}
	return "—"
}

// formatAmount печатает рубли без хвоста «.00»: суммы выводов почти всегда
// круглые, и «1000 ₽» читается быстрее, чем «1000.00 ₽».
func formatAmount(v float64) string {
	s := strconv.FormatFloat(v, 'f', 2, 64)
	s = strings.TrimSuffix(s, ".00")
	return s + " ₽"
}

// formatPercent — знак процента добавляем здесь, а не в шаблоне перевода:
// «%%» в json-строке живёт ровно до первой правки переводчиком, а ошибка
// вылезет уже в отправленном сообщении.
func formatPercent(v float64) string {
	s := strconv.FormatFloat(v, 'f', 2, 64)
	// Нули режем только в дробной части: цепочка TrimSuffix без этой проверки
	// превращала «40.00» в «4».
	if strings.Contains(s, ".") {
		s = strings.TrimRight(s, "0")
		s = strings.TrimRight(s, ".")
	}
	return s + "%"
}
