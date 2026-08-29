package main

import (
	"fmt"
	"os"
	"strings"
)

// Стартовый баннер: версию и коммит приходится искать в логах постоянно
// («та ли сборка поднялась?»), а обычная строка slog теряется среди сотни
// других. Рамка и цвет делают её заметной с первого взгляда.
//
// Цвет отключается переменной NO_COLOR (общепринятое соглашение, no-color.org)
// — на случай, если логи уходят в сборщик, где escape-последовательности мешают.
const (
	ansiReset = "\033[0m"
	ansiBold  = "\033[1m"
	ansiCyan  = "\033[36m"
	ansiGreen = "\033[32m"
	ansiDim   = "\033[2m"
)

func colorsEnabled() bool {
	// Пустое значение NO_COLOR тоже считается включённым — так велит соглашение.
	_, disabled := os.LookupEnv("NO_COLOR")
	return !disabled
}

func paint(code, s string) string {
	if !colorsEnabled() {
		return s
	}
	return code + s + ansiReset
}

// printStartupBanner печатает версию, коммит и дату сборки заметным блоком.
func printStartupBanner(version, commit, buildDate string) {
	const width = 58
	line := strings.Repeat("━", width)

	var b strings.Builder
	b.WriteString("\n")
	b.WriteString(paint(ansiCyan, line) + "\n")
	fmt.Fprintf(&b, "  %s   %s\n",
		paint(ansiBold+ansiCyan, "Meows VPN Shop"),
		paint(ansiBold+ansiGreen, version),
	)
	fmt.Fprintf(&b, "  %s %s   %s %s\n",
		paint(ansiDim, "commit"), paint(ansiGreen, commit),
		paint(ansiDim, "built"), paint(ansiDim, buildDate),
	)
	b.WriteString(paint(ansiCyan, line) + "\n")

	// В stderr, туда же, куда пишет slog — иначе в docker logs баннер уехал бы
	// от остальных строк старта.
	fmt.Fprint(os.Stderr, b.String())
}
