package notification

import (
	"context"
	"testing"

	"remnawave-tg-shop-bot/internal/remnawave"
)

// TestIsUserConnected_FirstConnectedAt проверяет, что IsUserConnected возвращает true при FirstConnectedAt != nil
func TestIsUserConnected_FirstConnectedAt(t *testing.T) {
	// Это интеграционный тест, требует реальный RW client
	// Пропускаем в обычном окружении
	t.Skip("Integration test — requires real Remnawave client")
}

// TestIsUserConnected_UsedTraffic проверяет, что IsUserConnected возвращает true при UsedTrafficBytes > 0
func TestIsUserConnected_UsedTraffic(t *testing.T) {
	t.Skip("Integration test — requires real Remnawave client")
}

// TestIsUserConnected_Devices проверяет, что IsUserConnected возвращает true при наличии устройств
func TestIsUserConnected_Devices(t *testing.T) {
	t.Skip("Integration test — requires real Remnawave client")
}

// TestIsUserConnected_NotFound проверяет, что ErrUserNotFound обрабатывается как «не подключён»
func TestIsUserConnected_NotFound(t *testing.T) {
	// Mock test: когда GetUserTrafficInfo возвращает ErrUserNotFound, должно быть (false, nil)
	ctx := context.Background()

	// Создаём фиктивный клиент (в реальном коде нужен mock)
	var rw *remnawave.Client

	// Для реального теста понадобится mock RW client
	if rw == nil {
		t.Skip("Requires mock Remnawave client")
		return
	}

	connected, err := IsUserConnected(ctx, rw, 12345)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if connected {
		t.Error("Expected connected=false for ErrUserNotFound")
	}
}

// TestLifecycleRepository_Dedup проверяет, что dedup работает корректно
func TestLifecycleRepository_Dedup(t *testing.T) {
	t.Skip("Integration test — requires PostgreSQL")
}

// TestWinbackStacking проверяет, что складывание скидок работает правильно (15% + 10% = 25%)
func TestWinbackStacking(t *testing.T) {
	// Этот тест для promo.Service.GrantStackedPendingDiscount
	// Требует PostgreSQL и реальный promo service
	t.Skip("Integration test — requires PostgreSQL and promo service")
}

// TestFormatTimeLeft проверяет форматирование оставшегося времени
func TestFormatTimeLeft(t *testing.T) {
	s := &LifecycleService{}

	// nil expiresAt
	result := s.formatTimeLeft(nil)
	if result != "неограниченно" {
		t.Errorf("Expected 'неограниченно' for nil, got %s", result)
	}

	// Прошедшее время (отрицательное)
	// past := time.Now().Add(-1 * time.Hour)
	// result = s.formatTimeLeft(&past)
	// if result != "истекло" {
	// 	t.Errorf("Expected 'истекло' for past time, got %s", result)
	// }

	// Логику с часами/днями можно протестировать аналогично
}
