//go:build integration

package repository

// Запуск — как у session_integration_test.go:
//
//	CABINET_INTEGRATION_PG=postgres://user:pass@localhost:5432/dbname?sslmode=disable go test ./internal/cabinet/repository/... -tags=integration -count=1

import (
	"context"
	"errors"
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/utils"
)

// Живой access-JWT удалённого аккаунта доводит запрос до bootstrap'а, тот зовёт
// Create. Раньше это роняло FK и засоряло лог PostgreSQL; теперь — ErrAccountMissing.
func TestLinkCreate_deletedAccount_returnsErrAccountMissing(t *testing.T) {
	ctx := context.Background()
	pool := pgPoolIntegration(t)

	accRepo := NewAccountRepo(pool)
	acc, err := accRepo.Create(ctx, "cabinet-int-link-"+time.Now().Format("150405.000")+"@example.com", "", "ru")
	if err != nil {
		t.Fatalf("create account: %v", err)
	}

	custRepo := database.NewCustomerRepository(pool)
	cust, err := custRepo.CreateWebOnly(ctx, utils.SyntheticTelegramID(acc.ID), "ru")
	if err != nil {
		t.Fatalf("create web-only customer: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM customer WHERE id = $1`, cust.ID)
	})

	if _, err := pool.Exec(ctx, `DELETE FROM cabinet_account WHERE id = $1`, acc.ID); err != nil {
		t.Fatalf("delete account: %v", err)
	}

	linkRepo := NewAccountCustomerLinkRepo(pool)
	if _, err := linkRepo.Create(ctx, acc.ID, cust.ID, LinkStatusLinked); !errors.Is(err, ErrAccountMissing) {
		t.Fatalf("create link for deleted account: want ErrAccountMissing, got %v", err)
	}

	alive, err := accRepo.Exists(ctx, acc.ID)
	if err != nil {
		t.Fatalf("exists: %v", err)
	}
	if alive {
		t.Fatal("Exists returned true for deleted account")
	}
}
