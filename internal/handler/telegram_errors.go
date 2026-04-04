package handler

import (
	"log/slog"
	"strings"
)

func logEditError(context string, err error) {
	if err == nil || isMessageNotModified(err) {
		return
	}
	slog.Error(context, "error", err)
}

func isMessageNotModified(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "message is not modified")
}
