package utils

import "testing"

func TestIsSyntheticTelegramID_andSyntheticTelegramID(t *testing.T) {
	t.Cleanup(func() { SetSyntheticTelegramIDBase(SyntheticTelegramIDBase) })

	SetSyntheticTelegramIDBase(1_000_000_000_000)
	if got := SyntheticTelegramID(42); got != 1_000_000_000_042 {
		t.Fatalf("SyntheticTelegramID(42) = %d, want 1000000000042", got)
	}
	if !IsSyntheticTelegramID(1_000_000_000_042) {
		t.Fatal("expected synthetic id in range")
	}
	if IsSyntheticTelegramID(999_999_999_999) {
		t.Fatal("expected non-synthetic below base")
	}
}

func TestIsSyntheticTelegramID_defaultBase(t *testing.T) {
	t.Cleanup(func() { SetSyntheticTelegramIDBase(SyntheticTelegramIDBase) })
	SetSyntheticTelegramIDBase(SyntheticTelegramIDBase)
	if !IsSyntheticTelegramID(SyntheticTelegramIDBase) {
		t.Fatal("boundary: id == base should be synthetic")
	}
	if !IsSyntheticTelegramID(SyntheticTelegramIDBase + 1) {
		t.Fatal("base+1 synthetic")
	}
}
