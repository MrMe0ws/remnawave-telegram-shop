package remnawave

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Правка ноды, справочники, секретный ключ, метаданные
// ---------------------------------------------------------------------------

// PatchNode — PATCH /api/nodes: меняет только присланные поля. fields — уже в именах панели (camelCase).
func (r *Client) PatchNode(ctx context.Context, nodeUUID string, fields map[string]any) error {
	body := make(map[string]any, len(fields)+1)
	for k, v := range fields {
		body[k] = v
	}
	body["uuid"] = nodeUUID
	return r.doJSON(ctx, http.MethodPatch, "/api/nodes", body, nil)
}

// GetNodeSecretKey — GET /api/keygen: SECRET_KEY для установки ноды (один на панель).
func (r *Client) GetNodeSecretKey(ctx context.Context) (string, error) {
	var resp apiResponse[struct {
		SecretKey string `json:"secretKey"`
	}]
	if err := r.doJSON(ctx, http.MethodGet, "/api/keygen", nil, &resp); err != nil {
		return "", err
	}
	return resp.Response.SecretKey, nil
}

// GetNodeMetadata — GET /api/metadata/node/{uuid}: произвольный JSON, который админ положил ноде.
func (r *Client) GetNodeMetadata(ctx context.Context, nodeUUID string) (json.RawMessage, error) {
	var resp apiResponse[struct {
		Metadata json.RawMessage `json:"metadata"`
	}]
	if err := r.doJSON(ctx, http.MethodGet, "/api/metadata/node/"+url.PathEscape(nodeUUID), nil, &resp); err != nil {
		// Панель отвечает 404, пока у ноды нет метаданных: для окна это «пусто», а не сбой.
		if errors.Is(err, ErrNotFound) {
			return json.RawMessage("null"), nil
		}
		return nil, err
	}
	if len(resp.Response.Metadata) == 0 {
		return json.RawMessage("null"), nil
	}
	return resp.Response.Metadata, nil
}

type NodeOptionPlugin struct{ UUID, Name string }
type NodeOptionProvider struct{ UUID, Name, FaviconLink string }

// NodeOptions — справочники для селектов ноды. Каждый грузится независимо: сбой одного не роняет остальные.
type NodeOptions struct {
	Plugins   []NodeOptionPlugin
	Providers []NodeOptionProvider
	Tags      []string
}

func (r *Client) GetNodeOptions(ctx context.Context) NodeOptions {
	var out NodeOptions
	var pr apiResponse[nodePluginsWire]
	if err := r.doJSON(ctx, http.MethodGet, "/api/node-plugins", nil, &pr); err == nil {
		for _, p := range pr.Response.NodePlugins {
			out.Plugins = append(out.Plugins, NodeOptionPlugin{UUID: p.UUID, Name: p.Name})
		}
	}
	var pv apiResponse[struct {
		Providers []struct {
			UUID        string  `json:"uuid"`
			Name        string  `json:"name"`
			FaviconLink *string `json:"faviconLink"`
		} `json:"providers"`
	}]
	if err := r.doJSON(ctx, http.MethodGet, "/api/infra-billing/providers", nil, &pv); err == nil {
		for _, p := range pv.Response.Providers {
			out.Providers = append(out.Providers, NodeOptionProvider{UUID: p.UUID, Name: p.Name, FaviconLink: strPtr(p.FaviconLink)})
		}
	}
	var tg apiResponse[struct {
		Tags []string `json:"tags"`
	}]
	if err := r.doJSON(ctx, http.MethodGet, "/api/nodes/tags", nil, &tg); err == nil {
		out.Tags = tg.Response.Tags
	}
	return out
}

type ConfigProfileInbound struct {
	UUID string
	Tag  string
	Type string
	Port int
	// Raw — полный конфиг инбаунда из Xray-конфига профиля (только чтение).
	Raw json.RawMessage
}

type ConfigProfile struct {
	UUID     string
	Name     string
	Inbounds []ConfigProfileInbound
	// NodeCount — на скольких нодах профиль выбран («активен на нодах»).
	NodeCount int
}

func (r *Client) ListConfigProfiles(ctx context.Context) ([]ConfigProfile, error) {
	var resp apiResponse[struct {
		ConfigProfiles []struct {
			UUID     string `json:"uuid"`
			Name     string `json:"name"`
			Inbounds []struct {
				UUID string   `json:"uuid"`
				Tag  string   `json:"tag"`
				Type string   `json:"type"`
				Port *float64 `json:"port"`
				Raw  json.RawMessage `json:"rawInbound"`
			} `json:"inbounds"`
			Nodes []struct {
				UUID string `json:"uuid"`
			} `json:"nodes"`
		} `json:"configProfiles"`
	}]
	if err := r.doJSON(ctx, http.MethodGet, "/api/config-profiles", nil, &resp); err != nil {
		return nil, err
	}
	out := make([]ConfigProfile, 0, len(resp.Response.ConfigProfiles))
	for _, p := range resp.Response.ConfigProfiles {
		cp := ConfigProfile{UUID: p.UUID, Name: p.Name, NodeCount: len(p.Nodes)}
		for _, in := range p.Inbounds {
			port := 0
			if in.Port != nil {
				port = int(*in.Port)
			}
			cp.Inbounds = append(cp.Inbounds, ConfigProfileInbound{UUID: in.UUID, Tag: in.Tag, Type: in.Type, Port: port, Raw: in.Raw})
		}
		out = append(out, cp)
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Статистика трафика ноды по пользователям
// ---------------------------------------------------------------------------

type NodeUsageUser struct {
	Username string
	Color    string
	Total    float64
}

type NodeUsage struct {
	Sparkline []float64
	TopUsers  []NodeUsageUser
}

// GetNodeUsage — GET /api/bandwidth-stats/nodes/{uuid}/users. Панель принимает только даты YYYY-MM-DD (не время).
func (r *Client) GetNodeUsage(ctx context.Context, nodeUUID, start, end string, top int) (*NodeUsage, error) {
	q := url.Values{}
	q.Set("start", start)
	q.Set("end", end)
	if top > 0 {
		q.Set("topUsersLimit", fmt.Sprint(top))
	}
	var resp apiResponse[struct {
		SparklineData []float64 `json:"sparklineData"`
		TopUsers      []struct {
			Color    string  `json:"color"`
			Username string  `json:"username"`
			Total    float64 `json:"total"`
		} `json:"topUsers"`
	}]
	if err := r.doJSON(ctx, http.MethodGet, "/api/bandwidth-stats/nodes/"+url.PathEscape(nodeUUID)+"/users?"+q.Encode(), nil, &resp); err != nil {
		return nil, err
	}
	out := &NodeUsage{Sparkline: resp.Response.SparklineData}
	for _, u := range resp.Response.TopUsers {
		out.TopUsers = append(out.TopUsers, NodeUsageUser{Username: u.Username, Color: u.Color, Total: u.Total})
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Активные сессии ноды (задача панели: запросить, затем опрашивать)
// ---------------------------------------------------------------------------

type NodeSessionIP struct {
	IP       string
	LastSeen string
}

type NodeSessionUser struct {
	UserID int64
	IPs    []NodeSessionIP
}

// GetNodeSessions запускает POST /api/connections/by-node/{uuid} и ждёт результат задачи до timeout.
// Нода не в сети, задача упала или не уложилась в срок — отдаём пустой список, а не ошибку:
// для окна «нет сессий» и «не удалось узнать» выглядят одинаково безобидно, повтор — кнопкой «обновить».
func (r *Client) GetNodeSessions(ctx context.Context, nodeUUID string, timeout time.Duration) ([]NodeSessionUser, error) {
	var job apiResponse[struct {
		JobID string `json:"jobId"`
	}]
	if err := r.doJSON(ctx, http.MethodPost, "/api/connections/by-node/"+url.PathEscape(nodeUUID), nil, &job); err != nil {
		return nil, err
	}
	if strings.TrimSpace(job.Response.JobID) == "" {
		return nil, errors.New("panel returned empty job id")
	}
	deadline := time.Now().Add(timeout)
	for {
		var res apiResponse[struct {
			IsCompleted bool `json:"isCompleted"`
			IsFailed    bool `json:"isFailed"`
			Result      *struct {
				Users []struct {
					UserID float64 `json:"userId"`
					IPs    []struct {
						IP       string `json:"ip"`
						LastSeen string `json:"lastSeen"`
					} `json:"ips"`
				} `json:"users"`
			} `json:"result"`
		}]
		if err := r.doJSON(ctx, http.MethodGet, "/api/connections/by-node/"+url.PathEscape(job.Response.JobID), nil, &res); err != nil {
			return nil, err
		}
		if res.Response.IsFailed {
			return nil, nil
		}
		if res.Response.IsCompleted {
			var out []NodeSessionUser
			if res.Response.Result != nil {
				for _, u := range res.Response.Result.Users {
					su := NodeSessionUser{UserID: int64(u.UserID)}
					for _, ip := range u.IPs {
						su.IPs = append(su.IPs, NodeSessionIP{IP: ip.IP, LastSeen: ip.LastSeen})
					}
					out = append(out, su)
				}
			}
			return out, nil
		}
		if time.Now().After(deadline) {
			return nil, nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}
}
