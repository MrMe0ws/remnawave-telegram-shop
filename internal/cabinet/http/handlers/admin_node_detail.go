package handlers

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"remnawave-tg-shop-bot/internal/remnawave"
)

const adminNodesPrefix = "/cabinet/api/admin/nodes/"

type adminNodeInboundDTO struct {
	UUID string `json:"uuid"`
	Tag  string `json:"tag"`
	Type string `json:"type"`
	Port int    `json:"port"`
}

type adminNodeSystemDTO struct {
	Arch        string  `json:"arch"`
	Platform    string  `json:"platform"`
	CPUModel    string  `json:"cpu_model"`
	CPUs        int     `json:"cpus"`
	Kernel      string  `json:"kernel"`
	Hostname    string  `json:"hostname"`
	MemoryTotal float64 `json:"memory_total_bytes"`
	MemoryUsed  float64 `json:"memory_used_bytes"`
	UptimeSec   int64   `json:"uptime_sec"`
	Interface   string  `json:"interface"`
	RxPerSec    float64 `json:"rx_bytes_per_sec"`
	TxPerSec    float64 `json:"tx_bytes_per_sec"`
	RxTotal     float64 `json:"rx_total_bytes"`
	TxTotal     float64 `json:"tx_total_bytes"`
}

type adminNodeIPDTO struct {
	IP     string `json:"ip"`
	Status string `json:"status"`
}

// adminNodeDetailDTO — ответ GET /admin/nodes/{uuid}: всё для окна ноды.
// Секретного ключа здесь нет: он понадобится на этапе редактирования и будет отдельной ручкой.
type adminNodeDetailDTO struct {
	UUID        string `json:"uuid"`
	Name        string `json:"name"`
	CountryCode string `json:"country_code"`
	Address     string `json:"address"`
	Port        int    `json:"port"`
	State       string `json:"state"`
	ProxyURL    string `json:"proxy_url"`

	LastStatusMessage string `json:"last_status_message,omitempty"`
	LastStatusChange  string `json:"last_status_change,omitempty"`

	TrafficTracking   bool  `json:"traffic_tracking"`
	TrafficLimitBytes int64 `json:"traffic_limit_bytes"`
	TrafficUsedBytes  int64 `json:"traffic_used_bytes"`
	TrafficResetDay   int   `json:"traffic_reset_day"`
	NotifyPercent     int   `json:"notify_percent"`

	ConsumptionMultiplier     float64 `json:"consumption_multiplier"`
	NodeConsumptionMultiplier float64 `json:"node_consumption_multiplier"`

	Tags []string `json:"tags"`
	Note string   `json:"note"`

	ProviderUUID string                `json:"provider_uuid,omitempty"`
	Provider     *adminNodeProviderDTO `json:"provider,omitempty"`
	PluginUUID   string                `json:"plugin_uuid,omitempty"`

	ConfigProfileUUID string                `json:"config_profile_uuid,omitempty"`
	ConfigProfileName string                `json:"config_profile_name,omitempty"`
	Inbounds          []adminNodeInboundDTO `json:"inbounds"`
	IPs               []adminNodeIPDTO      `json:"ips"`

	UsersOnline   int    `json:"users_online"`
	XrayUptimeSec int64  `json:"xray_uptime_sec"`
	XrayVersion   string `json:"xray_version,omitempty"`
	NodeVersion   string `json:"node_version,omitempty"`

	System *adminNodeSystemDTO `json:"system"`
}

func nodeDetailToDTO(n remnawave.NodeDetail) adminNodeDetailDTO {
	d := adminNodeDetailDTO{
		UUID: n.UUID, Name: n.Name, CountryCode: n.CountryCode, Address: n.Address, Port: n.Port, State: n.State, ProxyURL: n.ProxyURL,
		LastStatusMessage: n.LastStatusMessage, LastStatusChange: n.LastStatusChange,
		TrafficTracking: n.TrafficTracking, TrafficLimitBytes: n.TrafficLimitBytes, TrafficUsedBytes: n.TrafficUsedBytes,
		TrafficResetDay: n.TrafficResetDay, NotifyPercent: n.NotifyPercent,
		ConsumptionMultiplier: n.ConsumptionMultiplier, NodeConsumptionMultiplier: n.NodeConsumptionMultiplier,
		Tags: n.Tags, Note: n.Note, ProviderUUID: n.ProviderUUID, PluginUUID: n.PluginUUID,
		ConfigProfileUUID: n.ConfigProfile.UUID, ConfigProfileName: n.ConfigProfile.Name,
		Inbounds: []adminNodeInboundDTO{}, IPs: []adminNodeIPDTO{},
		UsersOnline: n.UsersOnline, XrayUptimeSec: n.XrayUptimeSec, XrayVersion: n.XrayVersion, NodeVersion: n.NodeVersion,
	}
	if d.Tags == nil {
		d.Tags = []string{}
	}
	if n.Provider != nil {
		d.Provider = &adminNodeProviderDTO{Name: n.Provider.Name, FaviconLink: n.Provider.FaviconLink}
	}
	for _, in := range n.ConfigProfile.Inbounds {
		d.Inbounds = append(d.Inbounds, adminNodeInboundDTO{UUID: in.UUID, Tag: in.Tag, Type: in.Type, Port: in.Port})
	}
	for _, ip := range n.IPs {
		d.IPs = append(d.IPs, adminNodeIPDTO{IP: ip.IP, Status: ip.Status})
	}
	if s := n.System; s != nil {
		d.System = &adminNodeSystemDTO{
			Arch: s.Arch, Platform: s.Platform, CPUModel: s.CPUModel, CPUs: s.CPUs, Kernel: s.Kernel, Hostname: s.Hostname,
			MemoryTotal: s.MemoryTotal, MemoryUsed: s.MemoryUsed, UptimeSec: s.UptimeSec,
			Interface: s.Interface, RxPerSec: s.RxPerSec, TxPerSec: s.TxPerSec, RxTotal: s.RxTotal, TxTotal: s.TxTotal,
		}
	}
	return d
}

func (h *AdminNodesHandler) invalidate() {
	h.mu.Lock()
	h.cached = nil
	h.mu.Unlock()
}

// Item обслуживает всё под /admin/nodes/{uuid}:
//
//	GET    /admin/nodes/{uuid}                 — детали ноды
//	POST   /admin/nodes/{uuid}/actions/{name}  — enable | disable | restart | reset-traffic
//	DELETE /admin/nodes/{uuid}                 — удалить ноду
//	PATCH  /admin/nodes/{uuid}                 — правка полей
//	GET    /admin/nodes/{uuid}/{secret-key|metadata|hosts|inbound-tree|usage|sessions}
//
// Все изменения пишутся в журнал: кто из админов что сделал с какой нодой.
func (h *AdminNodesHandler) Item(w http.ResponseWriter, r *http.Request) {
	if h.rw == nil {
		http.Error(w, "panel not configured", http.StatusServiceUnavailable)
		return
	}
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, adminNodesPrefix), "/")
	parts := strings.Split(rest, "/")
	id, err := uuid.Parse(parts[0])
	if err != nil {
		http.Error(w, "invalid uuid in path", http.StatusBadRequest)
		return
	}
	nodeID := id.String()

	switch {
	case len(parts) == 1 && r.Method == http.MethodGet:
		d, err := h.rw.GetNodeDetail(r.Context(), nodeID)
		if err != nil {
			slog.Error("admin nodes: detail", "node", nodeID, "error", err)
			http.Error(w, "failed to fetch node", http.StatusBadGateway)
			return
		}
		if h.demo {
			dd := demoDetail(*d)
			d = &dd
		}
		writeJSON(w, http.StatusOK, nodeDetailToDTO(*d))

	case len(parts) == 1 && r.Method == http.MethodDelete:
		if err := h.rw.DeleteNode(r.Context(), nodeID); err != nil {
			slog.Error("admin nodes: delete", "node", nodeID, "error", err)
			http.Error(w, "failed to delete node", http.StatusBadGateway)
			return
		}
		slog.Info("admin nodes: deleted", "node", nodeID)
		h.invalidate()
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})

	case len(parts) == 3 && parts[1] == "actions" && r.Method == http.MethodPost:
		if err := h.rw.NodeAction(r.Context(), nodeID, parts[2]); err != nil {
			if strings.HasPrefix(err.Error(), "unknown node action") {
				http.Error(w, "unknown action", http.StatusNotFound)
				return
			}
			slog.Error("admin nodes: action", "node", nodeID, "action", parts[2], "error", err)
			http.Error(w, "node action failed", http.StatusBadGateway)
			return
		}
		slog.Info("admin nodes: action", "node", nodeID, "action", parts[2])
		h.invalidate()
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})

	case len(parts) == 1 && r.Method == http.MethodPatch:
		h.patchNode(w, r, nodeID)

	case len(parts) == 2 && r.Method == http.MethodGet:
		switch parts[1] {
		case "secret-key":
			h.secretKey(w, r)
		case "metadata":
			h.metadata(w, r, nodeID)
		case "hosts":
			h.nodeHosts(w, r, nodeID)
		case "inbound-tree":
			h.inboundTree(w, r, nodeID)
		case "usage":
			h.usage(w, r, nodeID)
		case "sessions":
			h.sessions(w, r, nodeID)
		default:
			http.Error(w, "not found", http.StatusNotFound)
		}

	default:
		http.Error(w, "not found", http.StatusNotFound)
	}
}
