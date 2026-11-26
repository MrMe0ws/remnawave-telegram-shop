package handlers

import (
	"context"
	"log/slog"
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/google/uuid"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

// infraMetaStore — то, что админка инфры хранит у себя поверх панели:
// цена и период ноды, и какие ноды покрыла запись истории оплат.
type infraMetaStore interface {
	ListNodeMeta(ctx context.Context) (map[uuid.UUID]database.InfraNodeMeta, error)
	UpsertNodeMeta(ctx context.Context, nodeUUID uuid.UUID, price *float64, periodMonths int) error
	InsertPaymentNodes(ctx context.Context, items []database.InfraPaymentNode) error
	ListPaymentNodes(ctx context.Context) (map[uuid.UUID][]database.InfraPaymentNode, error)
	DeletePaymentNodes(ctx context.Context, historyUUID uuid.UUID) error
}

const (
	infraHistoryPage     = 500 // максимум панели за запрос
	infraHistoryMaxPages = 20
	infraOverviewMonths  = 6
	infraRecentPayments  = 5
	infraMaxPeriodMonths = 24
	infraMaxPayNodes     = 50
	infraMaxAmount       = 1_000_000
)

// Даты оплат админ видит по Москве (как и parseFlexDate): сдвиг на месяц и
// разбивка по месяцам считаются в этой зоне, иначе 1-е число уезжало бы на 31-е.
var infraTZ = func() *time.Location {
	if loc, err := time.LoadLocation("Europe/Moscow"); err == nil {
		return loc
	}
	return time.FixedZone("MSK", 3*3600)
}()

// addMonthsClamped сдвигает дату на N месяцев, не перескакивая через короткий месяц:
// 31.01 + 1 мес = 28.02 (time.AddDate дал бы 03.03 и якорь оплаты бы поплыл).
func addMonthsClamped(t time.Time, months int) time.Time {
	lt := t.In(infraTZ)
	y, m, d := lt.Date()
	first := time.Date(y, m+time.Month(months), 1, lt.Hour(), lt.Minute(), lt.Second(), lt.Nanosecond(), infraTZ)
	if last := first.AddDate(0, 1, -1).Day(); d > last {
		d = last
	}
	return time.Date(first.Year(), first.Month(), d, lt.Hour(), lt.Minute(), lt.Second(), lt.Nanosecond(), infraTZ)
}

// loadAllInfraHistory читает историю оплат панели целиком (её немного: десятки записей в месяц).
func (h *AdminInfraHandler) loadAllInfraHistory(ctx context.Context) ([]remnawave.InfraBillingHistoryRecord, int, error) {
	var all []remnawave.InfraBillingHistoryRecord
	total := 0
	for page := 0; page < infraHistoryMaxPages; page++ {
		body, err := h.rw.GetInfraBillingHistory(ctx, page*infraHistoryPage, infraHistoryPage)
		if err != nil {
			return nil, 0, err
		}
		total = body.Total
		all = append(all, body.Records...)
		if len(body.Records) < infraHistoryPage || len(all) >= total {
			break
		}
	}
	return all, total, nil
}

type infraNodeMetaDTO struct {
	Price          *float64   `json:"price"`
	PeriodMonths   int        `json:"periodMonths"`
	PriceSource    string     `json:"priceSource"` // set — задана; guess — по последней оплате провайдера; none
	LastPaidAt     *time.Time `json:"lastPaidAt"`
	LastPaidAmount *float64   `json:"lastPaidAmount"`
}

type infraMonthDTO struct {
	Month string  `json:"month"` // 2026-11
	Total float64 `json:"total"`
	Count int     `json:"count"`
}

type infraPaymentNodeDTO struct {
	NodeUUID    uuid.UUID `json:"nodeUuid"`
	Name        string    `json:"name"`
	CountryCode string    `json:"countryCode"`
	Amount      *float64  `json:"amount"`
}

type infraHistoryItemDTO struct {
	remnawave.InfraBillingHistoryRecord
	Nodes []infraPaymentNodeDTO `json:"nodes"`
}

// infraOverviewDTO — всё для вкладки «Ноды» одним ответом: тело панели как есть плюс наше.
type infraOverviewDTO struct {
	*remnawave.InfraBillingNodesBody
	Meta         map[string]infraNodeMetaDTO `json:"meta"`
	Months       []infraMonthDTO             `json:"months"`
	Recent       []infraHistoryItemDTO       `json:"recent"`
	HistoryTotal int                         `json:"historyTotal"`
}

func linkDTOs(links []database.InfraPaymentNode) []infraPaymentNodeDTO {
	out := make([]infraPaymentNodeDTO, 0, len(links))
	for _, l := range links {
		out = append(out, infraPaymentNodeDTO{NodeUUID: l.NodeUUID, Name: l.NodeName, CountryCode: l.CountryCode, Amount: l.Amount})
	}
	return out
}

// buildInfraOverview — чистая сборка сводки (тестируется без панели и БД).
func buildInfraOverview(
	nodes *remnawave.InfraBillingNodesBody,
	history []remnawave.InfraBillingHistoryRecord,
	historyTotal int,
	meta map[uuid.UUID]database.InfraNodeMeta,
	links map[uuid.UUID][]database.InfraPaymentNode,
	now time.Time,
) infraOverviewDTO {
	sorted := append([]remnawave.InfraBillingHistoryRecord(nil), history...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].BilledAt.After(sorted[j].BilledAt) })

	// Сколько нод у провайдера: угадывать цену по оплате провайдера можно, только если нода у него одна.
	provNodes := map[uuid.UUID]int{}
	for _, n := range nodes.BillingNodes {
		provNodes[n.ProviderUUID]++
	}
	lastByProvider := map[uuid.UUID]remnawave.InfraBillingHistoryRecord{}
	lastByNode := map[uuid.UUID]infraNodeMetaDTO{}
	for _, rec := range sorted {
		if _, ok := lastByProvider[rec.ProviderUUID]; !ok {
			lastByProvider[rec.ProviderUUID] = rec
		}
		recLinks := links[rec.UUID]
		for _, l := range recLinks {
			if _, ok := lastByNode[l.NodeUUID]; ok {
				continue
			}
			at := rec.BilledAt
			amt := l.Amount
			if amt == nil && len(recLinks) == 1 {
				v := rec.Amount
				amt = &v
			}
			lastByNode[l.NodeUUID] = infraNodeMetaDTO{LastPaidAt: &at, LastPaidAmount: amt}
		}
	}

	out := infraOverviewDTO{
		InfraBillingNodesBody: nodes,
		Meta:                  make(map[string]infraNodeMetaDTO, len(nodes.BillingNodes)),
		HistoryTotal:          historyTotal,
	}
	for _, n := range nodes.BillingNodes {
		dto := infraNodeMetaDTO{PeriodMonths: 1, PriceSource: "none"}
		if m, ok := meta[n.NodeUUID]; ok {
			dto.PeriodMonths = m.PeriodMonths
			if m.Price != nil {
				p := *m.Price
				dto.Price = &p
				dto.PriceSource = "set"
			}
		}
		if last, ok := lastByNode[n.NodeUUID]; ok {
			dto.LastPaidAt, dto.LastPaidAmount = last.LastPaidAt, last.LastPaidAmount
		}
		if provNodes[n.ProviderUUID] == 1 {
			if rec, ok := lastByProvider[n.ProviderUUID]; ok {
				if dto.LastPaidAt == nil {
					at, amt := rec.BilledAt, rec.Amount
					dto.LastPaidAt, dto.LastPaidAmount = &at, &amt
				}
				if dto.Price == nil {
					p := rec.Amount
					dto.Price = &p
					dto.PriceSource = "guess"
				}
			}
		}
		if dto.Price == nil && dto.LastPaidAmount != nil {
			p := *dto.LastPaidAmount
			dto.Price = &p
			dto.PriceSource = "guess"
		}
		out.Meta[n.NodeUUID.String()] = dto
	}

	// Последние N месяцев, старые первыми; текущий — последний.
	cur := now.In(infraTZ)
	start := time.Date(cur.Year(), cur.Month(), 1, 0, 0, 0, 0, infraTZ).AddDate(0, -(infraOverviewMonths - 1), 0)
	idx := map[string]int{}
	for i := 0; i < infraOverviewMonths; i++ {
		key := start.AddDate(0, i, 0).Format("2006-01")
		idx[key] = i
		out.Months = append(out.Months, infraMonthDTO{Month: key})
	}
	for _, rec := range sorted {
		if i, ok := idx[rec.BilledAt.In(infraTZ).Format("2006-01")]; ok {
			out.Months[i].Total = math.Round((out.Months[i].Total+rec.Amount)*100) / 100
			out.Months[i].Count++
		}
	}

	for i, rec := range sorted {
		if i >= infraRecentPayments {
			break
		}
		out.Recent = append(out.Recent, infraHistoryItemDTO{InfraBillingHistoryRecord: rec, Nodes: linkDTOs(links[rec.UUID])})
	}
	if out.Recent == nil {
		out.Recent = []infraHistoryItemDTO{}
	}
	return out
}

// Overview — GET /cabinet/api/admin/infra/overview.
func (h *AdminInfraHandler) Overview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}
	ctx := r.Context()
	nodes, err := h.rw.GetInfraBillingNodes(ctx)
	if err != nil {
		slog.Error("admin infra: overview nodes", "error", err)
		http.Error(w, "failed to fetch nodes", http.StatusBadGateway)
		return
	}
	history, total, err := h.loadAllInfraHistory(ctx)
	if err != nil {
		slog.Error("admin infra: overview history", "error", err)
		http.Error(w, "failed to fetch history", http.StatusBadGateway)
		return
	}
	var meta map[uuid.UUID]database.InfraNodeMeta
	var links map[uuid.UUID][]database.InfraPaymentNode
	if h.meta != nil {
		// Без своей БД сводка всё равно полезна: цены будут «не заданы».
		if meta, err = h.meta.ListNodeMeta(ctx); err != nil {
			slog.Error("admin infra: overview meta", "error", err)
		}
		if links, err = h.meta.ListPaymentNodes(ctx); err != nil {
			slog.Error("admin infra: overview links", "error", err)
		}
	}
	writeJSON(w, http.StatusOK, buildInfraOverview(nodes, history, total, meta, links, time.Now()))
}

type infraPayNodeReq struct {
	BillingUUID string   `json:"billing_uuid"`
	Price       *float64 `json:"price,omitempty"`
}

type infraPayReq struct {
	ProviderUUID string            `json:"provider_uuid"`
	Amount       float64           `json:"amount"`
	BilledAt     string            `json:"billed_at"`
	PeriodMonths int               `json:"period_months"`
	Nodes        []infraPayNodeReq `json:"nodes"`
}

type infraPayNodeResult struct {
	BillingUUID       uuid.UUID `json:"billingUuid"`
	NodeUUID          uuid.UUID `json:"nodeUuid"`
	PrevNextBillingAt time.Time `json:"prevNextBillingAt"`
	NextBillingAt     time.Time `json:"nextBillingAt"`
}

type infraPayResp struct {
	// Пусто, если панель не вернула созданную запись — тогда отменить оплату целиком нельзя.
	HistoryUUID *uuid.UUID           `json:"historyUuid"`
	Nodes       []infraPayNodeResult `json:"nodes"`
}

// findCreatedInfraRecord ищет только что созданную запись: панель возвращает список, а не её саму.
// Совпадение по провайдеру, сумме и дате; записи, уже привязанные к нодам, пропускаем.
func findCreatedInfraRecord(recs []remnawave.InfraBillingHistoryRecord, prov uuid.UUID, amount float64, billedAt time.Time, taken map[uuid.UUID]bool) (uuid.UUID, bool) {
	for _, rec := range recs {
		if rec.ProviderUUID != prov || taken[rec.UUID] {
			continue
		}
		if math.Abs(rec.Amount-amount) > 0.005 {
			continue
		}
		if d := rec.BilledAt.Sub(billedAt); d > 2*time.Second || d < -2*time.Second {
			continue
		}
		return rec.UUID, true
	}
	return uuid.Nil, false
}

// Pay — POST /cabinet/api/admin/infra/pay: запись в историю провайдера + сдвиг дат оплаченных нод.
func (h *AdminInfraHandler) Pay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}
	var req infraPayReq
	if !decodeJSON(w, r, &req) {
		return
	}
	prov, err := uuid.Parse(req.ProviderUUID)
	if err != nil {
		http.Error(w, "invalid provider_uuid", http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 || req.Amount > infraMaxAmount || math.IsNaN(req.Amount) {
		http.Error(w, "invalid amount", http.StatusBadRequest)
		return
	}
	if req.PeriodMonths < 1 || req.PeriodMonths > infraMaxPeriodMonths {
		http.Error(w, "invalid period_months", http.StatusBadRequest)
		return
	}
	// Пустой список нод — просто запись в историю провайдера (как раньше «Добавить запись»).
	if len(req.Nodes) > infraMaxPayNodes {
		http.Error(w, "too many nodes", http.StatusBadRequest)
		return
	}
	billedAt, err := parseFlexDate(req.BilledAt)
	if err != nil {
		http.Error(w, "invalid billed_at", http.StatusBadRequest)
		return
	}
	ids := make([]uuid.UUID, 0, len(req.Nodes))
	seen := map[uuid.UUID]bool{}
	for _, n := range req.Nodes {
		id, err := uuid.Parse(n.BillingUUID)
		if err != nil || seen[id] {
			http.Error(w, "invalid billing_uuid", http.StatusBadRequest)
			return
		}
		if n.Price != nil && (*n.Price < 0 || *n.Price > infraMaxAmount) {
			http.Error(w, "invalid price", http.StatusBadRequest)
			return
		}
		seen[id] = true
		ids = append(ids, id)
	}

	ctx := r.Context()
	current, err := h.rw.GetInfraBillingNodes(ctx)
	if err != nil {
		slog.Error("admin infra pay: load nodes", "error", err)
		http.Error(w, "failed to fetch nodes", http.StatusBadGateway)
		return
	}
	byBilling := map[uuid.UUID]remnawave.InfraBillingBillingNode{}
	for _, n := range current.BillingNodes {
		byBilling[n.UUID] = n
	}
	for _, id := range ids {
		n, ok := byBilling[id]
		if !ok {
			http.Error(w, "billing node not found", http.StatusConflict)
			return
		}
		if n.ProviderUUID != prov {
			http.Error(w, "node belongs to another provider", http.StatusConflict)
			return
		}
	}

	created, err := h.rw.CreateInfraBillingHistory(ctx, remnawave.CreateInfraBillingHistoryRequest{
		ProviderUUID: prov, Amount: req.Amount, BilledAt: billedAt,
	})
	if err != nil {
		slog.Error("admin infra pay: create history", "error", err)
		http.Error(w, "failed to create history record", http.StatusBadGateway)
		return
	}

	taken := map[uuid.UUID]bool{}
	if h.meta != nil {
		if links, err := h.meta.ListPaymentNodes(ctx); err == nil {
			for k := range links {
				taken[k] = true
			}
		}
	}
	var historyUUID *uuid.UUID
	var recs []remnawave.InfraBillingHistoryRecord
	if created != nil {
		recs = created.Records
	}
	if id, ok := findCreatedInfraRecord(recs, prov, req.Amount, billedAt, taken); ok {
		historyUUID = &id
	} else if all, _, err := h.loadAllInfraHistory(ctx); err == nil {
		if id, ok := findCreatedInfraRecord(all, prov, req.Amount, billedAt, taken); ok {
			historyUUID = &id
		}
	}
	if historyUUID == nil {
		slog.Warn("admin infra pay: created record not found in panel response", "provider", prov)
	}

	results := make([]infraPayNodeResult, 0, len(ids))
	for _, id := range ids {
		n := byBilling[id]
		next := addMonthsClamped(n.NextBillingAt, req.PeriodMonths)
		if _, err := h.rw.PatchInfraBillingNodes(ctx, remnawave.UpdateInfraBillingNodeRequest{UUIDs: []uuid.UUID{id}, NextBillingAt: next}); err != nil {
			slog.Error("admin infra pay: shift node date", "billing", id, "error", err)
			h.rollbackPay(ctx, historyUUID, results)
			http.Error(w, "failed to update node dates", http.StatusBadGateway)
			return
		}
		results = append(results, infraPayNodeResult{BillingUUID: id, NodeUUID: n.NodeUUID, PrevNextBillingAt: n.NextBillingAt, NextBillingAt: next})
	}

	if h.meta != nil {
		h.savePayMeta(ctx, req, ids, byBilling, historyUUID, billedAt)
	}
	writeJSON(w, http.StatusOK, infraPayResp{HistoryUUID: historyUUID, Nodes: results})
}

// rollbackPay возвращает даты уже сдвинутых нод и убирает запись истории — оплата не должна остаться наполовину.
func (h *AdminInfraHandler) rollbackPay(ctx context.Context, historyUUID *uuid.UUID, done []infraPayNodeResult) {
	for _, d := range done {
		if _, err := h.rw.PatchInfraBillingNodes(ctx, remnawave.UpdateInfraBillingNodeRequest{UUIDs: []uuid.UUID{d.BillingUUID}, NextBillingAt: d.PrevNextBillingAt}); err != nil {
			slog.Error("admin infra pay: rollback node date", "billing", d.BillingUUID, "error", err)
		}
	}
	if historyUUID != nil {
		if err := h.rw.DeleteInfraBillingHistory(ctx, *historyUUID); err != nil {
			slog.Error("admin infra pay: rollback history", "history", *historyUUID, "error", err)
		}
	}
}

// savePayMeta запоминает, какие ноды оплачены, и цену/период на следующий раз.
// Ошибки не роняют ответ: оплата в панели уже записана.
func (h *AdminInfraHandler) savePayMeta(ctx context.Context, req infraPayReq, ids []uuid.UUID, byBilling map[uuid.UUID]remnawave.InfraBillingBillingNode, historyUUID *uuid.UUID, billedAt time.Time) {
	existing, err := h.meta.ListNodeMeta(ctx)
	if err != nil {
		slog.Error("admin infra pay: load meta", "error", err)
		existing = nil
	}
	var links []database.InfraPaymentNode
	for i, id := range ids {
		n := byBilling[id]
		price := req.Nodes[i].Price
		if price == nil && len(ids) == 1 {
			v := req.Amount
			price = &v
		}
		if price == nil {
			if m, ok := existing[n.NodeUUID]; ok {
				price = m.Price
			}
		}
		if err := h.meta.UpsertNodeMeta(ctx, n.NodeUUID, price, req.PeriodMonths); err != nil {
			slog.Error("admin infra pay: save meta", "node", n.NodeUUID, "error", err)
		}
		if historyUUID != nil {
			share := price
			if len(ids) == 1 {
				v := req.Amount
				share = &v
			}
			links = append(links, database.InfraPaymentNode{
				HistoryUUID: *historyUUID, NodeUUID: n.NodeUUID, NodeName: n.Node.Name,
				CountryCode: n.Node.CountryCode, Amount: share, BilledAt: billedAt,
			})
		}
	}
	if err := h.meta.InsertPaymentNodes(ctx, links); err != nil {
		slog.Error("admin infra pay: save links", "error", err)
	}
}

type infraUndoNodeReq struct {
	BillingUUID   string `json:"billing_uuid"`
	NextBillingAt string `json:"next_billing_at"`
}

type infraUndoReq struct {
	HistoryUUID string             `json:"history_uuid"`
	Nodes       []infraUndoNodeReq `json:"nodes"`
}

// PayUndo — POST /cabinet/api/admin/infra/pay/undo: кнопка «Отменить» в уведомлении после оплаты.
func (h *AdminInfraHandler) PayUndo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.requireRW(w) {
		return
	}
	var req infraUndoReq
	if !decodeJSON(w, r, &req) {
		return
	}
	if len(req.Nodes) > infraMaxPayNodes {
		http.Error(w, "too many nodes", http.StatusBadRequest)
		return
	}
	type back struct {
		id uuid.UUID
		at time.Time
	}
	backs := make([]back, 0, len(req.Nodes))
	for _, n := range req.Nodes {
		id, err := uuid.Parse(n.BillingUUID)
		if err != nil {
			http.Error(w, "invalid billing_uuid", http.StatusBadRequest)
			return
		}
		at, err := parseFlexDate(n.NextBillingAt)
		if err != nil {
			http.Error(w, "invalid next_billing_at", http.StatusBadRequest)
			return
		}
		backs = append(backs, back{id, at})
	}
	ctx := r.Context()
	if req.HistoryUUID != "" {
		hid, err := uuid.Parse(req.HistoryUUID)
		if err != nil {
			http.Error(w, "invalid history_uuid", http.StatusBadRequest)
			return
		}
		if err := h.rw.DeleteInfraBillingHistory(ctx, hid); err != nil {
			slog.Error("admin infra undo: delete history", "error", err)
			http.Error(w, "failed to delete history record", http.StatusBadGateway)
			return
		}
		if h.meta != nil {
			if err := h.meta.DeletePaymentNodes(ctx, hid); err != nil {
				slog.Error("admin infra undo: delete links", "error", err)
			}
		}
	}
	for _, b := range backs {
		if _, err := h.rw.PatchInfraBillingNodes(ctx, remnawave.UpdateInfraBillingNodeRequest{UUIDs: []uuid.UUID{b.id}, NextBillingAt: b.at}); err != nil {
			slog.Error("admin infra undo: restore node date", "billing", b.id, "error", err)
			http.Error(w, "failed to restore node dates", http.StatusBadGateway)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

type infraNodeMetaReq struct {
	NodeUUID     string   `json:"node_uuid"`
	Price        *float64 `json:"price"`
	PeriodMonths int      `json:"period_months"`
}

// NodeMeta — PUT /cabinet/api/admin/infra/node-meta: цена и период ноды из меню строки.
func (h *AdminInfraHandler) NodeMeta(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.meta == nil {
		http.Error(w, "storage not configured", http.StatusServiceUnavailable)
		return
	}
	var req infraNodeMetaReq
	if !decodeJSON(w, r, &req) {
		return
	}
	id, err := uuid.Parse(req.NodeUUID)
	if err != nil {
		http.Error(w, "invalid node_uuid", http.StatusBadRequest)
		return
	}
	if req.PeriodMonths < 1 || req.PeriodMonths > infraMaxPeriodMonths {
		http.Error(w, "invalid period_months", http.StatusBadRequest)
		return
	}
	if req.Price != nil && (*req.Price < 0 || *req.Price > infraMaxAmount || math.IsNaN(*req.Price)) {
		http.Error(w, "invalid price", http.StatusBadRequest)
		return
	}
	if err := h.meta.UpsertNodeMeta(r.Context(), id, req.Price, req.PeriodMonths); err != nil {
		slog.Error("admin infra: save node meta", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
