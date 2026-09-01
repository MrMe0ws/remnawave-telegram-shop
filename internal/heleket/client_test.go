package heleket

import (
	"context"
	"os"
	"strconv"
	"testing"
	"time"
)

func TestStripSignField(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "sign in the middle",
			in:   `{"uuid":"a","sign":"deadbeef","status":"paid"}`,
			want: `{"uuid":"a","status":"paid"}`,
		},
		{
			name: "sign last",
			in:   `{"uuid":"a","status":"paid","sign":"deadbeef"}`,
			want: `{"uuid":"a","status":"paid"}`,
		},
		{
			name: "sign first",
			in:   `{"sign":"deadbeef","uuid":"a","status":"paid"}`,
			want: `{"uuid":"a","status":"paid"}`,
		},
		{
			name: "only field",
			in:   `{"sign":"deadbeef"}`,
			want: `{}`,
		},
		{
			name: "spaces around colon and comma",
			in:   `{"uuid":"a", "sign" : "deadbeef" ,"status":"paid"}`,
			want: `{"uuid":"a", "status":"paid"}`,
		},
		{
			// PHP экранирует слэши; вырезаем поле по сырым байтам, остальное не трогаем.
			name: "escaped slashes preserved",
			in:   `{"url":"https:\/\/heleket.com\/pay","sign":"deadbeef"}`,
			want: `{"url":"https:\/\/heleket.com\/pay"}`,
		},
		{
			name: "escaped quote inside sign value",
			in:   `{"a":1,"sign":"de\"ad","b":2}`,
			want: `{"a":1,"b":2}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := stripSignField([]byte(tc.in))
			if !ok {
				t.Fatalf("stripSignField(%s) reported failure", tc.in)
			}
			if string(got) != tc.want {
				t.Fatalf("stripSignField(%s) = %s, want %s", tc.in, got, tc.want)
			}
		})
	}
}

func TestStripSignFieldMissing(t *testing.T) {
	if _, ok := stripSignField([]byte(`{"uuid":"a"}`)); ok {
		t.Fatal("expected failure when sign field is absent")
	}
}

func TestVerifyCallback(t *testing.T) {
	const apiKey = "test-api-key"
	// Тело ровно в том виде, в каком его прислал бы Heleket: слэши экранированы,
	// подпись посчитана от тела без поля sign.
	payload := `{"type":"payment","uuid":"u-1","order_id":"42","status":"paid","url":"https:\/\/heleket.com\/pay"}`
	sign := Sign([]byte(payload), apiKey)
	body := `{"type":"payment","uuid":"u-1","order_id":"42","status":"paid","url":"https:\/\/heleket.com\/pay","sign":"` + sign + `"}`

	if !VerifyCallback([]byte(body), sign, apiKey) {
		t.Fatal("VerifyCallback rejected a correctly signed body")
	}
	if VerifyCallback([]byte(body), sign, "another-key") {
		t.Fatal("VerifyCallback accepted a body signed with a different key")
	}
	tampered := `{"type":"payment","uuid":"u-1","order_id":"43","status":"paid","url":"https:\/\/heleket.com\/pay","sign":"` + sign + `"}`
	if VerifyCallback([]byte(tampered), sign, apiKey) {
		t.Fatal("VerifyCallback accepted a tampered body")
	}
}

func TestStatusClassification(t *testing.T) {
	success := []string{StatusPaid, StatusPaidOver}
	canceled := []string{StatusCancel, StatusFail, StatusSystemFail, StatusWrongAmount}
	pending := []string{StatusProcess, StatusCheck, StatusConfirmCheck, StatusWrongAmountWaiting}

	for _, s := range success {
		p := &Payment{Status: s}
		if !p.IsSuccess() || p.IsCanceled() || p.IsLocked() {
			t.Fatalf("%s should classify as success only", s)
		}
	}
	for _, s := range canceled {
		p := &Payment{Status: s}
		if !p.IsCanceled() || p.IsSuccess() || p.IsLocked() {
			t.Fatalf("%s should classify as canceled only", s)
		}
	}
	for _, s := range pending {
		p := &Payment{Status: s}
		if p.IsSuccess() || p.IsCanceled() || p.IsLocked() {
			t.Fatalf("%s should stay pending", s)
		}
	}
	locked := &Payment{Status: StatusLocked}
	if !locked.IsLocked() || locked.IsSuccess() || locked.IsCanceled() {
		t.Fatal("locked should be neither success nor canceled")
	}
	// Heleket отдаёт статус то в status, то в payment_status.
	if !(&Payment{PaymentStatus: "PAID"}).IsSuccess() {
		t.Fatal("payment_status fallback (and case folding) broken")
	}
}

func TestFormatAmount(t *testing.T) {
	for in, want := range map[float64]string{100: "100.00", 99.9: "99.90", 1234.567: "1234.57"} {
		if got := FormatAmount(in); got != want {
			t.Fatalf("FormatAmount(%v) = %s, want %s", in, got, want)
		}
	}
}

// TestLiveAPI проверяет подпись и поддержку валюты на боевом api.heleket.com.
// Пропускается, пока не заданы HELEKET_MERCHANT_ID и HELEKET_API_KEY.
func TestLiveAPI(t *testing.T) {
	merchant := os.Getenv("HELEKET_MERCHANT_ID")
	apiKey := os.Getenv("HELEKET_API_KEY")
	if merchant == "" || apiKey == "" {
		t.Skip("HELEKET_MERCHANT_ID / HELEKET_API_KEY not set")
	}

	currency := os.Getenv("HELEKET_CURRENCY")
	client := NewClient(merchant, apiKey, "", currency, 0)
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

	orderID := "selftest-" + strconv.FormatInt(time.Now().UnixNano(), 10)
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
