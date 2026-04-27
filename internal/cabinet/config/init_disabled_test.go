package config

import (
	"os"
	"testing"
)

func TestInitConfig_disabledDoesNotRequireSecrets(t *testing.T) {
	conf = cabinet{}
	t.Cleanup(func() { conf = cabinet{} })
	t.Setenv("CABINET_ENABLED", "false")
	_ = os.Unsetenv("CABINET_PUBLIC_URL")
	_ = os.Unsetenv("CABINET_JWT_SECRET")
	InitConfig()
	if IsEnabled() {
		t.Fatal("expected CABINET_ENABLED=false")
	}
}
