package remnawave

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// MergeSquads считает новый набор сквадов пользователя: (текущие + add) - remove.
//
// Именно слияние, а не замена составом тарифа: сквады, выданные конкретному
// клиенту руками (AdminUserSquadToggle), не должны исчезать из-за правки тарифа.
// Порядок текущих сохраняется, добавленные приписываются в конец — так diff
// в панели читается предсказуемо, а повторный запуск ничего не меняет.
func MergeSquads(current, add, remove []uuid.UUID) []uuid.UUID {
	removeSet := make(map[uuid.UUID]struct{}, len(remove))
	for _, u := range remove {
		removeSet[u] = struct{}{}
	}

	seen := make(map[uuid.UUID]struct{}, len(current)+len(add))
	out := make([]uuid.UUID, 0, len(current)+len(add))
	appendUnique := func(u uuid.UUID) {
		if _, skip := removeSet[u]; skip {
			return
		}
		if _, dup := seen[u]; dup {
			return
		}
		seen[u] = struct{}{}
		out = append(out, u)
	}
	for _, u := range current {
		appendUnique(u)
	}
	for _, u := range add {
		appendUnique(u)
	}
	return out
}

// SameSquadSet — совпадают ли наборы (порядок не важен).
func SameSquadSet(a, b []uuid.UUID) bool {
	if len(a) != len(b) {
		return false
	}
	set := make(map[uuid.UUID]struct{}, len(a))
	for _, u := range a {
		set[u] = struct{}{}
	}
	for _, u := range b {
		if _, ok := set[u]; !ok {
			return false
		}
	}
	return true
}

// SetUserSquads патчит ТОЛЬКО activeInternalSquads.
//
// Сознательно не переиспользует профиль тарифа (updateUserWithTariffProfile):
// тот шлёт ещё status=ACTIVE, expireAt и лимиты, поэтому массовое применение
// состава сквадов заодно реактивировало бы отключённых вручную клиентов
// и переписало бы им сроки. Здесь уходит только id и список сквадов.
func (r *Client) SetUserSquads(ctx context.Context, userID int64, squads []uuid.UUID) (*User, error) {
	if r == nil {
		return nil, fmt.Errorf("remnawave client not configured")
	}
	if userID <= 0 {
		return nil, ErrUserNotFound
	}
	list := append([]uuid.UUID(nil), squads...)
	req := &UpdateUserRequest{
		ID:                   &userID,
		ActiveInternalSquads: &list,
	}
	return r.PatchUser(ctx, req)
}

// SquadUUIDsOf — текущие сквады профиля панели в виде списка UUID.
func SquadUUIDsOf(u *User) []uuid.UUID {
	if u == nil {
		return nil
	}
	out := make([]uuid.UUID, 0, len(u.ActiveInternalSquads))
	for _, s := range u.ActiveInternalSquads {
		out = append(out, s.UUID)
	}
	return out
}
