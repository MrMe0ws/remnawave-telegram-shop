//go:build contract

// Контрактный тест той части панели, которую трогает merge аккаунтов кабинета.
//
// Merge после слияния делает в панели ровно три вещи:
//  1. находит оба профиля (сохранённый id / ссылка подписки / префикс имени);
//  2. удаляет профиль проигравшей стороны (DELETE, 204 без тела);
//  3. переносит выживший профиль на нового владельца — PATCH с новым telegramId.
//
// Пункт 3 — самый хрупкий: в 3.0.0 сменился и адрес пользователя (числовой id
// вместо uuid), и правила PATCH. Если панель перестанет принимать смену
// telegramId, бот не найдёт слитого клиента по Telegram.
//
// Здесь же зафиксировано ограничение 3.3.2: username в PATCH игнорируется,
// поэтому переименовать профиль под нового владельца невозможно и merge
// опирается на remnawave_user_id.
//
// Запуск см. в contract_test.go.
package remnawave

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"
)

// TestContractMergePanelHandover воспроизводит работу merge с панелью.
func TestContractMergePanelHandover(t *testing.T) {
	c := contractClient(t)
	ctx := context.Background()

	stamp := time.Now().UnixNano()
	loserCustomerID := stamp % 100000
	winnerCustomerID := loserCustomerID + 1
	loserTelegramID := stamp%1_000_000_000 + 900_000_000_000
	winnerTelegramID := loserTelegramID + 1
	expire := time.Now().UTC().AddDate(0, 0, 30)

	mk := func(customerID, telegramID int64) *User {
		t.Helper()
		tl := int64(0)
		var resp apiResponse[User]
		err := c.doJSON(ctx, http.MethodPost, "/api/users", &CreateUserRequest{
			Username:             generateUsername(customerID, telegramID),
			ExpireAt:             expire,
			Status:               "ACTIVE",
			TrafficLimitBytes:    &tl,
			TrafficLimitStrategy: "MONTH",
			TelegramID:           &telegramID,
		}, &resp)
		if err != nil {
			t.Fatalf("создание профиля %d_%d: %v", customerID, telegramID, err)
		}
		return &resp.Response
	}

	loser := mk(loserCustomerID, loserTelegramID)
	winner := mk(winnerCustomerID, winnerTelegramID)
	t.Logf("loser id=%d %s / winner id=%d %s", loser.ID, loser.Username, winner.ID, winner.Username)

	winnerAlive := true
	defer func() {
		if winnerAlive {
			if err := c.DeleteUser(ctx, winner.ID); err != nil {
				t.Errorf("уборка winner: %v", err)
			}
		}
	}()

	// ── 1. Резолв обоих профилей так, как это делает merge ────────────────
	users, err := c.GetUsers(ctx)
	if err != nil {
		t.Fatalf("GetUsers: %v", err)
	}
	byPrefix := func(customerID int64) *User {
		prefix := fmt.Sprintf("%d_", customerID)
		for i := range users {
			if strings.HasPrefix(strings.TrimSpace(users[i].Username), prefix) {
				return &users[i]
			}
		}
		return nil
	}
	if got := byPrefix(loserCustomerID); got == nil || got.ID != loser.ID {
		t.Fatalf("профиль проигравшего не найден по префиксу customer_id: %+v", got)
	}
	if got := byPrefix(winnerCustomerID); got == nil || got.ID != winner.ID {
		t.Fatalf("профиль победителя не найден по префиксу customer_id: %+v", got)
	}
	for i := range users {
		if users[i].ID == winner.ID && strings.TrimSpace(users[i].SubscriptionUrl) == "" {
			t.Error("stream отдаёт пустой subscriptionUrl — merge не сможет резолвить профиль по ссылке")
		}
	}

	// ── 2. Удаление проигравшего: 204 без тела ────────────────────────────
	if err := c.DeleteUser(ctx, loser.ID); err != nil {
		t.Fatalf("DELETE проигравшего: %v", err)
	}
	if _, err := c.GetUserByID(ctx, loser.ID); err == nil {
		t.Error("удалённый профиль всё ещё читается")
	}

	// ── 3. Передача выжившего профиля новому владельцу ────────────────────
	// Так merge переносит подписку: telegramId проигравшего уходит на профиль
	// победителя.
	desc := "merge-contract"
	patched, err := c.PatchUser(ctx, &UpdateUserRequest{
		ID:          &winner.ID,
		TelegramID:  &loserTelegramID,
		Description: &desc,
	})
	if err != nil {
		t.Fatalf("PATCH выжившего: %v", err)
	}
	if patched.TelegramID == nil || *patched.TelegramID != loserTelegramID {
		t.Fatalf("telegramId не применился: %v", patched.TelegramID)
	}

	// Панель 3.3.2 НЕ умеет переименовывать профиль: username в PATCH молча
	// игнорируется (200, значение прежнее). Merge на это и рассчитывает —
	// он не переименовывает профиль, а запоминает remnawave_user_id.
	// Если панель однажды начнёт принимать username, этот тест это заметит,
	// и переименование в merge можно будет вернуть.
	renamed := generateUsername(winnerCustomerID, loserTelegramID)
	afterRename, err := c.PatchUser(ctx, &UpdateUserRequest{ID: &winner.ID, Username: &renamed})
	if err != nil {
		t.Logf("панель отклонила смену username: %v", err)
	} else if afterRename.Username == renamed {
		t.Errorf("панель начала принимать username в PATCH (%q) — "+
			"merge может снова переименовывать профиль, см. remnawaveAfterMerge", renamed)
	} else {
		reread, rerr := c.GetUserByID(ctx, winner.ID)
		if rerr != nil {
			t.Fatalf("перечитывание профиля: %v", rerr)
		}
		if reread.Username == renamed {
			t.Errorf("username всё-таки сменился после перечитывания (%q)", reread.Username)
		}
		t.Logf("подтверждено: username в PATCH игнорируется, имя осталось %q", reread.Username)
	}

	// ── 4. Бот обязан находить выжившего по перенесённому telegram_id ─────
	found, err := c.GetUserTrafficInfo(ctx, loserTelegramID)
	if err != nil {
		t.Fatalf("поиск выжившего по перенесённому telegram_id: %v", err)
	}
	if found.ID != winner.ID {
		t.Fatalf("по telegram_id нашёлся чужой профиль: %d != %d", found.ID, winner.ID)
	}

	// ── 5. Уборка ─────────────────────────────────────────────────────────
	if err := c.DeleteUser(ctx, winner.ID); err != nil {
		t.Fatalf("уборка winner: %v", err)
	}
	winnerAlive = false
}

// TestContractMergeTelegramIDUniqueness проверяет, разводит ли панель профили
// по telegramId. На 3.3.2 — НЕ разводит: дубль принимается. Именно поэтому
// merge обязан удалять профиль проигравшего ДО патча победителя, иначе поиск
// клиента по telegram_id стал бы неоднозначным.
func TestContractMergeTelegramIDUniqueness(t *testing.T) {
	c := contractClient(t)
	ctx := context.Background()

	stamp := time.Now().UnixNano()
	telegramA := stamp%1_000_000_000 + 910_000_000_000
	telegramB := telegramA + 1
	expire := time.Now().UTC().AddDate(0, 0, 30)

	mk := func(customerID, telegramID int64) *User {
		t.Helper()
		tl := int64(0)
		var resp apiResponse[User]
		err := c.doJSON(ctx, http.MethodPost, "/api/users", &CreateUserRequest{
			Username:             generateUsername(customerID, telegramID),
			ExpireAt:             expire,
			Status:               "ACTIVE",
			TrafficLimitBytes:    &tl,
			TrafficLimitStrategy: "MONTH",
			TelegramID:           &telegramID,
		}, &resp)
		if err != nil {
			t.Fatalf("создание профиля: %v", err)
		}
		return &resp.Response
	}

	a := mk(stamp%100000, telegramA)
	defer func() { _ = c.DeleteUser(ctx, a.ID) }()
	b := mk(stamp%100000+1, telegramB)
	defer func() { _ = c.DeleteUser(ctx, b.ID) }()

	_, err := c.PatchUser(ctx, &UpdateUserRequest{ID: &b.ID, TelegramID: &telegramA})
	if err != nil {
		t.Logf("панель запретила дублировать telegramId (ожидаемо): %v", err)
		return
	}
	// Панель разрешила дубль — тогда поиск по telegram_id становится
	// неоднозначным, и merge обязан продолжать удалять проигравшего первым.
	found, ferr := c.getUsersByTelegramID(ctx, telegramA)
	if ferr != nil {
		t.Fatalf("stream по telegramId: %v", ferr)
	}
	if len(found) > 1 {
		t.Logf("ВНИМАНИЕ: панель допускает %d профилей с одним telegramId — "+
			"порядок «сначала удалить проигравшего» в merge обязателен", len(found))
	}
}
