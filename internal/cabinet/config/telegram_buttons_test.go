package config

import (
	"testing"
)

func TestTelegramShowChannelButton(t *testing.T) {
	t.Setenv("CABINET_TELEGRAM_SHOW_CHANNEL_BUTTON", "")
	if TelegramShowChannelButton() {
		t.Fatal("expected false when unset")
	}

	t.Setenv("CABINET_TELEGRAM_SHOW_CHANNEL_BUTTON", "true")
	if !TelegramShowChannelButton() {
		t.Fatal("expected true")
	}

	t.Setenv("CABINET_TELEGRAM_SHOW_CHANNEL_BUTTON", "TRUE")
	if !TelegramShowChannelButton() {
		t.Fatal("expected true for TRUE")
	}

	t.Setenv("CABINET_TELEGRAM_SHOW_CHANNEL_BUTTON", "false")
	if TelegramShowChannelButton() {
		t.Fatal("expected false")
	}
}

func TestTelegramShowFeedbackButton(t *testing.T) {
	t.Setenv("CABINET_TELEGRAM_SHOW_FEEDBACK_BUTTON", "")
	if TelegramShowFeedbackButton() {
		t.Fatal("expected false when unset")
	}

	t.Setenv("CABINET_TELEGRAM_SHOW_FEEDBACK_BUTTON", "true")
	if !TelegramShowFeedbackButton() {
		t.Fatal("expected true")
	}

	t.Setenv("CABINET_TELEGRAM_SHOW_FEEDBACK_BUTTON", "false")
	if TelegramShowFeedbackButton() {
		t.Fatal("expected false")
	}
}
