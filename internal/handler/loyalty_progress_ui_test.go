package handler

import (
	"testing"
	"unicode/utf8"
)

func TestLoyaltyWithinLevelXP(t *testing.T) {
	e, s := loyaltyWithinLevelXP(600, 500, 1000)
	if e != 100 || s != 500 {
		t.Fatalf("600 in 500..1000: got %d/%d", e, s)
	}
	e, s = loyaltyWithinLevelXP(200, 0, 500)
	if e != 200 || s != 500 {
		t.Fatalf("level0 segment: got %d/%d", e, s)
	}
	e, s = loyaltyWithinLevelXP(50, 0, 500)
	if e != 50 || s != 500 {
		t.Fatal("early level0")
	}
}

func TestLoyaltySegmentProgressRatio(t *testing.T) {
	if r := loyaltySegmentProgressRatio(1500, 1000, 2000); r < 0.49 || r > 0.51 {
		t.Fatalf("mid segment: got %v", r)
	}
	if loyaltySegmentProgressRatio(500, 1000, 2000) != 0 {
		t.Fatal("below start")
	}
	if loyaltySegmentProgressRatio(2500, 1000, 2000) != 1 {
		t.Fatal("above end")
	}
}

func TestLoyaltyProgressBarASCII(t *testing.T) {
	s := loyaltyProgressBarASCII(0.5, 10)
	if utf8.RuneCountInString(s) != 12 { // [ + 10 + ]
		t.Fatalf("runes: %d %q", utf8.RuneCountInString(s), s)
	}
}

func TestLoyaltyPercentInt(t *testing.T) {
	if loyaltyPercentInt(0.735) != 74 {
		t.Fatalf("got %d", loyaltyPercentInt(0.735))
	}
	if loyaltyPercentInt(-0.1) != 0 || loyaltyPercentInt(2) != 100 {
		t.Fatal("clamp")
	}
}
