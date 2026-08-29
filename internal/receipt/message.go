package receipt

import (
	"encoding/json"
	"fmt"
	"html"
	"math"
	"regexp"
	"strings"
)

// Сообщения админу уходят с parse_mode=HTML, поэтому всё, что пришло снаружи
// (описание чека, тело ошибки от ФНС), обязательно экранируется.

const receiptTimeLayout = "02.01.2006 15:04"

// maxErrorLineLen — предел длины строки ошибки. Тело ответа ФНС бывает длинным,
// а у сообщения Telegram лимит 4096 символов.
const maxErrorLineLen = 300

// apiErrorRe вытаскивает HTTP-статус и JSON-тело из ошибки вида
// «... failed with status 422: {"code":"entity.not.found","message":"Не найдено"}».
var apiErrorRe = regexp.MustCompile(`status (\d{3}):\s*(\{.*\})`)

// formatAmount — «150 ₽» для целых сумм и «149.50 ₽» для дробных.
func formatAmount(v float64) string {
	if v == math.Trunc(v) {
		return fmt.Sprintf("%.0f ₽", v)
	}
	return fmt.Sprintf("%.2f ₽", v)
}

func truncate(s string, limit int) string {
	r := []rune(s)
	if len(r) <= limit {
		return s
	}
	return string(r[:limit]) + "…"
}

// formatReceiptError превращает ошибку в короткие читаемые строки.
//
// Сырая ошибка выглядит так:
//
//	reauthentication failed: authentication failed with status 422:
//	{"code":"entity.not.found","message":"Не найдено","additionalInfo":{}}
//
// Читать это в Telegram неудобно, поэтому JSON разбирается в
// «status 422: entity.not.found — Не найдено». Если разобрать не вышло,
// показываем исходный текст — лучше некрасиво, чем потерять причину.
func formatReceiptError(err error) []string {
	if err == nil {
		return nil
	}
	raw := strings.TrimSpace(err.Error())
	if raw == "" {
		return nil
	}

	m := apiErrorRe.FindStringSubmatch(raw)
	if m == nil {
		return []string{truncate(raw, maxErrorLineLen)}
	}

	var body struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if jsonErr := json.Unmarshal([]byte(m[2]), &body); jsonErr != nil || (body.Code == "" && body.Message == "") {
		return []string{truncate(raw, maxErrorLineLen)}
	}

	// Часть до «with status ...» — контекст вроде «reauthentication failed».
	head := strings.TrimSpace(raw[:strings.Index(raw, m[0])])
	head = strings.TrimSuffix(strings.TrimSpace(strings.TrimSuffix(head, "with")), ":")
	head = strings.TrimSpace(strings.TrimSuffix(head, ":"))

	detail := "status " + m[1] + ": " + body.Code
	if body.Message != "" {
		detail += " — " + body.Message
	}

	lines := make([]string, 0, 2)
	if head != "" {
		lines = append(lines, truncate(head, maxErrorLineLen))
	}
	return append(lines, truncate(detail, maxErrorLineLen))
}

// errorBlock — строки ошибки, каждая в <code>, уже экранированные.
func errorBlock(err error) string {
	lines := formatReceiptError(err)
	if len(lines) == 0 {
		return ""
	}
	out := make([]string, 0, len(lines))
	for _, l := range lines {
		out = append(out, "<code>"+html.EscapeString(l)+"</code>")
	}
	return strings.Join(out, "\n")
}

func esc(s string) string { return html.EscapeString(s) }

// queuedMessage — первая неудача: чек лёг в очередь, повторы пойдут сами.
func queuedMessage(purchaseID int64, amount float64, description, paidAt, nextAttempt string, pending int64, err error) string {
	var b strings.Builder
	b.WriteString("⚠️ <b>Чек «Мой налог» не прошёл — поставлен в очередь</b>\n\n")
	fmt.Fprintf(&b, "🛒 Покупка: <code>ID %d</code>\n", purchaseID)
	fmt.Fprintf(&b, "💰 Сумма: <b>%s</b>\n", esc(formatAmount(amount)))
	if d := strings.TrimSpace(description); d != "" {
		fmt.Fprintf(&b, "📝 Описание: <i>%s</i>\n", esc(d))
	}
	fmt.Fprintf(&b, "💳 Оплата: <code>%s</code>\n\n", esc(paidAt))
	fmt.Fprintf(&b, "🔄 Следующая попытка: <code>%s</code>\n", esc(nextAttempt))
	fmt.Fprintf(&b, "📦 Всего ждёт отправки: <code>%d</code>\n", pending)
	if block := errorBlock(err); block != "" {
		b.WriteString("\n❌ <b>Ошибка:</b>\n")
		b.WriteString(block)
		b.WriteString("\n")
	}
	b.WriteString("\n🔁 Повторные попытки выполняются автоматически.\n")
	b.WriteString("Отдельных сообщений по этому чеку больше не будет — сообщу, <b>когда чек успешно пройдёт</b>. ✅")
	return b.String()
}

// recoveredMessage — чек всё-таки прошёл после того, как о нём сообщали.
func recoveredMessage(purchaseID int64, amount float64, paidAt, receiptID string, attempts int) string {
	var b strings.Builder
	b.WriteString("✅ <b>Чек «Мой налог» проведён</b>\n\n")
	fmt.Fprintf(&b, "🛒 Покупка: <code>ID %d</code>\n", purchaseID)
	fmt.Fprintf(&b, "💰 Сумма: <b>%s</b>\n", esc(formatAmount(amount)))
	fmt.Fprintf(&b, "💳 Оплата: <code>%s</code>\n", esc(paidAt))
	if id := strings.TrimSpace(receiptID); id != "" {
		fmt.Fprintf(&b, "🧾 ID чека: <code>%s</code>\n", esc(id))
	}
	fmt.Fprintf(&b, "🔄 Попыток: <code>%d</code>\n\n", attempts)
	b.WriteString("📅 Доход зарегистрирован <b>датой оплаты</b>, а не датой отправки.")
	return b.String()
}

// gaveUpMessage — предельный срок вышел, дальше только руками.
func gaveUpMessage(purchaseID int64, amount float64, description, paidAt string, err error) string {
	var b strings.Builder
	b.WriteString("🛑 <b>Чек «Мой налог» снят с повторов</b>\n\n")
	fmt.Fprintf(&b, "🛒 Покупка: <code>ID %d</code>\n", purchaseID)
	fmt.Fprintf(&b, "💰 Сумма: <b>%s</b>\n", esc(formatAmount(amount)))
	if d := strings.TrimSpace(description); d != "" {
		fmt.Fprintf(&b, "📝 Описание: <i>%s</i>\n", esc(d))
	}
	fmt.Fprintf(&b, "💳 Оплата: <code>%s</code>\n", esc(paidAt))
	if block := errorBlock(err); block != "" {
		b.WriteString("\n❌ <b>Последняя ошибка:</b>\n")
		b.WriteString(block)
		b.WriteString("\n")
	}
	b.WriteString("\n⚠️ Истёк предельный срок повторов.\n")
	b.WriteString("Этот доход нужно внести в приложении <b>вручную</b>.")
	return b.String()
}
