package handlers

import (
	"testing"

	"github.com/google/uuid"

	"remnawave-tg-shop-bot/internal/database"
)

// Унаследованный UUID (заведён из SQUAD_UUIDS мимо панели либо сквад пересоздан)
// не должен делать тариф нередактируемым: сверяются только добавляемые сквады.
func TestValidateSquadListChecksOnlyAdded(t *testing.T) {
	stale := uuid.MustParse("3beecbc5-6742-4024-830a-6eec56620c10")
	fresh := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	// h.squads == nil — сверка с панелью недоступна, но разбор формата обязан работать.
	h := &AdminTariffsHandler{}
	if err := h.validateSquadList(nil, stale.String()+","+fresh.String(), []uuid.UUID{stale}); err != nil {
		t.Fatalf("не ожидалась ошибка: %v", err)
	}
	if err := h.validateSquadList(nil, "not-a-uuid", nil); err == nil {
		t.Fatal("битый формат должен отвергаться")
	}
}

// Список «что добавили» считается относительно сохранённого состава.
func TestAddedSquadsDiff(t *testing.T) {
	stale := uuid.MustParse("3beecbc5-6742-4024-830a-6eec56620c10")
	fresh := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	stored, err := database.ParseSquadUUIDList(stale.String())
	if err != nil {
		t.Fatal(err)
	}
	incoming, err := database.ParseSquadUUIDList(stale.String() + "," + fresh.String())
	if err != nil {
		t.Fatal(err)
	}
	had := map[uuid.UUID]struct{}{}
	for _, u := range stored {
		had[u] = struct{}{}
	}
	var added []uuid.UUID
	for _, u := range incoming {
		if _, ok := had[u]; !ok {
			added = append(added, u)
		}
	}
	if len(added) != 1 || added[0] != fresh {
		t.Fatalf("added = %v, ожидался только %s", added, fresh)
	}
}
