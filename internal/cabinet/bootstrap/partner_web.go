package bootstrap

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/utils"
)

// ParsePartnerCode достаёт партнёрский код из того же поля, что несёт и
// реферальный параметр: у регистрации в кабинете один канал для «откуда пришёл»,
// и разбирать его надо в одном месте.
//
// Реферальный параметр — это telegram_id пригласившего, то есть всегда число
// (с префиксом ref_ или без). Партнёрский код — буквы и цифры из ссылки
// ?p=<code>. Поэтому: ref_ и голое число — не партнёрский код, всё остальное —
// партнёрский.
func ParsePartnerCode(raw string) string {
	// Регистр снимается до разбора: ссылку копируют из чата и из адресной
	// строки, и «P_A7F3K2» — тот же код, что «p_a7f3k2».
	code := strings.ToLower(strings.TrimSpace(raw))
	if code == "" {
		return ""
	}
	if strings.HasPrefix(code, "ref_") {
		return ""
	}
	code = strings.TrimPrefix(code, "p_")
	if code == "" || len(code) > 64 {
		return ""
	}
	digitsOnly := true
	for _, r := range code {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'a' && r <= 'z':
			digitsOnly = false
		default:
			return "" // посторонние символы в коде не встречаются
		}
	}
	if digitsOnly {
		return "" // это telegram_id реферера, а не код партнёра
	}
	return code
}

// AttachPartnerAfterWebRegister закрепляет только что зарегистрированный аккаунт
// кабинета за партнёром.
//
// Возвращает true, если закрепление состоялось: по этому признаку вызывающий
// решает, пробовать ли реферальную привязку. Партнёрская и реферальная
// программы взаимоисключающие — см. PartnerRepository.AttachAttribution.
func (b *CustomerBootstrap) AttachPartnerAfterWebRegister(ctx context.Context, accountID int64, language string, code string) (bool, error) {
	if b == nil || b.partnerRepo == nil || code == "" || !config.PartnerProgramEnabled() {
		return false, nil
	}

	resolved, err := b.partnerRepo.ResolveLinkCode(ctx, code)
	if err != nil {
		return false, fmt.Errorf("bootstrap: resolve partner link: %w", err)
	}
	if resolved == nil {
		return false, nil
	}

	link, err := b.EnsureForAccount(ctx, accountID, language)
	if err != nil {
		return false, err
	}

	partner, err := b.partnerRepo.FindByID(ctx, resolved.PartnerID)
	if err != nil {
		return false, fmt.Errorf("bootstrap: load partner: %w", err)
	}
	// Партнёр не приводит сам себя — иначе своя же комиссия превращается в
	// скидку на собственную подписку.
	if partner == nil || partner.CustomerID == link.CustomerID {
		return false, nil
	}

	linkID := resolved.Link.ID
	attached, err := b.partnerRepo.AttachAttribution(ctx, link.CustomerID, resolved.PartnerID, &linkID, database.PartnerAttributionSourceWeb)
	if err != nil {
		return false, fmt.Errorf("bootstrap: attach partner attribution: %w", err)
	}
	if attached {
		slog.Info("cabinet: partner attribution attached at web register",
			"account_id", accountID,
			"partner_id", resolved.PartnerID,
			"link_code", resolved.Link.Code,
			"customer_id", utils.MaskHalfInt64(link.CustomerID))
	}
	return attached, nil
}
