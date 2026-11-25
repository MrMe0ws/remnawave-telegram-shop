package remnawave

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
)

// Host — хост панели (адрес, под которым пользователь подключается к ноде).
// Расширенные параметры (mux, sockopt, finalMask, xhttp) панель хранит произвольным JSON — так же отдаём их наружу.
type Host struct {
	UUID                   string
	Remark                 string
	Address                string
	Port                   int
	IsHidden               bool
	IsDisabled             bool
	Tags                   []string
	ConfigProfileUUID      string
	ConfigProfileInbound   string
	NodeUUIDs              []string
	SecurityLayer          string
	SNI                    *string
	Host                   *string
	Path                   *string
	Fingerprint            *string
	ALPN                   *string
	XrayJSONTemplateUUID   *string
	MuxParams              json.RawMessage
	SockoptParams          json.RawMessage
	FinalMask              json.RawMessage
	XHTTPExtraParams       json.RawMessage
	OverrideSNIFromAddress bool
	KeepSNIBlank           bool
	ShuffleHost            bool
	MihomoX25519           bool
	MihomoIPVersion        *string
	VlessRouteID           *int
	ServerDescription      *string
	PinnedPeerCert         []string
	VerifyPeerCertByName   []string
	// ExcludeFromSubscriptionTypes — типы подписок, из которых хост исключён (XRAY_JSON, MIHOMO …).
	ExcludeFromSubscriptionTypes []string
	// Mapper — произвольный JSON правил переписывания outbound по типам клиентов.
	Mapper json.RawMessage
	// InternalSquadsMode/InternalSquads — ограничение хоста внутренними сквадами (EXCLUDE | ALLOW_ONLY).
	InternalSquadsMode string
	InternalSquads     []string
}

type hostWire struct {
	UUID       string   `json:"uuid"`
	Remark     string   `json:"remark"`
	Address    string   `json:"address"`
	Port       int      `json:"port"`
	IsHidden   bool     `json:"isHidden"`
	IsDisabled bool     `json:"isDisabled"`
	Tags       []string `json:"tags"`
	Inbound    struct {
		ConfigProfileUUID        string `json:"configProfileUuid"`
		ConfigProfileInboundUUID string `json:"configProfileInboundUuid"`
	} `json:"inbound"`
	Nodes                  []string        `json:"nodes"`
	SecurityLayer          string          `json:"securityLayer"`
	SNI                    *string         `json:"sni"`
	Host                   *string         `json:"host"`
	Path                   *string         `json:"path"`
	Fingerprint            *string         `json:"fingerprint"`
	ALPN                   *string         `json:"alpn"`
	XrayJSONTemplateUUID   *string         `json:"xrayJsonTemplateUuid"`
	MuxParams              json.RawMessage `json:"muxParams"`
	SockoptParams          json.RawMessage `json:"sockoptParams"`
	FinalMask              json.RawMessage `json:"finalMask"`
	XHTTPExtraParams       json.RawMessage `json:"xhttpExtraParams"`
	OverrideSNIFromAddress bool            `json:"overrideSniFromAddress"`
	KeepSNIBlank           bool            `json:"keepSniBlank"`
	ShuffleHost            bool            `json:"shuffleHost"`
	MihomoX25519           bool            `json:"mihomoX25519"`
	MihomoIPVersion        *string         `json:"mihomoIpVersion"`
	VlessRouteID           *int            `json:"vlessRouteId"`
	ServerDescription      *string         `json:"serverDescription"`
	PinnedPeerCert         []string        `json:"pinnedPeerCertSha256"`
	VerifyPeerCertByName   []string        `json:"verifyPeerCertByName"`
	ExcludeFromSubscriptionTypes []string  `json:"excludeFromSubscriptionTypes"`
	Mapper                 json.RawMessage `json:"mapper"`
	InternalSquads         struct {
		Mode   string   `json:"mode"`
		Squads []string `json:"squads"`
	} `json:"internalSquads"`
}

func hostFromWire(w hostWire) Host {
	return Host{
		UUID: w.UUID, Remark: w.Remark, Address: w.Address, Port: w.Port, IsHidden: w.IsHidden, IsDisabled: w.IsDisabled, Tags: w.Tags,
		ConfigProfileUUID: w.Inbound.ConfigProfileUUID, ConfigProfileInbound: w.Inbound.ConfigProfileInboundUUID,
		NodeUUIDs: w.Nodes, SecurityLayer: w.SecurityLayer, SNI: w.SNI, Host: w.Host, Path: w.Path, Fingerprint: w.Fingerprint,
		ALPN: w.ALPN, XrayJSONTemplateUUID: w.XrayJSONTemplateUUID,
		MuxParams: w.MuxParams, SockoptParams: w.SockoptParams, FinalMask: w.FinalMask, XHTTPExtraParams: w.XHTTPExtraParams,
		OverrideSNIFromAddress: w.OverrideSNIFromAddress, KeepSNIBlank: w.KeepSNIBlank, ShuffleHost: w.ShuffleHost, MihomoX25519: w.MihomoX25519,
		MihomoIPVersion: w.MihomoIPVersion, VlessRouteID: w.VlessRouteID, ServerDescription: w.ServerDescription,
		PinnedPeerCert: w.PinnedPeerCert, VerifyPeerCertByName: w.VerifyPeerCertByName,
		ExcludeFromSubscriptionTypes: w.ExcludeFromSubscriptionTypes, Mapper: w.Mapper,
		InternalSquadsMode: w.InternalSquads.Mode, InternalSquads: w.InternalSquads.Squads,
	}
}

// ListHosts — GET /api/hosts (ответ панели — массив).
func (r *Client) ListHosts(ctx context.Context) ([]Host, error) {
	var resp apiResponse[[]hostWire]
	if err := r.doJSON(ctx, http.MethodGet, "/api/hosts", nil, &resp); err != nil {
		return nil, err
	}
	out := make([]Host, 0, len(resp.Response))
	for _, w := range resp.Response {
		out = append(out, hostFromWire(w))
	}
	return out, nil
}

// GetHost — GET /api/hosts/{uuid}.
func (r *Client) GetHost(ctx context.Context, hostUUID string) (*Host, error) {
	var resp apiResponse[hostWire]
	if err := r.doJSON(ctx, http.MethodGet, "/api/hosts/"+url.PathEscape(hostUUID), nil, &resp); err != nil {
		return nil, err
	}
	h := hostFromWire(resp.Response)
	return &h, nil
}

// PatchHost — PATCH /api/hosts: меняет только присланные поля (имена панели, camelCase).
func (r *Client) PatchHost(ctx context.Context, hostUUID string, fields map[string]any) error {
	body := make(map[string]any, len(fields)+1)
	for k, v := range fields {
		body[k] = v
	}
	body["uuid"] = hostUUID
	return r.doJSON(ctx, http.MethodPatch, "/api/hosts", body, nil)
}

// DeleteHost — DELETE /api/hosts/{uuid}.
func (r *Client) DeleteHost(ctx context.Context, hostUUID string) error {
	return r.doJSON(ctx, http.MethodDelete, "/api/hosts/"+url.PathEscape(hostUUID), nil, nil)
}

type XrayTemplate struct{ UUID, Name string }

// ListXrayTemplates — шаблоны Xray JSON из GET /api/subscription-templates.
func (r *Client) ListXrayTemplates(ctx context.Context) ([]XrayTemplate, error) {
	var resp apiResponse[struct {
		Templates []struct {
			UUID         string `json:"uuid"`
			Name         string `json:"name"`
			TemplateType string `json:"templateType"`
		} `json:"templates"`
	}]
	if err := r.doJSON(ctx, http.MethodGet, "/api/subscription-templates", nil, &resp); err != nil {
		return nil, err
	}
	var out []XrayTemplate
	for _, t := range resp.Response.Templates {
		if strings.EqualFold(t.TemplateType, "XRAY_JSON") {
			out = append(out, XrayTemplate{UUID: t.UUID, Name: t.Name})
		}
	}
	return out, nil
}
