package config

import (
	"strings"
	"testing"
)

// Сохранённое в БД значение может перестать быть допустимым: способ оплаты
// включили из админки, а позже из .env убрали (или так и не заменили) реквизиты.
// Ронять из-за этого старт нельзя — бот уходит в цикл перезапуска, и починить
// его можно только правкой БД. Такое значение пропускается с ошибкой в лог.
func TestLoadRuntimeOverridesSurvivesRejectedValue(t *testing.T) {
	restore := conf.isCryptoEnabled
	defer func() { conf.isCryptoEnabled = restore }()
	conf.isCryptoEnabled = false

	// Реквизиты CryptoPay в тестовом конфиге не заданы, поэтому включение
	// будет отклонено — ровно как на боевом старте.
	err := LoadRuntimeOverrides(map[string]string{"CRYPTO_PAY_ENABLED": "true"})
	if err != nil {
		t.Fatalf("старт упал из-за отклонённого значения: %v", err)
	}
	if conf.isCryptoEnabled {
		t.Error("отклонённое значение не должно применяться")
	}
}

// Неизвестный ключ (настройку удалили из кода) тоже не должен валить старт.
func TestLoadRuntimeOverridesSkipsUnknownKey(t *testing.T) {
	if err := LoadRuntimeOverrides(map[string]string{"SETTING_THAT_NO_LONGER_EXISTS": "1"}); err != nil {
		t.Fatalf("неизвестный ключ уронил старт: %v", err)
	}
}

// Живой PATCH из админки, наоборот, обязан вернуть ошибку — иначе админ
// нажмёт переключатель, ничего не произойдёт, и он не поймёт почему.
func TestApplyRuntimePatchStillReportsError(t *testing.T) {
	restore := conf.isCryptoEnabled
	defer func() { conf.isCryptoEnabled = restore }()

	_, err := ApplyRuntimePatch(map[string]string{"CRYPTO_PAY_ENABLED": "true"})
	if err == nil {
		t.Fatal("включение без реквизитов должно вернуть ошибку админу")
	}
	if !strings.Contains(err.Error(), "CRYPTO_PAY") {
		t.Errorf("текст ошибки = %q, ожидалось упоминание переменных .env", err.Error())
	}
}
