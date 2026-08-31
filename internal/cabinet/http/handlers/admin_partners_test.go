package handlers

import "testing"

// Разбор путей админки. Опечатка здесь не падает, а тихо уводит запрос не туда:
// например, POST на выплату мог бы попасть в обработчик партнёра и отработать
// «действием, которого нет», вместо честного 404.
func TestParseAdminPartnerPath(t *testing.T) {
	cases := []struct {
		name   string
		path   string
		want   adminPartnerRoute
		wantOK bool
	}{
		{"список", "/cabinet/api/admin/partners", adminPartnerRoute{Kind: adminPartnerRouteList}, true},
		{"список со слэшем", "/cabinet/api/admin/partners/", adminPartnerRoute{Kind: adminPartnerRouteList}, true},
		{"счётчик дел", "/cabinet/api/admin/partners/pending", adminPartnerRoute{Kind: adminPartnerRoutePending}, true},
		{"ручное назначение", "/cabinet/api/admin/partners/grant", adminPartnerRoute{Kind: adminPartnerRouteGrant}, true},
		{"список выплат", "/cabinet/api/admin/partners/payouts", adminPartnerRoute{Kind: adminPartnerRoutePayouts}, true},

		{"карточка партнёра", "/cabinet/api/admin/partners/42",
			adminPartnerRoute{Kind: adminPartnerRoutePartner, ID: 42}, true},
		{"действие партнёра", "/cabinet/api/admin/partners/42/approve",
			adminPartnerRoute{Kind: adminPartnerRoutePartner, ID: 42, Action: "approve"}, true},
		{"корректировка баланса", "/cabinet/api/admin/partners/7/adjust",
			adminPartnerRoute{Kind: adminPartnerRoutePartner, ID: 7, Action: "adjust"}, true},

		// Выплата обязана распознаваться именно как выплата: иначе id заявки
		// уехал бы в обработчик партнёра.
		{"действие выплаты", "/cabinet/api/admin/partners/payouts/13/paid",
			adminPartnerRoute{Kind: adminPartnerRoutePayout, ID: 13, Action: "paid"}, true},
		{"отклонение выплаты", "/cabinet/api/admin/partners/payouts/13/reject",
			adminPartnerRoute{Kind: adminPartnerRoutePayout, ID: 13, Action: "reject"}, true},

		{"нечисловой id", "/cabinet/api/admin/partners/abc", adminPartnerRoute{}, false},
		{"нулевой id", "/cabinet/api/admin/partners/0", adminPartnerRoute{}, false},
		{"отрицательный id", "/cabinet/api/admin/partners/-1", adminPartnerRoute{}, false},
		{"нечисловой id выплаты", "/cabinet/api/admin/partners/payouts/abc/paid", adminPartnerRoute{}, false},
		{"лишний сегмент", "/cabinet/api/admin/partners/42/approve/now", adminPartnerRoute{}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseAdminPartnerPath(tc.path)
			if ok != tc.wantOK {
				t.Fatalf("parseAdminPartnerPath(%q) ok = %v, want %v", tc.path, ok, tc.wantOK)
			}
			if ok && got != tc.want {
				t.Fatalf("parseAdminPartnerPath(%q) = %+v, want %+v", tc.path, got, tc.want)
			}
		})
	}
}

// Процент вне 0..100 должен отбиваться до похода в базу: иначе админ получит
// отказ CHECK-ограничения вместо объяснения.
func TestValidatePartnerPercents(t *testing.T) {
	pct := func(v float64) *float64 { return &v }

	cases := []struct {
		name    string
		first   *float64
		renewal *float64
		wantErr bool
	}{
		{"оба не заданы — берутся глобальные", nil, nil, false},
		{"обычные значения", pct(40), pct(20), false},
		{"границы диапазона", pct(0), pct(100), false},
		{"дробный процент", pct(12.5), nil, false},
		{"отрицательный первый", pct(-1), nil, true},
		{"больше ста", pct(101), nil, true},
		{"отрицательный второй", nil, pct(-0.5), true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validatePartnerPercents(tc.first, tc.renewal)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validatePartnerPercents(%v, %v) err = %v, wantErr = %v",
					tc.first, tc.renewal, err, tc.wantErr)
			}
		})
	}
}

func TestParsePartnerStatuses(t *testing.T) {
	got := parsePartnerStatuses("active, rejected ,active,bogus,")
	want := []string{"active", "rejected"}
	if len(got) != len(want) {
		t.Fatalf("parsePartnerStatuses = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("parsePartnerStatuses = %v, want %v", got, want)
		}
	}
	if len(parsePartnerStatuses("")) != 0 {
		t.Error("пустая строка должна означать «без фильтра»")
	}
	// Из адресной строки в SQL не должно уезжать ничего, кроме известных статусов.
	if len(parsePartnerStatuses("'; DROP TABLE partner; --")) != 0 {
		t.Error("неизвестное значение не должно проходить")
	}
}
