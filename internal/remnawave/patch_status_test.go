package remnawave

import "testing"

// Remnawave 3.x отдаёт в карточке пользователя четыре статуса, но на запись
// принимает только два. Админские хендлеры читают карточку и шлют её обратно
// вместе с правкой, поэтому статус обязан нормализоваться перед PATCH —
// иначе правка тега у клиента с превышенным трафиком падает с 400.
func TestSanitizePatchStatus(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"активный проходит", "ACTIVE", "ACTIVE"},
		{"заблокированный проходит", "DISABLED", "DISABLED"},
		{"вычисляемый LIMITED вычищается", "LIMITED", ""},
		{"вычисляемый EXPIRED вычищается", "EXPIRED", ""},
		{"пустой остаётся пустым", "", ""},
		{"регистр не важен", "active", "ACTIVE"},
		{"пробелы обрезаются", "  DISABLED  ", "DISABLED"},
		{"неизвестное значение вычищается", "SOMETHING_NEW", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := sanitizePatchStatus(c.in); got != c.want {
				t.Fatalf("sanitizePatchStatus(%q) = %q, ожидалось %q", c.in, got, c.want)
			}
		})
	}
}

// LIMITED не должен молча превращаться в ACTIVE: правка тега или лимита
// не является основанием снимать блокировку по трафику.
func TestSanitizePatchStatusDoesNotUnblock(t *testing.T) {
	for _, blocked := range []string{"LIMITED", "EXPIRED"} {
		if got := sanitizePatchStatus(blocked); got == "ACTIVE" {
			t.Fatalf("%s превратился в ACTIVE — правка полей сняла бы блокировку", blocked)
		}
	}
}
