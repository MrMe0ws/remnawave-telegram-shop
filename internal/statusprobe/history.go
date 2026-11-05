package statusprobe

import (
	"context"
	"encoding/json"
	"strings"
	"time"
)

// historyKey — журнал замеров в таблице ключ-значение. Ключ новый: прежний журнал считал
// сутки одной записью, а теперь запись — один замер; старые данные не переносим.
const historyKey = "status_probe_runs"
const latestKey = "status_probe_latest"

// historyRuns — сколько последних замеров показывает полоска: один столбик — один замер.
const historyRuns = 30

// RunRecord — итог одного замера строки: сколько зондов ответило из мира и из России.
// Хранится только счётчик успехов, без адресов.
type RunRecord struct {
	At          time.Time `json:"at"`
	WorldOK     int       `json:"wOk"`
	WorldTotal  int       `json:"wN"`
	RussiaOK    int       `json:"rOk"`
	RussiaTotal int       `json:"rN"`
}

// HistoryStore читает и пишет журнал замеров. Реализация на bot_runtime_settings
// не требует новой таблицы.
type HistoryStore interface {
	Load(ctx context.Context) (map[string][]RunRecord, error)
	Save(ctx context.Context, runs map[string][]RunRecord) error
}

type kvStore interface {
	GetAll(ctx context.Context) (map[string]string, error)
	UpsertBatch(ctx context.Context, settings map[string]string, updatedBy *int64) error
}

// KVHistory — журнал в существующей таблице ключ-значение.
type KVHistory struct {
	repo kvStore
}

func NewKVHistory(repo kvStore) *KVHistory {
	return &KVHistory{repo: repo}
}

func (h *KVHistory) Load(ctx context.Context) (map[string][]RunRecord, error) {
	if h == nil || h.repo == nil {
		return map[string][]RunRecord{}, nil
	}
	all, err := h.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	raw := all[historyKey]
	if raw == "" {
		return map[string][]RunRecord{}, nil
	}
	var parsed map[string][]RunRecord
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	if parsed == nil {
		parsed = map[string][]RunRecord{}
	}
	return parsed, nil
}

type persistedSample struct {
	WorldPingMs     *int       `json:"world_ping_ms,omitempty"`
	WorldOK         int        `json:"world_ok"`
	WorldTotal      int        `json:"world_total"`
	RussiaOK        int        `json:"russia_ok"`
	RussiaTotal     int        `json:"russia_total"`
	WhitelistOK     int        `json:"whitelist_ok,omitempty"`
	WhitelistTotal  int        `json:"whitelist_total,omitempty"`
	WhitelistPingMs *int       `json:"whitelist_ping_ms,omitempty"`
	WhitelistAt     time.Time  `json:"whitelist_at,omitempty"`
	WhitelistDone   bool       `json:"whitelist_done,omitempty"`
	MeasuredAt      time.Time  `json:"measured_at"`
	Probes          []ProbeHit `json:"probes,omitempty"`
	FailStreak      int        `json:"fail_streak,omitempty"`
}

func (h *KVHistory) LoadLatest(ctx context.Context) (map[string]Sample, error) {
	if h == nil || h.repo == nil {
		return map[string]Sample{}, nil
	}
	all, err := h.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	raw := all[latestKey]
	if raw == "" {
		return map[string]Sample{}, nil
	}
	var parsed map[string]persistedSample
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	out := make(map[string]Sample, len(parsed))
	for key, item := range parsed {
		out[key] = Sample(item)
	}
	return out, nil
}

func (h *KVHistory) SaveLatest(ctx context.Context, samples map[string]Sample) error {
	if h == nil || h.repo == nil {
		return nil
	}
	// Дописываем к уже лежащему журналу. Иначе короткий замер после рестарта
	// затирал бы страны, которые в этот раз ещё не пинговались.
	existing, err := h.LoadLatest(ctx)
	if err != nil {
		return err
	}
	if existing == nil {
		existing = map[string]Sample{}
	}
	for key, sample := range samples {
		existing[key] = sample
	}
	payload := make(map[string]persistedSample, len(existing))
	for key, sample := range existing {
		payload[key] = persistedSample(sample)
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return h.repo.UpsertBatch(ctx, map[string]string{latestKey: string(raw)}, nil)
}

func (h *KVHistory) Save(ctx context.Context, runs map[string][]RunRecord) error {
	if h == nil || h.repo == nil {
		return nil
	}
	raw, err := json.Marshal(runs)
	if err != nil {
		return err
	}
	return h.repo.UpsertBatch(ctx, map[string]string{historyKey: string(raw)}, nil)
}

// NodeKey — старый ключ замера. Две строки с одной страной и названием
// попадали в один снимок, поэтому его больше не используют для новых целей.
func NodeKey(country, name string) string {
	return country + "\n" + name
}

// ProbeKey — свой замер у каждой строки списка. Страна и название не входят
// в ключ, если у строки есть id: две «Эстонии» или любые другие тёзки
// не делят пинг и белые списки. Без id строку отличает адрес.
func ProbeKey(id, country, name, address string) string {
	id = strings.TrimSpace(id)
	if id != "" {
		return "id:" + id
	}
	host, ok := PublicTarget(address)
	if !ok || host == "" {
		host = strings.TrimSpace(address)
	}
	return NodeKey(country, name) + "\n" + strings.ToLower(host)
}

// RecordRun дописывает итог замера и оставляет последние historyRuns записей.
func RecordRun(history map[string][]RunRecord, key string, sample Sample, now time.Time) {
	if history == nil {
		return
	}
	if sample.WorldTotal == 0 && sample.RussiaTotal == 0 {
		return
	}
	runs := append(history[key], RunRecord{
		At:          now.UTC(),
		WorldOK:     sample.WorldOK,
		WorldTotal:  sample.WorldTotal,
		RussiaOK:    sample.RussiaOK,
		RussiaTotal: sample.RussiaTotal,
	})
	if len(runs) > historyRuns {
		runs = append([]RunRecord(nil), runs[len(runs)-historyRuns:]...)
	}
	history[key] = runs
}

// Window возвращает historyRuns долей успешных проверок, от старых к новым: один замер — одна доля.
// Если замеров пока меньше, свободные места слева пустые (nil).
func Window(runs []RunRecord) []*float64 {
	out := make([]*float64, historyRuns)
	if len(runs) > historyRuns {
		runs = runs[len(runs)-historyRuns:]
	}
	offset := historyRuns - len(runs)
	for i, rec := range runs {
		total := rec.WorldTotal + rec.RussiaTotal
		if total == 0 {
			continue
		}
		v := float64(rec.WorldOK+rec.RussiaOK) / float64(total)
		out[offset+i] = &v
	}
	return out
}
