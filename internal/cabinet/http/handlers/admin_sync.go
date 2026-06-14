package handlers

import (
	"log/slog"
	"net/http"
	"sync/atomic"

	"remnawave-tg-shop-bot/internal/sync"
)

var syncRunning int32

type AdminSyncHandler struct {
	syncService *sync.SyncService
}

func NewAdminSync(syncService *sync.SyncService) *AdminSyncHandler {
	return &AdminSyncHandler{syncService: syncService}
}

func (h *AdminSyncHandler) TriggerSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !atomic.CompareAndSwapInt32(&syncRunning, 0, 1) {
		http.Error(w, "sync already in progress", http.StatusConflict)
		return
	}

	slog.Info("admin: sync triggered via cabinet")
	go func() {
		defer atomic.StoreInt32(&syncRunning, 0)
		h.syncService.Sync()
	}()

	writeJSON(w, http.StatusOK, map[string]string{"status": "started"})
}
