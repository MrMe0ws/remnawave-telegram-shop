package heleket

import (
	"strconv"
	"strings"
)

// DefaultOrderPrefix — префикс order_id по умолчанию.
const DefaultOrderPrefix = "shop"

// FormatOrderID собирает order_id счёта из префикса и id покупки.
//
// Голый числовой id использовать нельзя: order_id уникален в пределах мерчанта,
// а один мерчант Heleket легко оказывается общим у боевого и тестового стенда.
// Тогда /v1/payment/info по order_id=42 вернёт платёж чужого стенда, а создание
// счёта с уже занятым order_id отдаст СТАРЫЙ счёт со старой суммой.
func FormatOrderID(prefix string, purchaseID int64) string {
	prefix = normalizePrefix(prefix)
	return prefix + "-" + strconv.FormatInt(purchaseID, 10)
}

// ParseOrderID достаёт id покупки из order_id.
//
// Принимает только свой префикс: чужой стенд на том же мерчанте должен
// отсеиваться, а не молча зачисляться на совпавший числовой id.
//
// Голый числовой order_id тоже принимается — это счета, выставленные до
// перехода на префиксы; они доживают свой lifetime и исчезают.
func ParseOrderID(prefix, orderID string) (int64, bool) {
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return 0, false
	}

	if rest, ok := strings.CutPrefix(orderID, normalizePrefix(prefix)+"-"); ok {
		return parsePositiveInt(rest)
	}
	if !strings.ContainsRune(orderID, '-') {
		return parsePositiveInt(orderID)
	}
	return 0, false
}

func parsePositiveInt(s string) (int64, bool) {
	id, err := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func normalizePrefix(prefix string) string {
	prefix = strings.TrimSpace(prefix)
	prefix = strings.Trim(prefix, "-")
	if prefix == "" {
		return DefaultOrderPrefix
	}
	return prefix
}
