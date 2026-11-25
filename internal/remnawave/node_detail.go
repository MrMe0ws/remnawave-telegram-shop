package remnawave

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// NodeDetail — одна нода панели целиком: всё, что показывает окно ноды в админке кабинета.
// Поля nullable в панели (нода не в сети, нет system) здесь указатели или пустые значения.
type NodeDetail struct {
	UUID        string
	Name        string
	CountryCode string
	Address     string
	Port        int
	State       string
	ProxyURL    string

	// LastStatusMessage — последняя ошибка статуса («timeout of 15000ms exceeded»); пусто у здоровой ноды.
	LastStatusMessage string
	LastStatusChange  string

	TrafficTracking   bool
	TrafficLimitBytes int64
	TrafficUsedBytes  int64
	TrafficResetDay   int
	NotifyPercent     int

	ConsumptionMultiplier     float64
	NodeConsumptionMultiplier float64

	Tags []string
	Note string

	ProviderUUID string
	Provider     *NodeProvider
	PluginUUID   string

	ConfigProfile NodeConfigProfile
	IPs           []NodeIP

	UsersOnline   int
	XrayUptimeSec int64
	XrayVersion   string
	NodeVersion   string

	System *NodeSystem
}

// NodeConfigProfile — профиль ядра, выбранный ноде, и включённые у неё инбаунды.
type NodeConfigProfile struct {
	UUID     string
	Name     string
	Inbounds []NodeInbound
}

type NodeInbound struct {
	UUID string
	Tag  string
	Type string
	Port int
}

type NodeIP struct {
	IP     string
	Status string
}

// NodeSystem — «О системе»: железо и текущая нагрузка. nil — панель не прислала system.
type NodeSystem struct {
	Arch        string
	Platform    string
	CPUModel    string
	CPUs        int
	Kernel      string
	Hostname    string
	MemoryTotal float64
	MemoryUsed  float64
	UptimeSec   int64
	Interface   string
	RxPerSec    float64
	TxPerSec    float64
	RxTotal     float64
	TxTotal     float64
}

type nodeDetailWire struct {
	UUID                      string   `json:"uuid"`
	Name                      string   `json:"name"`
	Address                   string   `json:"address"`
	Port                      *int     `json:"port"`
	ProxyURL                  *string  `json:"proxyUrl"`
	IsConnected               bool     `json:"isConnected"`
	IsConnecting              bool     `json:"isConnecting"`
	IsDisabled                bool     `json:"isDisabled"`
	LastStatusChange          *string  `json:"lastStatusChange"`
	LastStatusMessage         *string  `json:"lastStatusMessage"`
	IsTrafficTrackingActive   bool     `json:"isTrafficTrackingActive"`
	TrafficResetDay           *int     `json:"trafficResetDay"`
	TrafficLimitBytes         *float64 `json:"trafficLimitBytes"`
	TrafficUsedBytes          *float64 `json:"trafficUsedBytes"`
	NotifyPercent             *int     `json:"notifyPercent"`
	CountryCode               string   `json:"countryCode"`
	ConsumptionMultiplier     float64  `json:"consumptionMultiplier"`
	NodeConsumptionMultiplier float64  `json:"nodeConsumptionMultiplier"`
	Tags                      []string `json:"tags"`
	IPs                       []struct {
		IP     string `json:"ip"`
		Status string `json:"status"`
	} `json:"ips"`
	ConfigProfile struct {
		ActiveConfigProfileUUID *string `json:"activeConfigProfileUuid"`
		// В ответе GET это объекты, а в теле PATCH — строки-uuid.
		ActiveInbounds []struct {
			UUID string   `json:"uuid"`
			Tag  string   `json:"tag"`
			Type string   `json:"type"`
			Port *float64 `json:"port"`
		} `json:"activeInbounds"`
	} `json:"configProfile"`
	ProviderUUID *string `json:"providerUuid"`
	Provider     *struct {
		Name        string  `json:"name"`
		FaviconLink *string `json:"faviconLink"`
	} `json:"provider"`
	ActivePluginUUID *string `json:"activePluginUuid"`
	System           *struct {
		Info struct {
			Arch        string  `json:"arch"`
			CPUs        int     `json:"cpus"`
			CPUModel    string  `json:"cpuModel"`
			MemoryTotal float64 `json:"memoryTotal"`
			Hostname    string  `json:"hostname"`
			Platform    string  `json:"platform"`
			Release     string  `json:"release"`
		} `json:"info"`
		Stats struct {
			MemoryUsed float64 `json:"memoryUsed"`
			Uptime     float64 `json:"uptime"`
			Interface  *struct {
				Interface     string  `json:"interface"`
				RxBytesPerSec float64 `json:"rxBytesPerSec"`
				TxBytesPerSec float64 `json:"txBytesPerSec"`
				RxTotal       float64 `json:"rxTotal"`
				TxTotal       float64 `json:"txTotal"`
			} `json:"interface"`
		} `json:"stats"`
	} `json:"system"`
	Versions *struct {
		Xray string `json:"xray"`
		Node string `json:"node"`
	} `json:"versions"`
	XrayUptime  *float64 `json:"xrayUptime"`
	UsersOnline *int     `json:"usersOnline"`
	Note        *string  `json:"note"`
}

type configProfilesWire struct {
	ConfigProfiles []struct {
		UUID     string `json:"uuid"`
		Name     string `json:"name"`
	} `json:"configProfiles"`
}

func strPtr(p *string) string {
	if p == nil {
		return ""
	}
	return strings.TrimSpace(*p)
}

func intPtr(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

func floatPtr(p *float64) int64 {
	if p == nil {
		return 0
	}
	return int64(*p)
}

func nodeDetailFromWire(n nodeDetailWire) NodeDetail {
	d := NodeDetail{
		UUID:                      n.UUID,
		Name:                      n.Name,
		CountryCode:               n.CountryCode,
		Address:                   n.Address,
		Port:                      intPtr(n.Port),
		ProxyURL:                  strPtr(n.ProxyURL),
		State:                     overviewState(nodeOverviewWire{IsConnected: n.IsConnected, IsConnecting: n.IsConnecting, IsDisabled: n.IsDisabled}),
		LastStatusMessage:         strPtr(n.LastStatusMessage),
		LastStatusChange:          strPtr(n.LastStatusChange),
		TrafficTracking:           n.IsTrafficTrackingActive,
		TrafficLimitBytes:         floatPtr(n.TrafficLimitBytes),
		TrafficUsedBytes:          floatPtr(n.TrafficUsedBytes),
		TrafficResetDay:           intPtr(n.TrafficResetDay),
		NotifyPercent:             intPtr(n.NotifyPercent),
		ConsumptionMultiplier:     n.ConsumptionMultiplier,
		NodeConsumptionMultiplier: n.NodeConsumptionMultiplier,
		Tags:                      n.Tags,
		Note:                      strPtr(n.Note),
		ProviderUUID:              strPtr(n.ProviderUUID),
		PluginUUID:                strPtr(n.ActivePluginUUID),
		UsersOnline:               intPtr(n.UsersOnline),
		XrayUptimeSec:             floatPtr(n.XrayUptime),
	}
	if n.Provider != nil {
		d.Provider = &NodeProvider{Name: n.Provider.Name, FaviconLink: strPtr(n.Provider.FaviconLink)}
	}
	for _, ip := range n.IPs {
		d.IPs = append(d.IPs, NodeIP{IP: ip.IP, Status: ip.Status})
	}
	if n.Versions != nil {
		d.XrayVersion, d.NodeVersion = n.Versions.Xray, n.Versions.Node
	}
	d.ConfigProfile.UUID = strPtr(n.ConfigProfile.ActiveConfigProfileUUID)
	for _, in := range n.ConfigProfile.ActiveInbounds {
		port := 0
		if in.Port != nil {
			port = int(*in.Port)
		}
		d.ConfigProfile.Inbounds = append(d.ConfigProfile.Inbounds, NodeInbound{UUID: in.UUID, Tag: in.Tag, Type: in.Type, Port: port})
	}
	if n.System != nil {
		s := &NodeSystem{
			Arch:        n.System.Info.Arch,
			Platform:    n.System.Info.Platform,
			CPUModel:    n.System.Info.CPUModel,
			CPUs:        n.System.Info.CPUs,
			Kernel:      n.System.Info.Release,
			Hostname:    n.System.Info.Hostname,
			MemoryTotal: n.System.Info.MemoryTotal,
			MemoryUsed:  n.System.Stats.MemoryUsed,
			UptimeSec:   int64(n.System.Stats.Uptime),
		}
		if i := n.System.Stats.Interface; i != nil {
			s.Interface, s.RxPerSec, s.TxPerSec, s.RxTotal, s.TxTotal = i.Interface, i.RxBytesPerSec, i.TxBytesPerSec, i.RxTotal, i.TxTotal
		}
		d.System = s
	}
	return d
}

// GetNodeDetail — GET /api/nodes/{uuid} плюс имя профиля ядра из GET /api/config-profiles.
// Профили необязательны: без них окно покажет uuid профиля вместо имени.
func (r *Client) GetNodeDetail(ctx context.Context, nodeUUID string) (*NodeDetail, error) {
	var resp apiResponse[nodeDetailWire]
	if err := r.doJSON(ctx, http.MethodGet, "/api/nodes/"+url.PathEscape(nodeUUID), nil, &resp); err != nil {
		return nil, err
	}
	d := nodeDetailFromWire(resp.Response)
	if d.ConfigProfile.UUID != "" {
		var pr apiResponse[configProfilesWire]
		if err := r.doJSON(ctx, http.MethodGet, "/api/config-profiles", nil, &pr); err == nil {
			for _, p := range pr.Response.ConfigProfiles {
				if strings.EqualFold(p.UUID, d.ConfigProfile.UUID) {
					d.ConfigProfile.Name = p.Name
					break
				}
			}
		}
	}
	return &d, nil
}

// Действия над нодой, которые панель принимает как POST /api/nodes/{uuid}/actions/<действие>.
const (
	NodeActionEnable       = "enable"
	NodeActionDisable      = "disable"
	NodeActionRestart      = "restart"
	NodeActionResetTraffic = "reset-traffic"
)

// NodeAction выполняет действие над нодой. Панель отвечает 202 без тела (фоновая операция).
func (r *Client) NodeAction(ctx context.Context, nodeUUID, action string) error {
	switch action {
	case NodeActionEnable, NodeActionDisable, NodeActionRestart, NodeActionResetTraffic:
	default:
		return fmt.Errorf("unknown node action %q", action)
	}
	return r.doJSON(ctx, http.MethodPost, "/api/nodes/"+url.PathEscape(nodeUUID)+"/actions/"+action, nil, nil)
}

// DeleteNode — DELETE /api/nodes/{uuid}.
func (r *Client) DeleteNode(ctx context.Context, nodeUUID string) error {
	return r.doJSON(ctx, http.MethodDelete, "/api/nodes/"+url.PathEscape(nodeUUID), nil, nil)
}
