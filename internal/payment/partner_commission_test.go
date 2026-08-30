package payment

import (
	"math"
	"testing"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
)

// setPartnerSettings применяет настройки на время теста и возвращает всё как
// было: conf — пакетная переменная, и утечка значения ломала бы соседние тесты.
func setPartnerSettings(t *testing.T, patch map[string]string) {
	t.Helper()
	before := make(map[string]string, len(patch))
	for key := range patch {
		before[key] = config.EffectiveEnv(key)
	}
	if _, err := config.ApplyRuntimePatch(patch); err != nil {
		t.Fatalf("apply settings %v: %v", patch, err)
	}
	t.Cleanup(func() {
		restore := make(map[string]string, len(before))
		for key, value := range before {
			if value == "" {
				continue
			}
			restore[key] = value
		}
		if len(restore) > 0 {
			if _, err := config.ApplyRuntimePatch(restore); err != nil {
				t.Fatalf("restore settings: %v", err)
			}
		}
	})
}

func floatPtr(v float64) *float64 { return &v }

func TestPartnerCommissionAmount(t *testing.T) {
	cases := []struct {
		name    string
		baseRub float64
		percent float64
		want    float64
	}{
		{"первая оплата 40% с 2990", 2990, 40, 1196},
		{"продление 20% с 1790", 1790, 20, 358},
		{"дробный процент округляется до копеек", 1499.99, 12.5, 187.50},
		{"копеечное округление вверх", 100.01, 33.33, 33.33},
		{"нулевой процент не начисляет", 2990, 0, 0},
		{"нулевая база не начисляет", 0, 40, 0},
		{"отрицательная база не начисляет", -100, 40, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := partnerCommissionAmount(tc.baseRub, tc.percent)
			if math.Abs(got-tc.want) > 0.0001 {
				t.Fatalf("partnerCommissionAmount(%v, %v) = %v, want %v", tc.baseRub, tc.percent, got, tc.want)
			}
		})
	}
}

func TestPartnerCommissionBase_RubPassesThrough(t *testing.T) {
	for _, currency := range []string{"RUB", "rub", ""} {
		got, ok := partnerCommissionBase(&database.Purchase{Amount: 1790, Currency: currency})
		if !ok || got != 1790 {
			t.Fatalf("currency %q: got %v, ok=%v; want 1790, true", currency, got, ok)
		}
	}
}

// Оплата звёздами конвертируется по курсу, а без курса пропускается: платить
// процент от количества звёзд как от рублей — значит выдать случайную сумму.
func TestPartnerCommissionBase_Stars(t *testing.T) {
	setPartnerSettings(t, map[string]string{"RUB_PER_STAR": "1.5"})

	for _, currency := range []string{"XTR", "STARS", "stars"} {
		got, ok := partnerCommissionBase(&database.Purchase{Amount: 100, Currency: currency})
		if !ok || math.Abs(got-150) > 0.0001 {
			t.Fatalf("currency %q: got %v, ok=%v; want 150, true", currency, got, ok)
		}
	}
}

func TestPartnerCommissionBase_StarsWithoutRateIsSkipped(t *testing.T) {
	setPartnerSettings(t, map[string]string{"RUB_PER_STAR": "0"})

	if _, ok := partnerCommissionBase(&database.Purchase{Amount: 100, Currency: "XTR"}); ok {
		t.Fatal("ожидался пропуск начисления: курс звезды не задан")
	}
	// Рублёвая оплата от отсутствия курса не страдает.
	if _, ok := partnerCommissionBase(&database.Purchase{Amount: 100, Currency: "RUB"}); !ok {
		t.Fatal("рублёвая оплата не должна зависеть от RUB_PER_STAR")
	}
}

func TestPartnerPercentFor_IndividualOverridesGlobal(t *testing.T) {
	setPartnerSettings(t, map[string]string{
		"PARTNER_FIRST_PERCENT":   "40",
		"PARTNER_RENEWAL_PERCENT": "20",
	})

	global := &database.Partner{}
	if got := partnerPercentFor(global, database.PartnerEarningKindFirst); got != 40 {
		t.Fatalf("глобальный процент первой оплаты = %v, want 40", got)
	}
	if got := partnerPercentFor(global, database.PartnerEarningKindRenewal); got != 20 {
		t.Fatalf("глобальный процент продления = %v, want 20", got)
	}

	individual := &database.Partner{FirstPercent: floatPtr(55), RenewalPercent: floatPtr(30)}
	if got := partnerPercentFor(individual, database.PartnerEarningKindFirst); got != 55 {
		t.Fatalf("индивидуальный процент первой оплаты = %v, want 55", got)
	}
	if got := partnerPercentFor(individual, database.PartnerEarningKindRenewal); got != 30 {
		t.Fatalf("индивидуальный процент продления = %v, want 30", got)
	}

	// Ноль — осмысленное «ничего не платим», а не «взять глобальное».
	zero := &database.Partner{FirstPercent: floatPtr(0)}
	if got := partnerPercentFor(zero, database.PartnerEarningKindFirst); got != 0 {
		t.Fatalf("нулевой индивидуальный процент = %v, want 0", got)
	}
}

func TestPartnerPercentFor_ClampsOutOfRange(t *testing.T) {
	over := &database.Partner{FirstPercent: floatPtr(150), RenewalPercent: floatPtr(-10)}
	if got := partnerPercentFor(over, database.PartnerEarningKindFirst); got != 100 {
		t.Fatalf("процент выше 100 не обрезан: %v", got)
	}
	if got := partnerPercentFor(over, database.PartnerEarningKindRenewal); got != 0 {
		t.Fatalf("отрицательный процент не обрезан: %v", got)
	}
}

func TestPartnerCountsPurchase(t *testing.T) {
	setPartnerSettings(t, map[string]string{"PARTNER_COUNT_EXTRA_HWID": "false"})

	subscription := &database.Purchase{PurchaseKind: database.PurchaseKindSubscription}
	upgrade := &database.Purchase{PurchaseKind: database.PurchaseKindTariffUpgrade}
	devices := &database.Purchase{PurchaseKind: database.PurchaseKindExtraHwid}

	if !partnerCountsPurchase(subscription) {
		t.Fatal("подписка должна засчитываться")
	}
	if !partnerCountsPurchase(upgrade) {
		t.Fatal("апгрейд тарифа должен засчитываться")
	}
	if partnerCountsPurchase(devices) {
		t.Fatal("доплата за устройства не должна засчитываться по умолчанию")
	}

	setPartnerSettings(t, map[string]string{"PARTNER_COUNT_EXTRA_HWID": "true"})
	if !partnerCountsPurchase(devices) {
		t.Fatal("доплата за устройства должна засчитываться при включённой настройке")
	}
}
