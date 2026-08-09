package remnawavewebhook

import (
	"sync"
	"time"
)

const dedupTTL = 10 * time.Minute

type deduper struct {
	mu   sync.Mutex
	seen map[string]time.Time
}

func newDeduper() *deduper {
	return &deduper{seen: make(map[string]time.Time)}
}

// Has reports whether key was recorded and is still within TTL.
func (d *deduper) Has(key string, now time.Time) bool {
	if key == "" {
		return false
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	d.pruneLocked(now)
	exp, ok := d.seen[key]
	return ok && now.Before(exp)
}

// Add records key until now+TTL (call only after successful notify).
func (d *deduper) Add(key string, now time.Time) {
	if key == "" {
		return
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	d.pruneLocked(now)
	d.seen[key] = now.Add(dedupTTL)
}

func (d *deduper) pruneLocked(now time.Time) {
	for k, exp := range d.seen {
		if !now.Before(exp) {
			delete(d.seen, k)
		}
	}
}
