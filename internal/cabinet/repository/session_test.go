package repository

import (
	"errors"
	"testing"
)

func TestErrReused_isSentinel(t *testing.T) {
	if !errors.Is(ErrReused, ErrReused) {
		t.Fatal("ErrReused should be comparable with errors.Is self")
	}
}
