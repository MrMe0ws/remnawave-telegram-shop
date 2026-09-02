package heleket

import "testing"

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
		{
			// Наивный поиск подстроки вырезал бы вложенный ключ и оставил настоящий.
			name: "nested sign is not the one",
			in:   `{"a":{"sign":"inner"},"sign":"outer"}`,
			want: `{"a":{"sign":"inner"}}`,
		},
		{
			// Значение "sign" у соседнего поля раньше ломало разбор целиком.
			name: "sign as a value of another field",
			in:   `{"description":"sign","sign":"abc"}`,
			want: `{"description":"sign"}`,
		},
		{
			name: "non-string values around",
			in:   `{"n":12.5,"ok":true,"nil":null,"arr":[1,{"sign":"x"}],"sign":"abc"}`,
			want: `{"n":12.5,"ok":true,"nil":null,"arr":[1,{"sign":"x"}]}`,
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
	broken := []string{
		`{"uuid":"a"}`,           // поля sign нет
		`{"a":{"sign":"inner"}}`, // sign только внутри вложенного объекта
		`not json`,               // не объект
		`["sign"]`,               // массив верхнего уровня
		`{"sign":"abc"`,          // объект не закрыт
		`{"sign":}`,              // значения нет
		`{"sign":"abc",}`,        // висячая запятая
		`{"sign":"unterminated`,  // строка не закрыта
		`{"a":"tail\`,            // обрыв сразу после экранирования
	}
	for _, in := range broken {
		if _, ok := stripSignField([]byte(in)); ok {
			t.Fatalf("stripSignField(%q) unexpectedly succeeded", in)
		}
	}
}

func TestParseOrderID(t *testing.T) {
	const prefix = "shop"

	if got := FormatOrderID(prefix, 42); got != "shop-42" {
		t.Fatalf("FormatOrderID = %q", got)
	}

	good := map[string]int64{
		"shop-42":   42,
		" shop-42 ": 42,
		"42":        42, // счета, выставленные до перехода на префиксы
	}
	for in, want := range good {
		id, ok := ParseOrderID(prefix, in)
		if !ok || id != want {
			t.Fatalf("ParseOrderID(%q) = %d,%v; want %d,true", in, id, ok, want)
		}
	}

	// Чужой стенд на том же мерчанте, мусор и нечисловые id зачисляться не должны.
	bad := []string{"", "   ", "test-42", "selftest-1730000000", "shop-0", "shop--1", "shop-abc", "shop-", "-42", "0", "-1", "shop-42-1"}
	for _, in := range bad {
		if id, ok := ParseOrderID(prefix, in); ok {
			t.Fatalf("ParseOrderID(%q) unexpectedly accepted as %d", in, id)
		}
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
