package bootstrap

import "errors"

// ErrTelegramCustomerLinkedElsewhere — у customer с этим telegram_id уже есть
// связь с другим cabinet_account; автоматически «перехватить» нельзя.
var ErrTelegramCustomerLinkedElsewhere = errors.New("cabinet: this Telegram user is already linked to another cabinet account")

// ErrAccountGone — cabinet_account удалён (self-delete из профиля, поглощение
// email-peer'а при merge, ресет БД), но access-JWT с его account_id ещё жив:
// подпись валидна, TTL не вышел, а строки в базе уже нет.
//
// Bootstrap на такой аккаунт ничего создавать не должен — ни customer, ни link.
// Вызывающий HTTP-слой обязан отдать 401: refresh не пройдёт (cabinet_session
// удалён каскадом), и фронт разлогинится сразу, а не досидит до конца TTL.
var ErrAccountGone = errors.New("cabinet: account no longer exists")
