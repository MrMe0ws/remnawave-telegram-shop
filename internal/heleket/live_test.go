//go:build heleket_live

// Живой тест против api.heleket.com. Отдельный build-tag, чтобы CI не мог
// случайно создать реальный счёт: у таких счетов order_id не наш, и они
// только мусорят в кабинете мерчанта.
//
// Запуск: go test -tags heleket_live ./internal/heleket/ -run TestLiveAPI -v
package heleket

import (
	"context"
	"os"
	"strconv"
	"testing"
	"time"
)

// TestLiveAPI проверяет подпись и поддержку валюты на боевом api.heleket.com.
// Пропускается, пока не заданы HELEKET_MERCHANT_ID и HELEKET_API_KEY.
func TestLiveAPI(t *testing.T) {
	merchant := os.Getenv("HELEKET_MERCHANT_ID")
	apiKey := os.Getenv("HELEKET_API_KEY")
	if merchant == "" || apiKey == "" {
		t.Skip("HELEKET_MERCHANT_ID / HELEKET_API_KEY not set")
	}

	currency := os.Getenv("HELEKET_CURRENCY")
	// Свой префикс: счета этого теста не должны разбираться как счета стенда.
	client := NewClient(merchant, apiKey, "", currency, "selftest", 0)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Несуществующий счёт: подпись верна — получаем «нет такого», подпись
	// неверна — 401. Побочных эффектов не создаёт.
	missing := "no-such-order-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	info, err := client.GetPaymentInfo(ctx, "", missing)
	if err != nil {
		t.Fatalf("auth check failed: %v", err)
	}
	if info != nil {
		t.Fatalf("unexpected payment for a random order_id: %+v", info)
	}
	t.Log("auth ok: signature accepted, unknown order_id reported as missing")

	if os.Getenv("HELEKET_LIVE_CREATE") == "" {
		t.Skip("set HELEKET_LIVE_CREATE=1 to also create a throwaway invoice")
	}

	orderID := FormatOrderID(client.OrderPrefix(), time.Now().UnixNano())
	payment, err := client.CreatePayment(ctx, orderID, FormatAmount(100), "Integration self-test", "")
	if err != nil {
		t.Fatalf("create payment failed: %v", err)
	}
	t.Logf("created: uuid=%s status=%s url=%s currency=%s", payment.UUID, payment.StatusValue(), payment.URL, client.Currency())

	back, err := client.GetPaymentInfo(ctx, payment.UUID, "")
	if err != nil {
		t.Fatalf("payment info failed: %v", err)
	}
	if back == nil {
		t.Fatal("just-created payment not found via /v1/payment/info")
	}
	if back.OrderID != orderID {
		t.Fatalf("order_id round-trip mismatch: got %q, want %q", back.OrderID, orderID)
	}
	t.Logf("info ok: status=%s payer_currency=%s", back.StatusValue(), back.PayerCurrency)
}
