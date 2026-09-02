package heleket

import (
	"sync"
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/database"
)

func strptr(s string) *string { return &s }

func TestMatchPaymentToPurchase(t *testing.T) {
	base := func() *database.Purchase {
		return &database.Purchase{
			ID:        42,
			Amount:    500,
			Currency:  "RUB",
			HeleketID: strptr("uuid-42"),
		}
	}

	t.Run("совпадает", func(t *testing.T) {
		got := matchPaymentToPurchase(base(), &Payment{UUID: "uuid-42", Amount: "500.00", Currency: "RUB"})
		if got != "" {
			t.Fatalf("ожидалось совпадение, получено: %s", got)
		}
	})

	t.Run("переплата допустима", func(t *testing.T) {
		if got := matchPaymentToPurchase(base(), &Payment{UUID: "uuid-42", Amount: "600.00", Currency: "RUB"}); got != "" {
			t.Fatalf("переплата должна проходить, получено: %s", got)
		}
	})

	t.Run("копеечная погрешность допустима", func(t *testing.T) {
		if got := matchPaymentToPurchase(base(), &Payment{UUID: "uuid-42", Amount: "499.995", Currency: "RUB"}); got != "" {
			t.Fatalf("округление не должно ломать сверку, получено: %s", got)
		}
	})

	t.Run("чужой uuid", func(t *testing.T) {
		if matchPaymentToPurchase(base(), &Payment{UUID: "uuid-999", Amount: "500.00", Currency: "RUB"}) == "" {
			t.Fatal("платёж с чужим uuid не должен проходить")
		}
	})

	t.Run("недоплата", func(t *testing.T) {
		if matchPaymentToPurchase(base(), &Payment{UUID: "uuid-42", Amount: "100.00", Currency: "RUB"}) == "" {
			t.Fatal("недоплата не должна проходить")
		}
	})

	t.Run("другая валюта", func(t *testing.T) {
		if matchPaymentToPurchase(base(), &Payment{UUID: "uuid-42", Amount: "500.00", Currency: "USD"}) == "" {
			t.Fatal("платёж в другой валюте не должен проходить")
		}
	})

	t.Run("нечитаемая сумма", func(t *testing.T) {
		if matchPaymentToPurchase(base(), &Payment{UUID: "uuid-42", Amount: "много", Currency: "RUB"}) == "" {
			t.Fatal("нечитаемая сумма не должна проходить")
		}
	})

	t.Run("uuid ещё не записан — сверяем остальное", func(t *testing.T) {
		p := base()
		p.HeleketID = nil
		if got := matchPaymentToPurchase(p, &Payment{UUID: "uuid-42", Amount: "500.00", Currency: "RUB"}); got != "" {
			t.Fatalf("без сохранённого uuid сверка суммы должна проходить, получено: %s", got)
		}
		if matchPaymentToPurchase(p, &Payment{UUID: "uuid-42", Amount: "1.00", Currency: "RUB"}) == "" {
			t.Fatal("без сохранённого uuid недоплата всё равно должна отсекаться")
		}
	})
}

// TestKeyedMutexSerializes проверяет, что обработку одной покупки нельзя
// выполнить параллельно — именно это защищает от двойного зачисления, когда
// вебхук и поллинг видят один и тот же оплаченный счёт одновременно.
func TestKeyedMutexSerializes(t *testing.T) {
	var k keyedMutex
	var mu sync.Mutex
	inside, maxInside := 0, 0

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			unlock := k.lock(1)
			defer unlock()

			mu.Lock()
			inside++
			if inside > maxInside {
				maxInside = inside
			}
			mu.Unlock()

			time.Sleep(time.Millisecond)

			mu.Lock()
			inside--
			mu.Unlock()
		}()
	}
	wg.Wait()

	if maxInside != 1 {
		t.Fatalf("одновременно внутри критической секции было %d горутин, ожидалась 1", maxInside)
	}
	if len(k.m) != 0 {
		t.Fatalf("карта блокировок не очистилась: %d записей", len(k.m))
	}
}

// TestKeyedMutexDoesNotBlockOtherKeys — разные покупки не должны ждать друг друга.
func TestKeyedMutexDoesNotBlockOtherKeys(t *testing.T) {
	var k keyedMutex

	first := k.lock(1)
	defer first()

	done := make(chan struct{})
	go func() {
		unlock := k.lock(2)
		unlock()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("блокировка одной покупки задержала другую")
	}
}
