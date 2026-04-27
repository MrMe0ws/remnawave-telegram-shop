// Package ratelimit — простой in-memory token-bucket rate-limiter по ключу.
//
// Используется для дешёвой защиты от brute-force на auth-эндпоинты. MVP — один
// процесс, Redis не нужен. Когда появится вторая реплика, этот код можно
// заменить Redis-backed без изменения интерфейса Limiter.
//
// Ключи должны включать префикс эндпоинта, чтобы лимиты на login и register
// не делили bucket. Конкретные параметры — в cabinet/config.RateLimitRules().
package ratelimit

import (
	"context"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// Rule задаёт лимит «N запросов в T».
//
// Для наглядности задаём в формате Count/Interval, а в rate.Limiter внутрь
// уходит rate.Every(Interval/Count) и burst=Count.
type Rule struct {
	Count    int
	Interval time.Duration
}

// Limiter — thread-safe менеджер token-bucket'ов по строковому ключу.
type Limiter struct {
	mu       sync.Mutex
	buckets  map[string]*entry
	rule     Rule
	lifetime time.Duration // после какого простоя бакет удаляется GC
}

type entry struct {
	lim      *rate.Limiter
	lastSeen time.Time
}

// New создаёт лимитер с единым правилом для всех ключей. Если нужны разные
// правила — создавайте отдельные инстансы Limiter (по одному на route).
func New(rule Rule) *Limiter {
	l := &Limiter{
		buckets:  make(map[string]*entry),
		rule:     rule,
		lifetime: 10 * rule.Interval,
	}
	if l.lifetime < time.Minute {
		l.lifetime = time.Minute
	}
	return l
}

// Allow возвращает true, если запрос с данным ключом разрешён прямо сейчас.
// Не блокирует — мы хотим быстро дать 429, а не заставить пользователя ждать.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	e, ok := l.buckets[key]
	if !ok {
		e = &entry{
			lim: rate.NewLimiter(rate.Every(l.rule.Interval/time.Duration(max(l.rule.Count, 1))), l.rule.Count),
		}
		l.buckets[key] = e
	}
	e.lastSeen = time.Now()
	return e.lim.Allow()
}

// RunGC запускает фоновую горутину, которая периодически удаляет бакеты, не
// использовавшиеся больше lifetime. Вызывайте один раз при инициализации.
func (l *Limiter) RunGC(ctx context.Context) {
	go func() {
		t := time.NewTicker(l.lifetime / 2)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				l.gc()
			}
		}
	}()
}

func (l *Limiter) gc() {
	l.mu.Lock()
	defer l.mu.Unlock()
	cutoff := time.Now().Add(-l.lifetime)
	for k, e := range l.buckets {
		if e.lastSeen.Before(cutoff) {
			delete(l.buckets, k)
		}
	}
}
