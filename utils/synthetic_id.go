// Package utils — общие вспомогательные функции, переиспользуемые в боте и web-кабинете.
package utils

// SyntheticTelegramIDBase — значение по умолчанию для базы synthetic telegram_id у web-only клиентов.
// Реальное значение подставляется из env CABINET_WEB_TELEGRAM_ID_BASE через internal/cabinet/config.
// Константа нужна как fallback, если кабинет выключен и проверка всё равно вызывается.
const SyntheticTelegramIDBase int64 = 7_000_000_000_000_000_000

// syntheticBase — текущая база, инициализированная из env во время старта кабинета (см. internal/cabinet/config).
// Если кабинет не запущен, остаётся SyntheticTelegramIDBase.
var syntheticBase int64 = SyntheticTelegramIDBase

// SetSyntheticTelegramIDBase устанавливает базу synthetic id во время инициализации приложения.
// Вызывается ровно один раз из internal/cabinet/config.InitConfig.
func SetSyntheticTelegramIDBase(base int64) {
	if base > 0 {
		syntheticBase = base
	}
}

// GetSyntheticTelegramIDBase возвращает текущую базу synthetic telegram_id.
// Используется для SQL-запросов и в startup-checks.
func GetSyntheticTelegramIDBase() int64 {
	return syntheticBase
}

// IsSyntheticTelegramID — hard guard для Telegram Bot API: возвращает true, если telegram_id принадлежит
// диапазону synthetic ID, зарезервированному для web-only клиентов кабинета.
// Ни один вызов Telegram API не должен выполняться, если IsSyntheticTelegramID(id) == true.
//
// Важно: дополнительно рекомендуется фильтровать по colonке customer.is_web_only в SQL-запросах
// (она явнее и быстрее в составных условиях), а эту функцию применять в Go-коде,
// где известен только int64 id.
func IsSyntheticTelegramID(telegramID int64) bool {
	return telegramID >= syntheticBase
}

// SyntheticTelegramID формирует synthetic telegram_id для web-only клиента по его cabinet_account.id.
// Формула: base + accountID. Гарантирует уникальность, пока CABINET_WEB_TELEGRAM_ID_BASE
// выбран с запасом выше текущих значений Telegram user id.
func SyntheticTelegramID(accountID int64) int64 {
	return syntheticBase + accountID
}
