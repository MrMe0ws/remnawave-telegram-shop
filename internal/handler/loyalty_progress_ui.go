package handler

import (
	"math"
	"strings"
)

const loyaltyProgressBarWidth = 10

// loyaltyWithinLevelXP — сколько XP набрано внутри интервала [levelFloor, nextCeiling) и ширина интервала (для подписи «100 / 500»).
func loyaltyWithinLevelXP(currentXP, levelFloor, nextCeiling int64) (earned, span int64) {
	span = nextCeiling - levelFloor
	if span < 0 {
		span = 0
	}
	earned = currentXP - levelFloor
	if earned < 0 {
		earned = 0
	}
	if span > 0 && earned > span {
		earned = span
	}
	return earned, span
}

func loyaltySegmentProgressRatio(currentXP, segmentStart, segmentEnd int64) float64 {
	if segmentEnd <= segmentStart {
		return 1
	}
	if currentXP <= segmentStart {
		return 0
	}
	if currentXP >= segmentEnd {
		return 1
	}
	return float64(currentXP-segmentStart) / float64(segmentEnd-segmentStart)
}

// loyaltyPercentInt — процент заполнения текущего сегмента (0–100) для подписи рядом с полоской.
func loyaltyPercentInt(ratio float64) int {
	if ratio < 0 {
		ratio = 0
	}
	if ratio > 1 {
		ratio = 1
	}
	p := int(math.Round(ratio * 100))
	if p < 0 {
		return 0
	}
	if p > 100 {
		return 100
	}
	return p
}

func loyaltyProgressBarASCII(ratio float64, width int) string {
	if width < 1 {
		return "[]"
	}
	if ratio < 0 {
		ratio = 0
	}
	if ratio > 1 {
		ratio = 1
	}
	filled := int(math.Round(ratio * float64(width)))
	if filled > width {
		filled = width
	}
	var b strings.Builder
	b.Grow(width + 2)
	b.WriteByte('[')
	for i := 0; i < width; i++ {
		if i < filled {
			b.WriteString("█")
		} else {
			b.WriteString("░")
		}
	}
	b.WriteByte(']')
	return b.String()
}
