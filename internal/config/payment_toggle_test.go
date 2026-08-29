package config

import "testing"

// Способ оплаты нельзя включить без реквизитов: клиент не смог бы создать счёт,
// и переключатель в админке оказался бы декорацией — метод показывался бы
// клиенту, а оплата падала. Поэтому включение отдаёт ошибку с объяснением.
func TestPaymentToggleRefusesEnableWithoutCredentials(t *testing.T) {
	enabled := false
	apply := applyPaymentToggle(
		func() bool { return false },
		"set KEYS in .env first",
		func(v bool) { enabled = v },
	)

	err := apply("true")
	if err == nil {
		t.Fatal("включение без реквизитов должно возвращать ошибку")
	}
	if err.Error() != "set KEYS in .env first" {
		t.Fatalf("текст ошибки = %q, ожидалась подсказка про .env", err.Error())
	}
	if enabled {
		t.Fatal("значение не должно меняться при отказе")
	}
}

// Выключить метод можно всегда — даже если ключи из .env убрали. Иначе способ
// оплаты, оставшийся без реквизитов, нельзя было бы отключить из админки.
func TestPaymentToggleAlwaysAllowsDisable(t *testing.T) {
	enabled := true
	apply := applyPaymentToggle(
		func() bool { return false },
		"set KEYS in .env first",
		func(v bool) { enabled = v },
	)

	if err := apply("false"); err != nil {
		t.Fatalf("выключение вернуло ошибку: %v", err)
	}
	if enabled {
		t.Fatal("метод должен был выключиться")
	}
}

func TestPaymentToggleEnablesWithCredentials(t *testing.T) {
	enabled := false
	apply := applyPaymentToggle(
		func() bool { return true },
		"unused",
		func(v bool) { enabled = v },
	)

	if err := apply("true"); err != nil {
		t.Fatalf("включение с реквизитами вернуло ошибку: %v", err)
	}
	if !enabled {
		t.Fatal("метод должен был включиться")
	}
}

func TestPaymentToggleRejectsGarbage(t *testing.T) {
	apply := applyPaymentToggle(
		func() bool { return true },
		"unused",
		func(bool) {
			t.Fatal("значение не должно применяться при мусоре на входе")
		},
	)

	for _, v := range []string{"", "yes", "1", "включить"} {
		if err := apply(v); err == nil {
			t.Errorf("apply(%q) прошло без ошибки, ожидался отказ", v)
		}
	}
}

// .env.sample раздаёт заглушки: CRYPTO_PAY_TOKEN=token, YOOKASA_SHOP_ID=id,
// YOOKASA_SECRET_KEY=key. Кто скопировал пример и не заменил их, реквизитов не
// задал — но проверка на непустоту это пропускала, метод включался и клиент
// ловил ошибку уже на оплате.
func TestCredentialsSetRejectsSamplePlaceholders(t *testing.T) {
	// Ровно тот случай из .env.sample, на котором это и всплыло.
	if credentialsSet("https://pay.crypt.bot", "token") {
		t.Error("CRYPTO_PAY_TOKEN=token — это заглушка, реквизиты не заданы")
	}
	if credentialsSet("https://api.yookassa.ru/v3", "id", "key", "example@mail.com") {
		t.Error("заглушки ЮKassa из .env.sample не должны считаться реквизитами")
	}
	for _, v := range []string{"token", "TOKEN", " key ", "secret", "changeme", "example@mail.com"} {
		if credentialsSet(v) {
			t.Errorf("credentialsSet(%q) = true, ожидалась заглушка", v)
		}
	}
}

func TestCredentialsSetAcceptsRealValues(t *testing.T) {
	if !credentialsSet("https://pay.crypt.bot", "3928:AAxxxxRealLookingToken") {
		t.Error("настоящий токен должен приниматься")
	}
	if !credentialsSet("https://api.yookassa.ru/v3", "1064283", "live_Ab3xY", "shop@example.org") {
		t.Error("настоящие реквизиты ЮKassa должны приниматься")
	}
	// Пустое значение — тоже «не задано».
	if credentialsSet("value", "") {
		t.Error("пустое значение не должно проходить")
	}
}
