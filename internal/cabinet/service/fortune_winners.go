package service

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"sort"
	"strings"
	"time"

	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
	"remnawave-tg-shop-bot/internal/cabinet/repository"
)

// FortuneWinnerFeedMeta — настройки ленты победителей для UI (без списка).
type FortuneWinnerFeedMeta struct {
	Enabled  bool `json:"enabled"`
	FakeFill bool `json:"fake_fill"`
}

// FortuneRecentWinDTO — одна запись (имя уже замазано на сервере).
type FortuneRecentWinDTO struct {
	SpinAt      time.Time `json:"spin_at"`
	RewardType  string    `json:"reward_type"`
	RewardValue int       `json:"reward_value"`
	MaskedName  string    `json:"masked_name"`
}

// FortuneRecentWinsResponse — GET /cabinet/api/fortune/recent-wins.
type FortuneRecentWinsResponse struct {
	Items []FortuneRecentWinDTO `json:"items"`
}

func resolveFortuneDisplayRaw(tgU, tgFn, em *string) string {
	if tgU != nil && *tgU != "" {
		return *tgU
	}
	if tgFn != nil && *tgFn != "" {
		return *tgFn
	}
	if em != nil && *em != "" {
		return *em
	}
	return ""
}

// fortuneMaskDisplayName — частичная маска ника (латиница/кириллица по рунам).
func fortuneMaskDisplayName(raw string) string {
	raw = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(raw), "@"))
	if raw == "" {
		return "•••"
	}
	rs := []rune(raw)
	n := len(rs)
	if n == 1 {
		return string(rs[0]) + "*"
	}
	if n == 2 {
		return string(rs[0]) + "*"
	}
	if n <= 5 {
		stars := n - 2
		if stars < 1 {
			stars = 1
		}
		return string(rs[0]) + strings.Repeat("*", stars) + string(rs[n-1])
	}
	if n <= 7 {
		pl, sl := 2, 2
		mid := n - pl - sl
		if mid < 1 {
			mid = 1
		}
		return string(rs[:pl]) + strings.Repeat("*", mid) + string(rs[n-sl:])
	}
	pl, sl := 3, 2
	mid := n - pl - sl
	stars := mid
	if stars > 4 {
		stars = 4
	}
	if stars < 1 {
		stars = 1
	}
	return string(rs[:pl]) + strings.Repeat("*", stars) + string(rs[n-sl:])
}

func (s *FortuneService) appendWinnerFeedMeta(out *FortuneStatusResponse, cfg cabcfg.FortuneWheelConfig) {
	if !cfg.Enabled || s.rw == nil {
		return
	}
	out.WinnerFeed = &FortuneWinnerFeedMeta{
		Enabled:  cfg.WinnerTickerEnabled,
		FakeFill: cfg.WinnerTickerFakeFill,
	}
}

func fakeRewardValue(c cabcfg.FortuneWheelConfig, rt string) int {
	switch rt {
	case "micro":
		return (c.RewardMicroXPMin + c.RewardMicroXPMax) / 2
	case "xp":
		return c.RewardXPAmount
	case "discount_3":
		return c.RewardDiscount3Percent
	case "discount_5":
		return c.RewardDiscount5Percent
	case "days_3":
		return c.RewardDays3
	case "days_5":
		return c.RewardDays5
	case "days_7":
		return c.RewardDays7
	case "days_15":
		return c.RewardDays15
	case "days_30":
		return c.RewardDays30
	case "days_180":
		return c.RewardDays180
	default:
		return c.RewardDays7
	}
}

func fortuneSyntheticDayEntry(maskedName string, spinAt time.Time, cfg cabcfg.FortuneWheelConfig, salt int) FortuneRecentWinDTO {
	rt := fortuneFakeTickerDayTypes[((salt%len(fortuneFakeTickerDayTypes))+len(fortuneFakeTickerDayTypes))%len(fortuneFakeTickerDayTypes)]
	return FortuneRecentWinDTO{
		SpinAt:      spinAt.UTC(),
		RewardType:  rt,
		RewardValue: fakeRewardValue(cfg, rt),
		MaskedName:  maskedName,
	}
}

func fortuneSyntheticOtherEntry(maskedName string, spinAt time.Time, cfg cabcfg.FortuneWheelConfig, salt int) FortuneRecentWinDTO {
	rt := fortuneFakeTickerOtherTypes[((salt%len(fortuneFakeTickerOtherTypes))+len(fortuneFakeTickerOtherTypes))%len(fortuneFakeTickerOtherTypes)]
	return FortuneRecentWinDTO{
		SpinAt:      spinAt.UTC(),
		RewardType:  rt,
		RewardValue: fakeRewardValue(cfg, rt),
		MaskedName:  maskedName,
	}
}

func countDaysInTicker(slice []FortuneRecentWinDTO) int {
	return len(slice) - countNonDaysInTicker(slice)
}

// tickerMinDaysForLen — минимум записей «дни подписки» при длине n (≈85%, вверх).
func tickerMinDaysForLen(n int) int {
	if n <= 0 {
		return 0
	}
	return (n*85 + 99) / 100
}

// tickerMaxNonDaysForLen — не более ~15% «не дни».
func tickerMaxNonDaysForLen(n int) int {
	if n <= 0 {
		return 0
	}
	return n - tickerMinDaysForLen(n)
}

// fortuneTickerApplyFakeDayRatio — при FORTUNE_WINNER_TICKER_FAKE_FILL: доводит длину 12…48 и удерживает ≈85% days_*,
// самые старые «не дни» переписываются в синтетические дни (тот же masked_name), нехватка добивается фейковыми днями.
func fortuneTickerApplyFakeDayRatio(items []FortuneRecentWinDTO, cfg cabcfg.FortuneWheelConfig) []FortuneRecentWinDTO {
	const minLen, maxLen = 12, 48
	if len(items) == 0 {
		return fortuneTickerBuildAllSynthetic(minLen, cfg)
	}
	sort.SliceStable(items, func(i, j int) bool {
		return items[i].SpinAt.After(items[j].SpinAt)
	})
	nTarget := len(items)
	if nTarget < minLen {
		nTarget = minLen
	}
	if nTarget > maxLen {
		nTarget = maxLen
	}
	if len(items) > nTarget {
		items = items[:nTarget]
	}
	out := append([]FortuneRecentWinDTO(nil), items...)
	now := time.Now().UTC()
	padSalt := 0
	for len(out) < nTarget {
		name := fortuneFakeTickerNames[padSalt%len(fortuneFakeTickerNames)]
		spin := now.Add(-time.Duration((len(out)+1)*4) * time.Minute).UTC()
		out = append(out, fortuneSyntheticDayEntry(fortuneMaskDisplayName(name), spin, cfg, padSalt))
		padSalt++
	}
	minDay := tickerMinDaysForLen(len(out))
	maxNon := tickerMaxNonDaysForLen(len(out))
	for i := len(out) - 1; i >= 0; i-- {
		if countNonDaysInTicker(out) <= maxNon && countDaysInTicker(out) >= minDay {
			break
		}
		if isDaysTickerReward(out[i].RewardType) {
			continue
		}
		out[i] = fortuneSyntheticDayEntry(out[i].MaskedName, out[i].SpinAt, cfg, i+padSalt)
	}
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].SpinAt.After(out[j].SpinAt)
	})
	return out
}

func fortuneTickerBuildAllSynthetic(n int, cfg cabcfg.FortuneWheelConfig) []FortuneRecentWinDTO {
	if n <= 0 {
		return nil
	}
	minDay := tickerMinDaysForLen(n)
	maxNon := tickerMaxNonDaysForLen(n)
	now := time.Now().UTC()
	out := make([]FortuneRecentWinDTO, 0, n)
	for i := 0; i < minDay; i++ {
		name := fortuneFakeTickerNames[i%len(fortuneFakeTickerNames)]
		spin := now.Add(-time.Duration((i+1)*5) * time.Minute).UTC()
		out = append(out, fortuneSyntheticDayEntry(fortuneMaskDisplayName(name), spin, cfg, i))
	}
	for i := 0; i < maxNon; i++ {
		name := fortuneFakeTickerNames[(i+minDay)%len(fortuneFakeTickerNames)]
		spin := now.Add(-time.Duration((minDay+i+1)*5) * time.Minute).UTC()
		out = append(out, fortuneSyntheticOtherEntry(fortuneMaskDisplayName(name), spin, cfg, i))
	}
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].SpinAt.After(out[j].SpinAt)
	})
	return out
}

func isDaysTickerReward(rt string) bool {
	return strings.HasPrefix(rt, "days_")
}

func countNonDaysInTicker(slice []FortuneRecentWinDTO) int {
	n := 0
	for _, x := range slice {
		if !isDaysTickerReward(x.RewardType) {
			n++
		}
	}
	return n
}

func otherTickerPriority(rt string) int {
	switch rt {
	case "discount_5":
		return 0
	case "discount_3":
		return 1
	case "xp":
		return 2
	case "micro":
		return 3
	default:
		return 4
	}
}

// buildShowcaseTickerList — витрина: при полном списке ≈85% — дни подписки, не более ≈15% — XP, микро-XP, скидки и т.п.
func buildShowcaseTickerList(items []FortuneRecentWinDTO, _ cabcfg.FortuneWheelConfig) []FortuneRecentWinDTO {
	const maxOut = 48
	maxNonDays := tickerMaxNonDaysForLen(maxOut)
	minDaySlots := tickerMinDaysForLen(maxOut)

	var days []FortuneRecentWinDTO
	var others []FortuneRecentWinDTO
	for _, it := range items {
		if isDaysTickerReward(it.RewardType) {
			days = append(days, it)
		} else {
			others = append(others, it)
		}
	}

	sort.SliceStable(others, func(i, j int) bool {
		pi, pj := otherTickerPriority(others[i].RewardType), otherTickerPriority(others[j].RewardType)
		if pi != pj {
			return pi < pj
		}
		return others[i].SpinAt.After(others[j].SpinAt)
	})

	out := make([]FortuneRecentWinDTO, 0, maxOut)
	di, oi := 0, 0

	for len(out) < maxOut && di < len(days) && len(out) < minDaySlots {
		out = append(out, days[di])
		di++
	}
	for len(out) < maxOut && oi < len(others) {
		if countNonDaysInTicker(out) >= maxNonDays {
			break
		}
		out = append(out, others[oi])
		oi++
	}
	for len(out) < maxOut && di < len(days) {
		out = append(out, days[di])
		di++
	}

	if len(out) == 0 && len(items) > 0 {
		n := maxOut
		if len(items) < n {
			n = len(items)
		}
		return items[:n]
	}
	if len(out) > maxOut {
		out = out[:maxOut]
	}
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].SpinAt.After(out[j].SpinAt)
	})
	return out
}

// maybeInjectRareDays180 — редко (~3%) добавляет фейк «+180 дней» при включённой ленте (маркетинг).
func maybeInjectRareDays180(items []FortuneRecentWinDTO, cfg cabcfg.FortuneWheelConfig) []FortuneRecentWinDTO {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return items
	}
	u := binary.BigEndian.Uint64(b[:])
	if u%32 != 0 { // ~3.1%
		return items
	}
	rt := "days_180"
	val := fakeRewardValue(cfg, rt)
	fakeWin := FortuneRecentWinDTO{
		SpinAt:      time.Now().UTC().Add(-90 * time.Second),
		RewardType:  rt,
		RewardValue: val,
		MaskedName:  fortuneMaskDisplayName("legend_user"),
	}
	out := append([]FortuneRecentWinDTO{fakeWin}, items...)
	if len(out) > 48 {
		out = out[:48]
	}
	return out
}

// RecentWinsFeed — последние выигрыши для бегущей строки (витрина + редкий фейк +180 дн.).
func (s *FortuneService) RecentWinsFeed(ctx context.Context) (*FortuneRecentWinsResponse, error) {
	cfg := s.cfg()
	out := &FortuneRecentWinsResponse{Items: []FortuneRecentWinDTO{}}
	if !cfg.Enabled || s.rw == nil || !cfg.WinnerTickerEnabled {
		return out, nil
	}
	var feedRows []repository.FortuneFeedRow
	var err error
	feedRows, err = s.fortRepo.ListRecentFeed(ctx, 160)
	if err != nil {
		return nil, err
	}
	items := make([]FortuneRecentWinDTO, 0, len(feedRows))
	for _, feedRow := range feedRows {
		tgU, tgFn, emLocal := repository.FortuneFeedIdentityStrings(feedRow)
		raw := resolveFortuneDisplayRaw(tgU, tgFn, emLocal)
		if raw == "" {
			raw = "user"
		}
		items = append(items, FortuneRecentWinDTO{
			SpinAt:      feedRow.SpinAt.UTC(),
			RewardType:  feedRow.RewardType,
			RewardValue: feedRow.RewardValue,
			MaskedName:  fortuneMaskDisplayName(raw),
		})
	}

	items = buildShowcaseTickerList(items, cfg)
	if cfg.WinnerTickerFakeFill {
		items = fortuneTickerApplyFakeDayRatio(items, cfg)
	}
	items = maybeInjectRareDays180(items, cfg)
	if len(items) > 48 {
		items = items[:48]
	}
	out.Items = items
	return out, nil
}
