package tariffsquads

import (
	"testing"

	"github.com/google/uuid"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

var (
	sqA = uuid.MustParse("11111111-1111-1111-1111-111111111111")
	sqB = uuid.MustParse("22222222-2222-2222-2222-222222222222")
	sqC = uuid.MustParse("33333333-3333-3333-3333-333333333333")
)

func panel() []remnawave.InternalSquad {
	return []remnawave.InternalSquad{{UUID: sqA, Name: "A"}, {UUID: sqB, Name: "B"}}
}

func TestResolveEmptyMeansAllPanelSquads(t *testing.T) {
	got, err := resolveAgainstPanel(&database.Tariff{ActiveInternalSquadUUIDs: "  "}, panel())
	if err != nil {
		t.Fatal(err)
	}
	if !remnawave.SameSquadSet(got, []uuid.UUID{sqA, sqB}) {
		t.Fatalf("пустой список должен разворачиваться во все сквады панели, got %v", got)
	}
}

func TestResolveDropsSquadsMissingInPanel(t *testing.T) {
	// sqC удалён/пересоздан в панели — в составе тарифа его быть не должно.
	got, err := resolveAgainstPanel(&database.Tariff{
		ActiveInternalSquadUUIDs: sqA.String() + "," + sqC.String(),
	}, panel())
	if err != nil {
		t.Fatal(err)
	}
	if !remnawave.SameSquadSet(got, []uuid.UUID{sqA}) {
		t.Fatalf("got %v", got)
	}
}

func TestResolveRejectsBrokenList(t *testing.T) {
	// Раньше битая строка молча превращалась в «все сквады» (uuids, _ := ...).
	if _, err := resolveAgainstPanel(&database.Tariff{ActiveInternalSquadUUIDs: "not-a-uuid"}, panel()); err == nil {
		t.Fatal("ожидалась ошибка разбора")
	}
}

func TestDedupeDropsNilAndDuplicates(t *testing.T) {
	got := dedupe([]uuid.UUID{sqA, uuid.Nil, sqA, sqB})
	if len(got) != 2 || got[0] != sqA || got[1] != sqB {
		t.Fatalf("got %v", got)
	}
}
