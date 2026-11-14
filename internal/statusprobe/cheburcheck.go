package statusprobe

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"remnawave-tg-shop-bot/internal/config"
)

// Cheburcheck как источник проверки «из России»: живые сканеры в российских сетях
// (домашние провайдеры и мобильные операторы) сообщают, режет ли сервер ТСПУ, SNI, DNS
// или диапазон CDN. Это детектор блокировок, а не пинг: живость сервера показывает панель,
// а здесь важно, доступен ли он жителям России.
//
// Источник выбирает админ (STATUS_RU_SOURCE): globalping, cheburcheck или auto. В auto
// основной Cheburcheck, а при 429, пропавшем ключе или устаревшем замере подхватывает Globalping.

// Источники «России».
const (
	SourceGlobalping  = "globalping"
	SourceCheburcheck = "cheburcheck"
	SourceAuto        = "auto"
)

var cheburcheckAPI = "https://cheburcheck.ru/api/v1"

const (
	// chebEvery — не чаще раза в полчаса на сервер: замер идёт ~16 секунд, а сервис чужой.
	chebEvery = 30 * time.Minute
	// chebRecheck — повтор после сбоя или находки: оповещение открывается по двум замерам подряд.
	chebRecheck = 10 * time.Minute
	// chebFresh — столько живёт замер Cheburcheck в режиме auto; потом «Россию» снова даёт Globalping.
	chebFresh = 3 * time.Hour
	// chebTokenPause — пауза, если сервис не принял ключ: перебор запросов ничего не изменит.
	chebTokenPause   = 6 * time.Hour
	chebProbeTimeout = 75 * time.Second
	chebUserAgent    = "meows-status-probe/1 (+cheburcheck)"
)

// chebHTTP без общего таймаута: поток событий идёт секунд пятнадцать, срок держит контекст.
var chebHTTP = &http.Client{}

var (
	errChebToken      = errors.New("cheburcheck: token rejected")
	errChebNoVerdicts = errors.New("cheburcheck: no scanner gave a verdict")
)

func cheburcheckToken() string { return strings.TrimSpace(os.Getenv("CHEBURCHECK_TOKEN")) }

// CheburcheckConfigured — задан ключ CHEBURCHECK_TOKEN. Сам ключ нигде не печатается.
func CheburcheckConfigured() bool { return cheburcheckToken() != "" }

// RussiaSourceMode — выбор админа. Пустое и неизвестное значение — auto.
func RussiaSourceMode() string {
	switch strings.ToLower(strings.TrimSpace(config.EffectiveEnv("STATUS_RU_SOURCE"))) {
	case SourceGlobalping:
		return SourceGlobalping
	case SourceCheburcheck:
		return SourceCheburcheck
	default:
		return SourceAuto
	}
}

// ruFromCheburcheck — берём ли «Россию» из Cheburcheck. Замера ещё нет — пока Globalping,
// иначе страница пустовала бы до первого прохода. В auto нужна свежесть и отсутствие паузы,
// в явном режиме Cheburcheck остаётся единственным источником.
func ruFromCheburcheck(mode string, configured, paused bool, chebAt, now time.Time) bool {
	if !configured || mode == SourceGlobalping || chebAt.IsZero() {
		return false
	}
	if mode == SourceCheburcheck {
		return true
	}
	return !paused && now.Sub(chebAt) <= chebFresh
}

// chebBlocked — вердикты сканера, которые значат «из этой сети сервер не открыть».
var chebBlocked = map[string]bool{
	"tspu_block":   true,
	"sni_block":    true,
	"dns_spoofing": true,
	"cdn_block":    true,
}

// chebVerdict — итог одного сканера. uncertain и пустой ответ не считаются ни тем, ни другим.
func chebVerdict(verdicts []string) (ok, blocked bool) {
	for _, v := range verdicts {
		v = strings.ToLower(strings.TrimSpace(v))
		if chebBlocked[v] {
			blocked = true
		}
		if v == "ok" {
			ok = true
		}
	}
	return ok && !blocked, blocked
}

// chebResult — итог одного прохода: Pass из Total сканеров открыли сервер.
type chebResult struct {
	Pass, Total int
	Hits        []ProbeHit
}

// chebMeasure подменяется в тестах.
var chebMeasure = measureCheburcheck

func chebError(resp *http.Response, what string) error {
	switch resp.StatusCode {
	case http.StatusTooManyRequests:
		return &RateLimitError{RetryAfter: retryAfter(resp.Header), Message: "cheburcheck"}
	case http.StatusUnauthorized:
		return errChebToken
	}
	return fmt.Errorf("cheburcheck %s: http %d", what, resp.StatusCode)
}

// chebCheckID берёт у /check подписанный id замера (живёт сутки, ключ не нужен).
func chebCheckID(ctx context.Context, host string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	q := url.Values{}
	q.Set("target", host)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cheburcheckAPI+"/check?"+q.Encode(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", chebUserAgent)
	resp, err := chebHTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", chebError(resp, "check")
	}
	var parsed struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&parsed); err != nil || parsed.ID == "" {
		return "", errors.New("cheburcheck check: no id")
	}
	return parsed.ID, nil
}

// measureCheburcheck гоняет сканеры по адресу и собирает вердикты из потока событий.
func measureCheburcheck(ctx context.Context, host string) (chebResult, error) {
	token := cheburcheckToken()
	if token == "" {
		return chebResult{}, errChebToken
	}
	id, err := chebCheckID(ctx, host)
	if err != nil {
		return chebResult{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, chebProbeTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cheburcheckAPI+"/probe/"+url.PathEscape(id), nil)
	if err != nil {
		return chebResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("User-Agent", chebUserAgent)
	resp, err := chebHTTP.Do(req)
	if err != nil {
		return chebResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return chebResult{}, chebError(resp, "probe")
	}
	res, readErr := readChebStream(io.LimitReader(resp.Body, 8<<20))
	// Оборванный поток с частью ответов годится: сканеры и так отвечают не все.
	if res.Total == 0 {
		if readErr != nil {
			return chebResult{}, readErr
		}
		return chebResult{}, errChebNoVerdicts
	}
	return res, nil
}

type chebScanner struct {
	ASN      string   `json:"asn"`
	Provider string   `json:"provider"`
	Region   string   `json:"region"`
	Verdicts []string `json:"verdicts"`
}

// readChebStream разбирает SSE: события result несут вердикты, done закрывает поток.
func readChebStream(r io.Reader) (chebResult, error) {
	var out chebResult
	br := bufio.NewReaderSize(r, 64<<10)
	event := ""
	var data strings.Builder
	flush := func() bool {
		defer func() { event = ""; data.Reset() }()
		switch event {
		case "done":
			return true
		case "result":
			var sc chebScanner
			if err := json.Unmarshal([]byte(data.String()), &sc); err != nil {
				return false
			}
			ok, blocked := chebVerdict(sc.Verdicts)
			if !ok && !blocked {
				return false
			}
			network := strings.TrimSpace(sc.Provider)
			if network == "" {
				network = strings.TrimSpace(sc.ASN)
			}
			out.Total++
			if ok {
				out.Pass++
			}
			out.Hits = append(out.Hits, ProbeHit{Country: "RU", City: strings.TrimSpace(sc.Region), Network: network, OK: ok})
		}
		return false
	}
	for {
		line, err := br.ReadString('\n')
		line = strings.TrimRight(line, "\r\n")
		switch {
		case strings.HasPrefix(line, "event:"):
			event = strings.TrimSpace(line[len("event:"):])
		case strings.HasPrefix(line, "data:"):
			if data.Len() > 0 {
				data.WriteByte('\n')
			}
			data.WriteString(strings.TrimSpace(line[len("data:"):]))
		case line == "":
			if flush() {
				return out, nil
			}
		}
		if err != nil {
			flush()
			if errors.Is(err, io.EOF) {
				return out, nil
			}
			return out, err
		}
	}
}

// CheburcheckCredits — остаток кредитов; кеш на 5 минут. Ноль значит «сервис кредитов не списывает
// или их нет»: по замеру на тестовом стенде проверки при нуле проходят, поэтому ноль не авария.
var (
	chebCreditsMu     sync.Mutex
	chebCreditsCached *int
	chebCreditsAt     time.Time
)

func FetchCheburcheckCredits(ctx context.Context) (*int, error) {
	token := cheburcheckToken()
	if token == "" {
		return nil, errChebToken
	}
	chebCreditsMu.Lock()
	if chebCreditsCached != nil && time.Since(chebCreditsAt) < 5*time.Minute {
		v := *chebCreditsCached
		chebCreditsMu.Unlock()
		return &v, nil
	}
	chebCreditsMu.Unlock()
	ctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cheburcheckAPI+"/credits", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", chebUserAgent)
	resp, err := chebHTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, chebError(resp, "credits")
	}
	var parsed struct {
		Credits *int `json:"credits"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&parsed); err != nil || parsed.Credits == nil {
		return nil, errors.New("cheburcheck credits: no value")
	}
	chebCreditsMu.Lock()
	v := *parsed.Credits
	chebCreditsCached, chebCreditsAt = &v, time.Now()
	chebCreditsMu.Unlock()
	return &v, nil
}

// applyCheburRU кладёт в замер «Россию» из Cheburcheck: счётчики и сканеры вместо зондов Globalping.
// Порядок зондов сохраняется: сначала мир, потом Россия, белые списки в конце.
func applyCheburRU(s Sample) Sample {
	world := make([]ProbeHit, 0, len(s.Probes))
	var wl []ProbeHit
	for _, hit := range s.Probes {
		switch {
		case hit.Kind == "whitelist":
			wl = append(wl, hit)
		case !strings.EqualFold(hit.Country, "RU"):
			world = append(world, hit)
		}
	}
	out := append(world, s.ChebHits...)
	s.Probes = append(out, wl...)
	s.RussiaOK, s.RussiaTotal = s.ChebPass, s.ChebTotal
	s.RuSource = SourceCheburcheck
	return s
}

// failedScanners — кто из сканеров Cheburcheck не открыл сервер: «провайдер (регион)», не больше n.
func failedScanners(s *Sample, n int) []string {
	var out []string
	for _, hit := range s.ChebHits {
		if hit.OK {
			continue
		}
		if len(out) == n {
			break
		}
		out = append(out, hitLabel(AlertRussia, hit))
	}
	return out
}

// ruFromCheburLocked — решает, откуда сейчас «Россия» у этого замера. Под r.mu.
func (r *Runner) ruFromCheburLocked(s Sample, now time.Time) bool {
	return ruFromCheburcheck(RussiaSourceMode(), CheburcheckConfigured(), now.Before(r.chebCooldownUntil), s.ChebAt, now)
}

// ActiveRussiaSource — кто сейчас даёт «Россию» вообще: для карточки в админке.
func (r *Runner) ActiveRussiaSource() string {
	mode := RussiaSourceMode()
	if !CheburcheckConfigured() || mode == SourceGlobalping {
		return SourceGlobalping
	}
	if mode == SourceCheburcheck {
		return SourceCheburcheck
	}
	if r != nil {
		r.mu.Lock()
		paused := time.Now().Before(r.chebCooldownUntil)
		r.mu.Unlock()
		if paused {
			return SourceGlobalping
		}
	}
	return SourceCheburcheck
}

// CheburcheckPause — до какого времени проходы стоят после 429 или отказа по ключу.
func (r *Runner) CheburcheckPause() (time.Time, string) {
	if r == nil {
		return time.Time{}, ""
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.chebCooldownUntil, r.chebPauseNote
}

func chebInterval(target Target) time.Duration {
	d := targetInterval(target)
	if d < chebEvery {
		d = chebEvery
	}
	return d
}

// chebDue — пора ли гонять сканеры для этой строки. Обход не проверяется: у него «Россия» — операторы.
func chebDue(target Target, s Sample, ok bool, now time.Time) bool {
	if !registryApplies(target) || !CheburcheckConfigured() || RussiaSourceMode() == SourceGlobalping {
		return false
	}
	if !ok || s.ChebTryAt.IsZero() {
		return true
	}
	wait := chebInterval(target)
	if !s.ChebOK || (s.ChebTotal-s.ChebPass >= RussiaFailThreshold() && s.RussiaFailStreak < alertStreak) {
		wait = chebRecheck
	}
	return now.Sub(s.ChebTryAt) >= wait
}

func (r *Runner) pickChebLocked(targets []Target, force bool) []Target {
	if len(targets) > maxNodes {
		targets = targets[:maxNodes]
	}
	now := time.Now()
	paused := now.Before(r.chebCooldownUntil)
	var out []Target
	for _, target := range targets {
		if !registryApplies(target) {
			continue
		}
		sample, ok := r.samples[target.Key]
		if force || (!paused && chebDue(target, sample, ok, now)) {
			out = append(out, target)
		}
	}
	return out
}

// kickCheburcheck запускает проход по строкам, у которых подошёл срок. Идёт отдельно от Globalping.
func (r *Runner) kickCheburcheck(targets []Target, force bool) {
	if r == nil || !ProbesEnabled() || !CheburcheckConfigured() || RussiaSourceMode() == SourceGlobalping {
		return
	}
	r.mu.Lock()
	if r.chebBusy {
		r.mu.Unlock()
		return
	}
	picks := r.pickChebLocked(targets, force)
	if len(picks) == 0 {
		r.mu.Unlock()
		return
	}
	r.chebBusy = true
	r.mu.Unlock()
	go func() {
		defer func() {
			r.mu.Lock()
			r.chebBusy = false
			r.mu.Unlock()
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
		defer cancel()
		r.EnsureLoaded(ctx)
		r.chebPass(ctx, picks)
	}()
}

func (r *Runner) chebPass(ctx context.Context, targets []Target) {
	var events []AlertEvent
	defer func() { r.emitAlerts(events) }()
	measured := 0
	for _, target := range targets {
		host, ok := PublicTarget(target.Address)
		if !ok {
			continue
		}
		if ctx.Err() != nil {
			return
		}
		res, err := chebMeasure(ctx, host)
		if err != nil {
			var limited *RateLimitError
			switch {
			case errors.As(err, &limited):
				wait := 15 * time.Minute
				if limited != nil && limited.RetryAfter > 0 {
					wait = limited.RetryAfter
				}
				r.pauseCheb(wait, "HTTP 429")
				slog.Warn("cheburcheck probe paused", "retry_in", wait.String())
				return
			case errors.Is(err, errChebToken):
				r.pauseCheb(chebTokenPause, "token rejected")
				slog.Warn("cheburcheck token rejected", "retry_in", chebTokenPause.String())
				return
			}
			slog.Warn("cheburcheck probe failed", "error", err)
			r.markChebFailed(target.Key)
			continue
		}
		r.storeCheburcheck(target.Key, res)
		r.mu.Lock()
		events = append(events, r.pingAlertsLocked(target, time.Now())...)
		r.mu.Unlock()
		r.persist()
		measured++
	}
	if measured > 0 {
		slog.Info("cheburcheck probes updated", "nodes", measured)
	}
}

func (r *Runner) pauseCheb(wait time.Duration, note string) {
	r.mu.Lock()
	r.chebCooldownUntil = time.Now().Add(wait)
	r.chebPauseNote = note
	r.mu.Unlock()
}

// markChebFailed запоминает попытку, прежний ответ не трогает: сбой сервиса не должен
// выглядеть ни блокировкой, ни «всё чисто».
func (r *Runner) markChebFailed(key string) {
	r.mu.Lock()
	s := r.samples[key]
	s.ChebTryAt = time.Now()
	s.ChebOK = false
	r.samples[key] = s
	r.mu.Unlock()
}

// storeCheburcheck записывает итог прохода. Если «Россию» сейчас даёт Cheburcheck, счётчики
// и серии сбоев из России двигаются здесь, а не в замере Globalping.
func (r *Runner) storeCheburcheck(key string, res chebResult) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s := r.samples[key]
	now := time.Now()
	s.ChebAt, s.ChebTryAt, s.ChebOK = now, now, true
	s.ChebPass, s.ChebTotal, s.ChebHits = res.Pass, res.Total, res.Hits
	if !r.ruFromCheburLocked(s, now) {
		r.samples[key] = s
		return
	}
	s = applyCheburRU(s)
	if s.RussiaTotal > 0 && s.RussiaTotal-s.RussiaOK >= RussiaFailThreshold() {
		s.RussiaFailStreak++
	} else {
		s.RussiaFailStreak = 0
	}
	if s.RussiaLow() {
		s.RussiaLowStreak++
	} else {
		s.RussiaLowStreak = 0
	}
	r.samples[key] = s
}
