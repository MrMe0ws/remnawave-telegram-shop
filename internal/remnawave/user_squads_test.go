package remnawave

import (
	"testing"

	"github.com/google/uuid"
)

var (
	sqA = uuid.MustParse("11111111-1111-1111-1111-111111111111")
	sqB = uuid.MustParse("22222222-2222-2222-2222-222222222222")
	sqC = uuid.MustParse("33333333-3333-3333-3333-333333333333")
)

func TestMergeSquadsAddsMissingKeepsManual(t *testing.T) {
	// C выдан клиенту руками и в тарифе не значится — правка тарифа не должна его снимать.
	got := MergeSquads([]uuid.UUID{sqA, sqC}, []uuid.UUID{sqB}, nil)
	want := []uuid.UUID{sqA, sqC, sqB}
	if len(got) != len(want) {
		t.Fatalf("длина = %d, ожидалась %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("порядок = %v, ожидался %v", got, want)
		}
	}
}

func TestMergeSquadsRemoves(t *testing.T) {
	got := MergeSquads([]uuid.UUID{sqA, sqB, sqC}, nil, []uuid.UUID{sqB})
	if !SameSquadSet(got, []uuid.UUID{sqA, sqC}) {
		t.Fatalf("got %v", got)
	}
}

func TestMergeSquadsIdempotent(t *testing.T) {
	first := MergeSquads([]uuid.UUID{sqA}, []uuid.UUID{sqB}, []uuid.UUID{sqC})
	second := MergeSquads(first, []uuid.UUID{sqB}, []uuid.UUID{sqC})
	if !SameSquadSet(first, second) {
		t.Fatalf("повторный прогон изменил набор: %v -> %v", first, second)
	}
}

func TestMergeSquadsDedupesAndDropsRemovedFromAdd(t *testing.T) {
	got := MergeSquads([]uuid.UUID{sqA, sqA}, []uuid.UUID{sqB, sqB}, []uuid.UUID{sqB})
	if !SameSquadSet(got, []uuid.UUID{sqA}) {
		t.Fatalf("got %v", got)
	}
}

func TestSameSquadSetIgnoresOrder(t *testing.T) {
	if !SameSquadSet([]uuid.UUID{sqA, sqB}, []uuid.UUID{sqB, sqA}) {
		t.Fatal("наборы из тех же элементов должны совпадать")
	}
	if SameSquadSet([]uuid.UUID{sqA}, []uuid.UUID{sqA, sqB}) {
		t.Fatal("разные по размеру наборы не должны совпадать")
	}
}

func TestSquadUUIDsOfNil(t *testing.T) {
	if got := SquadUUIDsOf(nil); got != nil {
		t.Fatalf("got %v", got)
	}
}
