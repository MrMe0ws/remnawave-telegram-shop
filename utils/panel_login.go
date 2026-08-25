package utils

import (
	"fmt"
	"strings"
)

// PanelLoginLocalFromEmail приводит email кабинета к безопасной для панели
// local-part: нижний регистр, без плюс-адресации и точек, только [a-z0-9_].
//
// Правило вынесено сюда, а не продублировано, потому что от него зависят две
// стороны: выдача подписки формирует по нему username профиля Remnawave,
// а админка показывает и ищет клиентов по этому же логину. Разъедься они —
// админ искал бы по одному, а в панели лежало бы другое.
func PanelLoginLocalFromEmail(email string) string {
	email = strings.TrimSpace(strings.ToLower(email))
	at := strings.LastIndex(email, "@")
	if at <= 0 {
		return ""
	}
	local := email[:at]
	if plus := strings.Index(local, "+"); plus >= 0 {
		local = local[:plus]
	}
	local = strings.ReplaceAll(local, ".", "")

	var b strings.Builder
	for _, r := range local {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '_':
			b.WriteRune('_')
		}
	}
	return b.String()
}

// PanelLoginForCustomer собирает логин web-клиента в том же виде, в каком он
// попадает в панель Remnawave: "<customer_id>_<local-part email>".
//
// Если email неизвестен или после очистки пуст, используется суффикс "web" —
// ровно так же, как при создании профиля.
func PanelLoginForCustomer(customerID int64, email string) string {
	if customerID <= 0 {
		return ""
	}
	local := PanelLoginLocalFromEmail(email)
	if local == "" {
		local = "web"
	}
	return fmt.Sprintf("%d_%s", customerID, local)
}
