package remnawave

import (
	"context"
	"net/http"
	"net/url"
)

// Сводка панели для админского «Обзора».
//
// Две ручки: /api/system/stats и /api/system/stats/bandwidth. Схемы взяты из
// контракта панели (libs/contract/commands/system) и повторяют его дословно,
// включая то, что трафик приходит уже отформатированными строками.

// SystemStats — GET /api/system/stats?tz=<IANA>.
type SystemStats struct {
	CPU struct {
		Cores int `json:"cores"`
	} `json:"cpu"`
	Memory struct {
		Total float64 `json:"total"`
		Free  float64 `json:"free"`
		Used  float64 `json:"used"`
	} `json:"memory"`
	Uptime    float64 `json:"uptime"`
	Timestamp float64 `json:"timestamp"`
	Users     struct {
		// Ключи — статусы панели (ACTIVE, EXPIRED, LIMITED, DISABLED).
		// Записью, а не полями: набор статусов задаёт панель, и новый статус
		// в её версии не должен ломать разбор у нас.
		StatusCounts map[string]int64 `json:"statusCounts"`
		TotalUsers   int64            `json:"totalUsers"`
	} `json:"users"`
	OnlineStats struct {
		OnlineNow   int64 `json:"onlineNow"`
		LastDay     int64 `json:"lastDay"`
		LastWeek    int64 `json:"lastWeek"`
		NeverOnline int64 `json:"neverOnline"`
	} `json:"onlineStats"`
	Nodes struct {
		TotalOnline int64 `json:"totalOnline"`
		// Строка, а не число: панель отдаёт суммарные байты текстом.
		TotalBytesLifetime string `json:"totalBytesLifetime"`
	} `json:"nodes"`
}

// BandwidthPeriod — расход за период и сравнение с предыдущим.
//
// Все три поля — готовые строки вида «287.01 GiB» и «-162.73 GiB». Панель уже
// выбрала единицы и округление; разбирать их обратно в байты, чтобы
// отформатировать заново, значит гарантированно разойтись с её же экраном.
type BandwidthPeriod struct {
	Current    string `json:"current"`
	Previous   string `json:"previous"`
	Difference string `json:"difference"`
}

// BandwidthStats — GET /api/system/stats/bandwidth?tz=<IANA>.
type BandwidthStats struct {
	LastTwoDays   BandwidthPeriod `json:"bandwidthLastTwoDays"`
	LastSevenDays BandwidthPeriod `json:"bandwidthLastSevenDays"`
	Last30Days    BandwidthPeriod `json:"bandwidthLast30Days"`
	CalendarMonth BandwidthPeriod `json:"bandwidthCalendarMonth"`
	CurrentYear   BandwidthPeriod `json:"bandwidthCurrentYear"`
}

func systemStatsPath(base, tz string) string {
	if tz == "" {
		return base
	}
	return base + "?" + url.Values{"tz": {tz}}.Encode()
}

// GetSystemStats возвращает сводку панели: пользователи, онлайн, узлы, память.
// tz — зона IANA («Europe/Moscow»); от неё зависит, что панель считает «сегодня».
func (r *Client) GetSystemStats(ctx context.Context, tz string) (*SystemStats, error) {
	var resp apiResponse[SystemStats]
	if err := r.doJSON(ctx, http.MethodGet, systemStatsPath("/api/system/stats", tz), nil, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// GetBandwidthStats возвращает расход трафика по пяти периодам.
func (r *Client) GetBandwidthStats(ctx context.Context, tz string) (*BandwidthStats, error) {
	var resp apiResponse[BandwidthStats]
	if err := r.doJSON(ctx, http.MethodGet, systemStatsPath("/api/system/stats/bandwidth", tz), nil, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}
