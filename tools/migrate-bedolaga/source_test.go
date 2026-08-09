package main

import (
	"strings"
	"testing"
)

func TestSourceCapsHint(t *testing.T) {
	c4 := sourceCaps{HintGeneration: "bedolaga_4x_rw3"}
	lines := c4.WarningLines()
	joined := strings.Join(lines, "\n")
	if !strings.Contains(joined, "4.x") || !strings.Contains(joined, "3.0") {
		t.Fatalf("expected 4.x/3.0 warning, got %#v", lines)
	}

	c3 := sourceCaps{HintGeneration: "bedolaga_3x_rw2"}
	joined3 := strings.Join(c3.WarningLines(), "\n")
	if !strings.Contains(joined3, "3.x") {
		t.Fatalf("expected 3.x warning, got %q", joined3)
	}
}
