package config

import "sync/atomic"

// Сведения о сборке. Значения задаются через ldflags в cmd/app и попадают сюда
// один раз при старте — отсюда их берут стартовый баннер и админка кабинета,
// чтобы не тащить их параметром через полдюжины конструкторов.
var (
	buildVersion atomic.Value // string
	buildCommit  atomic.Value // string
	buildDate    atomic.Value // string
)

// SetBuildInfo — вызывается один раз из main до старта сервисов.
func SetBuildInfo(version, commit, date string) {
	buildVersion.Store(version)
	buildCommit.Store(commit)
	buildDate.Store(date)
}

func loadBuildString(v *atomic.Value) string {
	if s, ok := v.Load().(string); ok {
		return s
	}
	return ""
}

// BuildVersion — версия сборки («5.3.0» для тега, «dev-2fdc211» для main).
func BuildVersion() string { return loadBuildString(&buildVersion) }

// BuildCommit — короткий хеш коммита сборки.
func BuildCommit() string { return loadBuildString(&buildCommit) }

// BuildDate — время сборки образа.
func BuildDate() string { return loadBuildString(&buildDate) }
