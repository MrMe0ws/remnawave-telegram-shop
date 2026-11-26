package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

func TestAddMonthsClamped(t *testing.T) {
	cases := []struct {
		in     string
		months int
		want   string
	}{
		{"2026-01-31", 1, "2026-02-28"},
		{"2028-01-31", 1, "2028-02-29"},
		{"2026-11-24", 1, "2026-12-24"},
		{"2026-11-30", 3, "2027-02-28"},
		{"2026-08-31", 6, "2027-02-28"},
		{"2026-12-15", 12, "2027-12-15"},
		{"2026-12-24", -1, "2026-11-24"},
	}
	for _, c := range cases {
		in, _ := time.ParseInLocation("2006-01-02", c.in, infraTZ)
		got := addMonthsClamped(in.UTC(), c.months).In(infraTZ).Format("2006-01-02")
		if got != c.want {
			t.Errorf("%s +%d = %s, want %s", c.in, c.months, got, c.want)
		}
	}
}

func TestFindCreatedInfraRecord(t *testing.T) {
	prov, other := uuid.New(), uuid.New()
	at := time.Date(2026, 11, 26, 9, 0, 0, 0, time.UTC)
	linked, fresh := uuid.New(), uuid.New()
	recs := []remnawave.InfraBillingHistoryRecord{
		{UUID: uuid.New(), ProviderUUID: other, Amount: 5, BilledAt: at},
		{UUID: linked, ProviderUUID: prov, Amount: 5, BilledAt: at},
		{UUID: uuid.New(), ProviderUUID: prov, Amount: 6, BilledAt: at},
		{UUID: fresh, ProviderUUID: prov, Amount: 5, BilledAt: at.Add(time.Second)},
	}
	got, ok := findCreatedInfraRecord(recs, prov, 5, at, map[uuid.UUID]bool{linked: true})
	if !ok || got != fresh {
		t.Fatalf("got %v %v, want %v (уже привязанную запись брать нельзя)", got, ok, fresh)
	}
	if _, ok := findCreatedInfraRecord(recs, prov, 7, at, nil); ok {
		t.Fatal("сумма не совпала — запись не должна находиться")
	}
}

func TestBuildInfraOverview(t *testing.T) {
	provSolo, provMulti := uuid.New(), uuid.New()
	nSolo, nA, nB := uuid.New(), uuid.New(), uuid.New()
	now := time.Date(2026, 11, 26, 12, 0, 0, 0, infraTZ)
	nodes := &remnawave.InfraBillingNodesBody{BillingNodes: []remnawave.InfraBillingBillingNode{
		{UUID: uuid.New(), NodeUUID: nSolo, ProviderUUID: provSolo},
		{UUID: uuid.New(), NodeUUID: nA, ProviderUUID: provMulti},
		{UUID: uuid.New(), NodeUUID: nB, ProviderUUID: provMulti},
	}}
	h1, h2, h3 := uuid.New(), uuid.New(), uuid.New()
	history := []remnawave.InfraBillingHistoryRecord{
		{UUID: h1, ProviderUUID: provSolo, Amount: 4.5, BilledAt: time.Date(2026, 11, 2, 10, 0, 0, 0, infraTZ)},
		{UUID: h2, ProviderUUID: provMulti, Amount: 7, BilledAt: time.Date(2026, 10, 7, 10, 0, 0, 0, infraTZ)},
		{UUID: h3, ProviderUUID: provSolo, Amount: 4.5, BilledAt: time.Date(2026, 5, 2, 10, 0, 0, 0, infraTZ)}, // старше окна
	}
	price := 3.5
	meta := map[uuid.UUID]database.InfraNodeMeta{nA: {NodeUUID: nA, Price: &price, PeriodMonths: 3}}
	links := map[uuid.UUID][]database.InfraPaymentNode{h2: {
		{HistoryUUID: h2, NodeUUID: nA, NodeName: "A", Amount: &price},
		{HistoryUUID: h2, NodeUUID: nB, NodeName: "B", Amount: &price},
	}}

	out := buildInfraOverview(nodes, history, 3, meta, links, now)

	if m := out.Meta[nSolo.String()]; m.PriceSource != "guess" || m.Price == nil || *m.Price != 4.5 || m.LastPaidAt == nil {
		t.Errorf("одиночная нода: цена угадывается по последней оплате провайдера, got %+v", m)
	}
	if m := out.Meta[nA.String()]; m.PriceSource != "set" || *m.Price != 3.5 || m.PeriodMonths != 3 {
		t.Errorf("заданная цена/период: got %+v", m)
	}
	if m := out.Meta[nB.String()]; m.PriceSource != "guess" || *m.Price != 3.5 || m.LastPaidAt == nil {
		t.Errorf("нода из общего счёта: цена из её доли, got %+v", m)
	}
	if len(out.Months) != 6 || out.Months[5].Month != "2026-11" || out.Months[5].Total != 4.5 || out.Months[4].Total != 7 || out.Months[0].Month != "2026-06" {
		t.Errorf("месяцы: %+v", out.Months)
	}
	if len(out.Recent) != 3 || out.Recent[0].UUID != h1 || len(out.Recent[1].Nodes) != 2 {
		t.Errorf("последние оплаты: %+v", out.Recent)
	}
}

// ── оплата через фейковую панель ──

type fakeInfraStore struct {
	mu      sync.Mutex
	meta    map[uuid.UUID]database.InfraNodeMeta
	links   []database.InfraPaymentNode
	deleted []uuid.UUID
}

func (f *fakeInfraStore) ListNodeMeta(context.Context) (map[uuid.UUID]database.InfraNodeMeta, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := map[uuid.UUID]database.InfraNodeMeta{}
	for k, v := range f.meta {
		out[k] = v
	}
	return out, nil
}
func (f *fakeInfraStore) UpsertNodeMeta(_ context.Context, id uuid.UUID, price *float64, period int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.meta == nil {
		f.meta = map[uuid.UUID]database.InfraNodeMeta{}
	}
	f.meta[id] = database.InfraNodeMeta{NodeUUID: id, Price: price, PeriodMonths: period}
	return nil
}
func (f *fakeInfraStore) InsertPaymentNodes(_ context.Context, items []database.InfraPaymentNode) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.links = append(f.links, items...)
	return nil
}
func (f *fakeInfraStore) ListPaymentNodes(context.Context) (map[uuid.UUID][]database.InfraPaymentNode, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := map[uuid.UUID][]database.InfraPaymentNode{}
	for _, l := range f.links {
		out[l.HistoryUUID] = append(out[l.HistoryUUID], l)
	}
	return out, nil
}
func (f *fakeInfraStore) DeletePaymentNodes(_ context.Context, id uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleted = append(f.deleted, id)
	return nil
}

type fakeInfraPanel struct {
	mu          sync.Mutex
	prov        uuid.UUID
	billing     []uuid.UUID
	nodeUUIDs   []uuid.UUID
	dates       map[uuid.UUID]time.Time
	failPatchOn uuid.UUID
	created     []remnawave.InfraBillingHistoryRecord
	deletedHist []string
}

func (p *fakeInfraPanel) handler(t *testing.T) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p.mu.Lock()
		defer p.mu.Unlock()
		switch {
		case r.URL.Path == "/api/infra-billing/nodes" && r.Method == http.MethodGet:
			var nodes []remnawave.InfraBillingBillingNode
			for i, id := range p.billing {
				nodes = append(nodes, remnawave.InfraBillingBillingNode{UUID: id, NodeUUID: p.nodeUUIDs[i], ProviderUUID: p.prov, NextBillingAt: p.dates[id],
					Node: remnawave.InfraBillingNodeShort{UUID: p.nodeUUIDs[i], Name: "node", CountryCode: "DE"}})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"response": remnawave.InfraBillingNodesBody{BillingNodes: nodes}})
		case r.URL.Path == "/api/infra-billing/nodes" && r.Method == http.MethodPatch:
			var req remnawave.UpdateInfraBillingNodeRequest
			_ = json.NewDecoder(r.Body).Decode(&req)
			if req.UUIDs[0] == p.failPatchOn {
				http.Error(w, "boom", http.StatusInternalServerError)
				return
			}
			p.dates[req.UUIDs[0]] = req.NextBillingAt
			_, _ = io.WriteString(w, `{"response":{}}`)
		case r.URL.Path == "/api/infra-billing/history" && r.Method == http.MethodPost:
			var req remnawave.CreateInfraBillingHistoryRequest
			_ = json.NewDecoder(r.Body).Decode(&req)
			rec := remnawave.InfraBillingHistoryRecord{UUID: uuid.New(), ProviderUUID: req.ProviderUUID, Amount: req.Amount, BilledAt: req.BilledAt}
			p.created = append(p.created, rec)
			_ = json.NewEncoder(w).Encode(map[string]any{"response": remnawave.InfraBillingHistoryBody{Records: p.created, Total: len(p.created)}})
		case strings.HasPrefix(r.URL.Path, "/api/infra-billing/history/") && r.Method == http.MethodDelete:
			p.deletedHist = append(p.deletedHist, strings.TrimPrefix(r.URL.Path, "/api/infra-billing/history/"))
			w.WriteHeader(http.StatusNoContent)
		default:
			t.Errorf("неожиданный запрос %s %s", r.Method, r.URL.Path)
			http.NotFound(w, r)
		}
	})
}

func newPayFixture(t *testing.T) (*AdminInfraHandler, *fakeInfraPanel, *fakeInfraStore) {
	t.Helper()
	p := &fakeInfraPanel{prov: uuid.New(), dates: map[uuid.UUID]time.Time{}}
	for i := 0; i < 2; i++ {
		id := uuid.New()
		p.billing = append(p.billing, id)
		p.nodeUUIDs = append(p.nodeUUIDs, uuid.New())
		d, _ := time.ParseInLocation("2006-01-02", []string{"2026-11-30", "2026-12-07"}[i], infraTZ)
		p.dates[id] = d.UTC()
	}
	srv := httptest.NewServer(p.handler(t))
	t.Cleanup(srv.Close)
	store := &fakeInfraStore{}
	h := &AdminInfraHandler{rw: remnawave.NewClient(srv.URL, "t", "remote"), meta: store}
	return h, p, store
}

func doPay(h *AdminInfraHandler, body any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/cabinet/api/admin/infra/pay", strings.NewReader(string(b)))
	rec := httptest.NewRecorder()
	h.Pay(rec, req)
	return rec
}

func TestInfraPay_ShiftsDatesAndLinksNodes(t *testing.T) {
	h, p, store := newPayFixture(t)
	rec := doPay(h, map[string]any{
		"provider_uuid": p.prov.String(), "amount": 7, "billed_at": "2026-11-26", "period_months": 3,
		"nodes": []map[string]any{{"billing_uuid": p.billing[0].String(), "price": 3.5}, {"billing_uuid": p.billing[1].String(), "price": 3.5}},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var resp infraPayResp
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.HistoryUUID == nil || *resp.HistoryUUID != p.created[0].UUID {
		t.Fatalf("historyUuid = %v, want %v", resp.HistoryUUID, p.created[0].UUID)
	}
	if got := p.dates[p.billing[0]].In(infraTZ).Format("2006-01-02"); got != "2027-02-28" {
		t.Errorf("30.11 + 3 мес = %s, want 2027-02-28", got)
	}
	if got := p.dates[p.billing[1]].In(infraTZ).Format("2006-01-02"); got != "2027-03-07" {
		t.Errorf("07.12 + 3 мес = %s", got)
	}
	if len(store.links) != 2 || store.links[0].HistoryUUID != *resp.HistoryUUID {
		t.Errorf("привязки нод: %+v", store.links)
	}
	if m := store.meta[p.nodeUUIDs[0]]; m.Price == nil || *m.Price != 3.5 || m.PeriodMonths != 3 {
		t.Errorf("цена/период не запомнились: %+v", m)
	}
}

func TestInfraPay_RollsBackOnPatchFailure(t *testing.T) {
	h, p, store := newPayFixture(t)
	before := p.dates[p.billing[0]]
	p.failPatchOn = p.billing[1]
	rec := doPay(h, map[string]any{
		"provider_uuid": p.prov.String(), "amount": 7, "billed_at": "2026-11-26", "period_months": 1,
		"nodes": []map[string]any{{"billing_uuid": p.billing[0].String()}, {"billing_uuid": p.billing[1].String()}},
	})
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status %d, want 502", rec.Code)
	}
	if !p.dates[p.billing[0]].Equal(before) {
		t.Errorf("дата первой ноды не вернулась: %v", p.dates[p.billing[0]])
	}
	if len(p.deletedHist) != 1 || p.deletedHist[0] != p.created[0].UUID.String() {
		t.Errorf("запись истории не удалена: %v", p.deletedHist)
	}
	if len(store.links) != 0 {
		t.Errorf("привязки не должны сохраниться: %+v", store.links)
	}
}

func TestInfraPay_Validation(t *testing.T) {
	h, p, _ := newPayFixture(t)
	ok := map[string]any{"provider_uuid": p.prov.String(), "amount": 5, "billed_at": "2026-11-26", "period_months": 1,
		"nodes": []map[string]any{{"billing_uuid": p.billing[0].String()}}}
	cases := map[string]func(m map[string]any){
		"чужой провайдер":  func(m map[string]any) { m["provider_uuid"] = uuid.New().String() },
		"нулевая сумма":    func(m map[string]any) { m["amount"] = 0 },
		"период 0":         func(m map[string]any) { m["period_months"] = 0 },
		"дата не парсится": func(m map[string]any) { m["billed_at"] = "вчера" },
		"неизвестная нода": func(m map[string]any) { m["nodes"] = []map[string]any{{"billing_uuid": uuid.New().String()}} },
	}
	for name, mut := range cases {
		t.Run(name, func(t *testing.T) {
			body := map[string]any{}
			for k, v := range ok {
				body[k] = v
			}
			mut(body)
			if rec := doPay(h, body); rec.Code < 400 {
				t.Fatalf("status %d, want ошибку", rec.Code)
			}
			if len(p.created) != 0 {
				t.Fatal("при ошибке валидации запись в панели создаваться не должна")
			}
		})
	}
}

func TestInfraPay_WithoutNodesOnlyRecordsHistory(t *testing.T) {
	h, p, store := newPayFixture(t)
	before := p.dates[p.billing[0]]
	rec := doPay(h, map[string]any{"provider_uuid": p.prov.String(), "amount": 12, "billed_at": "2026-11-26", "period_months": 1, "nodes": []any{}})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if len(p.created) != 1 || !p.dates[p.billing[0]].Equal(before) || len(store.links) != 0 {
		t.Fatalf("ожидалась только запись истории: created=%d links=%d", len(p.created), len(store.links))
	}
}

func TestInfraPayUndo(t *testing.T) {
	h, p, store := newPayFixture(t)
	hid := uuid.New()
	body := `{"history_uuid":"` + hid.String() + `","nodes":[{"billing_uuid":"` + p.billing[0].String() + `","next_billing_at":"2026-11-30T00:00:00+03:00"}]}`
	p.dates[p.billing[0]] = time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC)
	req := httptest.NewRequest(http.MethodPost, "/cabinet/api/admin/infra/pay/undo", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.PayUndo(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if got := p.dates[p.billing[0]].In(infraTZ).Format("2006-01-02"); got != "2026-11-30" {
		t.Errorf("дата не вернулась: %s", got)
	}
	if len(p.deletedHist) != 1 || len(store.deleted) != 1 || store.deleted[0] != hid {
		t.Errorf("история/привязки не удалены: %v %v", p.deletedHist, store.deleted)
	}
}
