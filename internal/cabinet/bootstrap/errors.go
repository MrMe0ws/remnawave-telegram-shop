package bootstrap

import "errors"

// ErrTelegramCustomerLinkedElsewhere — у customer с этим telegram_id уже есть
// связь с другим cabinet_account; автоматически «перехватить» нельзя.
var ErrTelegramCustomerLinkedElsewhere = errors.New("cabinet: this Telegram user is already linked to another cabinet account")
