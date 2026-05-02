// Package linking — сервис link/merge Telegram ↔ web customer.
//
// Поток:
//  1. POST /link/telegram/start      → NonceStore генерит nonce (TTL 10 мин);
//     клиент передаёт nonce в Telegram Login Widget как параметр.
//  2. POST /link/telegram/confirm    → валидация Telegram payload + nonce;
//     ClaimStore сохраняет подтверждённый claim (TTL 30 мин).
//  3. POST /link/merge/preview       → dry-run merge по claim; ROLLBACK;
//     возвращает что изменится.
//  4. POST /link/merge/confirm       → реальный merge с Idempotency-Key.
package linking

import (
	"context"
	"sync"
	"time"
)

// ============================================================================
// NonceStore — одноразовые nonce для link/telegram/start (TTL 10 мин)
// ============================================================================

const nonceTTL = 10 * time.Minute

// NonceStore хранит nonce, привязанный к accountID.
// Одноразовый: Pop удаляет запись сразу.
type NonceStore struct {
	mu    sync.Mutex
	store map[int64]nonceRecord
}

type nonceRecord struct {
	nonce     string
	expiresAt time.Time
}

// NewNonceStore инициализирует пустое хранилище.
func NewNonceStore() *NonceStore { return &NonceStore{store: make(map[int64]nonceRecord)} }

// Save сохраняет nonce для accountID (перезаписывает предыдущий).
func (s *NonceStore) Save(accountID int64, nonce string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.store[accountID] = nonceRecord{nonce: nonce, expiresAt: time.Now().Add(nonceTTL)}
}

// Peek возвращает nonce без удаления. Нужен для validate в confirm.
func (s *NonceStore) Peek(accountID int64) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.store[accountID]
	if !ok || time.Now().After(r.expiresAt) {
		delete(s.store, accountID)
		return "", false
	}
	return r.nonce, true
}

// Consume удаляет nonce (вызывается после успешной проверки).
func (s *NonceStore) Consume(accountID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.store, accountID)
}

// RunGC запускает горутину-уборщик.
func (s *NonceStore) RunGC(ctx context.Context) {
	go gcLoop(ctx, time.Minute, func() {
		now := time.Now()
		s.mu.Lock()
		defer s.mu.Unlock()
		for k, v := range s.store {
			if now.After(v.expiresAt) {
				delete(s.store, k)
			}
		}
	})
}

// ============================================================================
// ClaimStore — подтверждённые Telegram claims (TTL 30 мин)
// ============================================================================

const claimTTL = 30 * time.Minute

// TelegramClaim — то, что хранится после успешного confirm.
type TelegramClaim struct {
	TelegramID       int64  // подтверждённый tg_id (или telegram_id «второго» customer при merge по email)
	TelegramUsername string // опционально
	CustomerTgID     *int64 // customer.id в БД, если уже существует; nil если новый
	// PeerAccountID — если >0, после merge удалить этот cabinet_account и перенести email+пароль на survivor.
	PeerAccountID int64
	ExpiresAt     time.Time
}

// ClaimStore хранит один claim на аккаунт (последний подтверждённый).
type ClaimStore struct {
	mu    sync.Mutex
	store map[int64]TelegramClaim
}

// NewClaimStore инициализирует хранилище.
func NewClaimStore() *ClaimStore { return &ClaimStore{store: make(map[int64]TelegramClaim)} }

// Save сохраняет/обновляет claim для accountID.
func (s *ClaimStore) Save(accountID int64, c TelegramClaim) {
	c.ExpiresAt = time.Now().Add(claimTTL)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.store[accountID] = c
}

// Get возвращает актуальный claim. ok=false если нет или просрочен.
func (s *ClaimStore) Get(accountID int64) (TelegramClaim, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.store[accountID]
	if !ok || time.Now().After(c.ExpiresAt) {
		delete(s.store, accountID)
		return TelegramClaim{}, false
	}
	return c, true
}

// Delete явно удаляет claim (после успешного merge).
func (s *ClaimStore) Delete(accountID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.store, accountID)
}

// RunGC запускает горутину-уборщик.
func (s *ClaimStore) RunGC(ctx context.Context) {
	go gcLoop(ctx, time.Minute, func() {
		now := time.Now()
		s.mu.Lock()
		defer s.mu.Unlock()
		for k, v := range s.store {
			if now.After(v.ExpiresAt) {
				delete(s.store, k)
			}
		}
	})
}

// ============================================================================
// Shared GC helper
// ============================================================================

func gcLoop(ctx context.Context, interval time.Duration, fn func()) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			fn()
		}
	}
}
