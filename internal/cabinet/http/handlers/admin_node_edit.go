package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"remnawave-tg-shop-bot/internal/remnawave"
)

// ---------------------------------------------------------------------------
// Разбор частичных правок: JSON кабинета (snake_case) → тело панели (camelCase)
// ---------------------------------------------------------------------------

type fieldKind int

const (
	kStr           fieldKind = iota // непустая строка
	kStrNullable                    // строка, "" → null
	kInt                            // целое в [min,max]
	kNum                            // число в [min,max]
	kBool                           // bool
	kStrArr                         // []string
	kUUIDNullable                   // uuid или "" → null
	kUUIDArr                        // []uuid
	kRaw                            // произвольный JSON или null
	kEnum                           // одно из значений
	kEnumNullable                   // одно из значений или null
	kIntNullable                    // целое или null
	kCountry                        // две буквы
	kProxyOrNilStr                  // как kStrNullable, но без пробелов по краям
	kEnumArr                        // []string, каждый элемент из enum
)

type fieldSpec struct {
	panel string
	kind  fieldKind
	min   float64
	max   float64
	enum  []string
}

var countryRe = regexp.MustCompile(`^[A-Za-z]{2}$`)

var errBadField = errors.New("bad field")

func badField(name, why string) error { return fmt.Errorf("%w: %s: %s", errBadField, name, why) }

// convertFields проверяет присланные поля по таблице и собирает тело для панели. Неизвестное поле — ошибка:
// молча игнорировать нельзя, иначе опечатка во фронте выглядела бы как «сохранилось».
func convertFields(body map[string]json.RawMessage, table map[string]fieldSpec) (map[string]any, error) {
	out := make(map[string]any, len(body))
	for key, raw := range body {
		spec, ok := table[key]
		if !ok {
			return nil, badField(key, "unknown")
		}
		v, err := convertValue(key, raw, spec)
		if err != nil {
			return nil, err
		}
		out[spec.panel] = v
	}
	return out, nil
}

func convertValue(key string, raw json.RawMessage, s fieldSpec) (any, error) {
	isNull := strings.TrimSpace(string(raw)) == "null"
	switch s.kind {
	case kStr, kStrNullable, kProxyOrNilStr:
		var v string
		if err := json.Unmarshal(raw, &v); err != nil {
			return nil, badField(key, "string expected")
		}
		v = strings.TrimSpace(v)
		if s.kind == kStr {
			if v == "" || len(v) > 255 {
				return nil, badField(key, "empty or too long")
			}
			return v, nil
		}
		if len(v) > 4096 {
			return nil, badField(key, "too long")
		}
		if v == "" {
			return nil, nil
		}
		return v, nil
	case kCountry:
		var v string
		if err := json.Unmarshal(raw, &v); err != nil || !countryRe.MatchString(v) {
			return nil, badField(key, "two-letter code expected")
		}
		return strings.ToUpper(v), nil
	case kInt, kIntNullable:
		if s.kind == kIntNullable && isNull {
			return nil, nil
		}
		var v float64
		if err := json.Unmarshal(raw, &v); err != nil || v != float64(int64(v)) || v < s.min || v > s.max {
			return nil, badField(key, "integer out of range")
		}
		return int64(v), nil
	case kNum:
		var v float64
		if err := json.Unmarshal(raw, &v); err != nil || v < s.min || v > s.max {
			return nil, badField(key, "number out of range")
		}
		return v, nil
	case kBool:
		var v bool
		if err := json.Unmarshal(raw, &v); err != nil {
			return nil, badField(key, "bool expected")
		}
		return v, nil
	case kStrArr:
		var v []string
		if isNull {
			return []string{}, nil
		}
		if err := json.Unmarshal(raw, &v); err != nil || len(v) > 100 {
			return nil, badField(key, "string array expected")
		}
		clean := make([]string, 0, len(v))
		for _, it := range v {
			it = strings.TrimSpace(it)
			if it == "" || len(it) > 255 {
				return nil, badField(key, "empty or too long item")
			}
			clean = append(clean, it)
		}
		return clean, nil
	case kUUIDNullable:
		if isNull {
			return nil, nil
		}
		var v string
		if err := json.Unmarshal(raw, &v); err != nil {
			return nil, badField(key, "uuid expected")
		}
		if strings.TrimSpace(v) == "" {
			return nil, nil
		}
		id, err := uuid.Parse(v)
		if err != nil {
			return nil, badField(key, "invalid uuid")
		}
		return id.String(), nil
	case kUUIDArr:
		var v []string
		if isNull {
			return []string{}, nil
		}
		if err := json.Unmarshal(raw, &v); err != nil || len(v) > 500 {
			return nil, badField(key, "uuid array expected")
		}
		out := make([]string, 0, len(v))
		for _, it := range v {
			id, err := uuid.Parse(it)
			if err != nil {
				return nil, badField(key, "invalid uuid")
			}
			out = append(out, id.String())
		}
		return out, nil
	case kEnumArr:
		var v []string
		if isNull {
			return []string{}, nil
		}
		if err := json.Unmarshal(raw, &v); err != nil || len(v) > 20 {
			return nil, badField(key, "string array expected")
		}
		for _, it := range v {
			ok := false
			for _, e := range s.enum {
				if it == e {
					ok = true
				}
			}
			if !ok {
				return nil, badField(key, "unsupported value")
			}
		}
		return v, nil
	case kRaw:
		if isNull {
			return nil, nil
		}
		if len(raw) > 64<<10 || !json.Valid(raw) {
			return nil, badField(key, "invalid json")
		}
		return json.RawMessage(raw), nil
	case kEnum, kEnumNullable:
		if s.kind == kEnumNullable && isNull {
			return nil, nil
		}
		var v string
		if err := json.Unmarshal(raw, &v); err != nil {
			return nil, badField(key, "string expected")
		}
		for _, e := range s.enum {
			if v == e {
				return v, nil
			}
		}
		return nil, badField(key, "unsupported value")
	}
	return nil, badField(key, "unsupported kind")
}

var nodePatchTable = map[string]fieldSpec{
	"name":                        {panel: "name", kind: kStr},
	"country_code":                {panel: "countryCode", kind: kCountry},
	"address":                     {panel: "address", kind: kStr},
	"port":                        {panel: "port", kind: kInt, min: 1, max: 65535},
	"proxy_url":                   {panel: "proxyUrl", kind: kProxyOrNilStr},
	"consumption_multiplier":      {panel: "consumptionMultiplier", kind: kNum, min: 0, max: 100},
	"node_consumption_multiplier": {panel: "nodeConsumptionMultiplier", kind: kNum, min: 0, max: 100},
	"traffic_tracking":            {panel: "isTrafficTrackingActive", kind: kBool},
	"traffic_limit_bytes":         {panel: "trafficLimitBytes", kind: kInt, min: 0, max: 1 << 60},
	"traffic_reset_day":           {panel: "trafficResetDay", kind: kInt, min: 0, max: 31},
	"notify_percent":              {panel: "notifyPercent", kind: kInt, min: 0, max: 100},
	"provider_uuid":               {panel: "providerUuid", kind: kUUIDNullable},
	"plugin_uuid":                 {panel: "activePluginUuid", kind: kUUIDNullable},
	"tags":                        {panel: "tags", kind: kStrArr},
	"note":                        {panel: "note", kind: kStrNullable},
}

// nodePatchFields: таблица + особое поле config_profile {uuid, inbound_uuids}.
func nodePatchFields(body map[string]json.RawMessage) (map[string]any, error) {
	var cp json.RawMessage
	if raw, ok := body["config_profile"]; ok {
		cp = raw
		rest := make(map[string]json.RawMessage, len(body))
		for k, v := range body {
			if k != "config_profile" {
				rest[k] = v
			}
		}
		body = rest
	}
	out, err := convertFields(body, nodePatchTable)
	if err != nil {
		return nil, err
	}
	if cp != nil {
		var v struct {
			UUID         string   `json:"uuid"`
			InboundUUIDs []string `json:"inbound_uuids"`
		}
		if err := json.Unmarshal(cp, &v); err != nil {
			return nil, badField("config_profile", "object expected")
		}
		pid, err := uuid.Parse(v.UUID)
		if err != nil {
			return nil, badField("config_profile.uuid", "invalid uuid")
		}
		ins := make([]string, 0, len(v.InboundUUIDs))
		for _, s := range v.InboundUUIDs {
			id, err := uuid.Parse(s)
			if err != nil {
				return nil, badField("config_profile.inbound_uuids", "invalid uuid")
			}
			ins = append(ins, id.String())
		}
		out["configProfile"] = map[string]any{"activeConfigProfileUuid": pid.String(), "activeInbounds": ins}
	}
	if len(out) == 0 {
		return nil, badField("body", "nothing to change")
	}
	return out, nil
}

var hostPatchTable = map[string]fieldSpec{
	"remark":                    {panel: "remark", kind: kStr},
	"address":                   {panel: "address", kind: kStr},
	"port":                      {panel: "port", kind: kInt, min: 0, max: 65535},
	"is_hidden":                 {panel: "isHidden", kind: kBool},
	"is_disabled":               {panel: "isDisabled", kind: kBool},
	"tags":                      {panel: "tags", kind: kStrArr},
	"node_uuids":                {panel: "nodes", kind: kUUIDArr},
	"security_layer":            {panel: "securityLayer", kind: kEnum, enum: []string{"DEFAULT", "TLS", "NONE"}},
	"sni":                       {panel: "sni", kind: kStrNullable},
	"host":                      {panel: "host", kind: kStrNullable},
	"path":                      {panel: "path", kind: kStrNullable},
	"fingerprint":               {panel: "fingerprint", kind: kStrNullable},
	"alpn":                      {panel: "alpn", kind: kEnumNullable, enum: []string{"h3", "h2", "http/1.1", "h2,http/1.1", "h3,h2,http/1.1", "h3,h2"}},
	"xray_json_template_uuid":   {panel: "xrayJsonTemplateUuid", kind: kUUIDNullable},
	"mux_params":                {panel: "muxParams", kind: kRaw},
	"sockopt_params":            {panel: "sockoptParams", kind: kRaw},
	"final_mask":                {panel: "finalMask", kind: kRaw},
	"xhttp_extra_params":        {panel: "xhttpExtraParams", kind: kRaw},
	"override_sni_from_address": {panel: "overrideSniFromAddress", kind: kBool},
	"keep_sni_blank":            {panel: "keepSniBlank", kind: kBool},
	"shuffle_host":              {panel: "shuffleHost", kind: kBool},
	"mihomo_x25519":             {panel: "mihomoX25519", kind: kBool},
	"mihomo_ip_version":         {panel: "mihomoIpVersion", kind: kEnumNullable, enum: []string{"dual", "ipv4", "ipv6", "ipv4-prefer", "ipv6-prefer"}},
	"vless_route_id":            {panel: "vlessRouteId", kind: kIntNullable, min: 0, max: 65535},
	"server_description":        {panel: "serverDescription", kind: kStrNullable},
	"pinned_peer_cert_sha256":   {panel: "pinnedPeerCertSha256", kind: kStrArr},
	"verify_peer_cert_by_name":  {panel: "verifyPeerCertByName", kind: kStrArr},
	"mapper":                    {panel: "mapper", kind: kRaw},
	"exclude_from_subscription_types": {panel: "excludeFromSubscriptionTypes", kind: kEnumArr, enum: []string{"XRAY_JSON", "XRAY_BASE64", "MIHOMO", "STASH", "CLASH", "SINGBOX"}},
}

func hostPatchFields(body map[string]json.RawMessage) (map[string]any, error) {
	var sq json.RawMessage
	if raw, ok := body["internal_squads"]; ok {
		sq = raw
		rest := make(map[string]json.RawMessage, len(body))
		for k, v := range body {
			if k != "internal_squads" {
				rest[k] = v
			}
		}
		body = rest
	}
	var inb json.RawMessage
	if raw, ok := body["inbound"]; ok {
		inb = raw
		rest := make(map[string]json.RawMessage, len(body))
		for k, v := range body {
			if k != "inbound" {
				rest[k] = v
			}
		}
		body = rest
	}
	out, err := convertFields(body, hostPatchTable)
	if err != nil {
		return nil, err
	}
	if sq != nil {
		var v struct {
			Mode   string   `json:"mode"`
			Squads []string `json:"squads"`
		}
		if err := json.Unmarshal(sq, &v); err != nil || (v.Mode != "EXCLUDE" && v.Mode != "ALLOW_ONLY") || len(v.Squads) > 200 {
			return nil, badField("internal_squads", "mode EXCLUDE|ALLOW_ONLY and squads expected")
		}
		ids := make([]string, 0, len(v.Squads))
		for _, s := range v.Squads {
			id, err := uuid.Parse(s)
			if err != nil {
				return nil, badField("internal_squads", "invalid uuid")
			}
			ids = append(ids, id.String())
		}
		out["internalSquads"] = map[string]any{"mode": v.Mode, "squads": ids}
	}
	if inb != nil {
		var v struct {
			ConfigProfileUUID string `json:"config_profile_uuid"`
			InboundUUID       string `json:"inbound_uuid"`
		}
		if err := json.Unmarshal(inb, &v); err != nil {
			return nil, badField("inbound", "object expected")
		}
		pid, err1 := uuid.Parse(v.ConfigProfileUUID)
		iid, err2 := uuid.Parse(v.InboundUUID)
		if err1 != nil || err2 != nil {
			return nil, badField("inbound", "invalid uuid")
		}
		out["inbound"] = map[string]any{"configProfileUuid": pid.String(), "configProfileInboundUuid": iid.String()}
	}
	if len(out) == 0 {
		return nil, badField("body", "nothing to change")
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// DTO хоста
// ---------------------------------------------------------------------------

type adminHostInboundDTO struct {
	ConfigProfileUUID string `json:"config_profile_uuid"`
	InboundUUID       string `json:"inbound_uuid"`
	ProfileName       string `json:"profile_name,omitempty"`
	InboundTag        string `json:"inbound_tag,omitempty"`
}

type adminHostDTO struct {
	UUID                   string              `json:"uuid"`
	Remark                 string              `json:"remark"`
	Address                string              `json:"address"`
	Port                   int                 `json:"port"`
	IsHidden               bool                `json:"is_hidden"`
	IsDisabled             bool                `json:"is_disabled"`
	Tags                   []string            `json:"tags"`
	Inbound                adminHostInboundDTO `json:"inbound"`
	NodeUUIDs              []string            `json:"node_uuids"`
	SecurityLayer          string              `json:"security_layer"`
	SNI                    *string             `json:"sni"`
	Host                   *string             `json:"host"`
	Path                   *string             `json:"path"`
	Fingerprint            *string             `json:"fingerprint"`
	ALPN                   *string             `json:"alpn"`
	XrayJSONTemplateUUID   *string             `json:"xray_json_template_uuid"`
	MuxParams              json.RawMessage     `json:"mux_params"`
	SockoptParams          json.RawMessage     `json:"sockopt_params"`
	FinalMask              json.RawMessage     `json:"final_mask"`
	XHTTPExtraParams       json.RawMessage     `json:"xhttp_extra_params"`
	OverrideSNIFromAddress bool                `json:"override_sni_from_address"`
	KeepSNIBlank           bool                `json:"keep_sni_blank"`
	ShuffleHost            bool                `json:"shuffle_host"`
	MihomoX25519           bool                `json:"mihomo_x25519"`
	MihomoIPVersion        *string             `json:"mihomo_ip_version"`
	VlessRouteID           *int                `json:"vless_route_id"`
	ServerDescription      *string             `json:"server_description"`
	PinnedPeerCert         []string            `json:"pinned_peer_cert_sha256"`
	VerifyPeerCertByName   []string            `json:"verify_peer_cert_by_name"`
	ExcludeFromSubTypes    []string            `json:"exclude_from_subscription_types"`
	Mapper                 json.RawMessage     `json:"mapper"`
	InternalSquads         adminHostSquadsDTO  `json:"internal_squads"`
	Features               []string            `json:"features"`
}

type adminHostSquadsDTO struct {
	Mode   string   `json:"mode"`
	Squads []string `json:"squads"`
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func rawOrNull(r json.RawMessage) json.RawMessage {
	if len(r) == 0 {
		return json.RawMessage("null")
	}
	return r
}

func hasRaw(r json.RawMessage) bool {
	t := strings.TrimSpace(string(r))
	return t != "" && t != "null" && t != "{}"
}

// hostFeatures — ключи значков хоста в порядке показа (см. API-CONTRACT.md).
func hostFeatures(h remnawave.Host) []string {
	f := []string{}
	add := func(cond bool, key string) {
		if cond {
			f = append(f, key)
		}
	}
	add(h.XrayJSONTemplateUUID != nil && *h.XrayJSONTemplateUUID != "", "xray_template")
	add(hasRaw(h.MuxParams), "mux")
	add(hasRaw(h.SockoptParams), "sockopt")
	add(hasRaw(h.FinalMask), "final_mask")
	add(hasRaw(h.XHTTPExtraParams), "xhttp_extra")
	add(h.ShuffleHost, "shuffle_host")
	add(h.MihomoX25519, "mihomo_x25519")
	add(h.OverrideSNIFromAddress, "override_sni")
	add(h.KeepSNIBlank, "keep_sni_blank")
	add(h.VlessRouteID != nil, "vless_route")
	add(len(h.PinnedPeerCert) > 0, "pinned_cert")
	add(len(h.VerifyPeerCertByName) > 0, "verify_cert_name")
	return f
}

func hostToDTO(h remnawave.Host, profiles []remnawave.ConfigProfile) adminHostDTO {
	in := adminHostInboundDTO{ConfigProfileUUID: h.ConfigProfileUUID, InboundUUID: h.ConfigProfileInbound}
	for _, p := range profiles {
		if !strings.EqualFold(p.UUID, h.ConfigProfileUUID) {
			continue
		}
		in.ProfileName = p.Name
		for _, ib := range p.Inbounds {
			if strings.EqualFold(ib.UUID, h.ConfigProfileInbound) {
				in.InboundTag = ib.Tag
			}
		}
	}
	return adminHostDTO{
		UUID: h.UUID, Remark: h.Remark, Address: h.Address, Port: h.Port, IsHidden: h.IsHidden, IsDisabled: h.IsDisabled,
		Tags: nonNil(h.Tags), Inbound: in, NodeUUIDs: nonNil(h.NodeUUIDs), SecurityLayer: h.SecurityLayer,
		SNI: h.SNI, Host: h.Host, Path: h.Path, Fingerprint: h.Fingerprint,
		ALPN: h.ALPN, XrayJSONTemplateUUID: h.XrayJSONTemplateUUID,
		MuxParams: rawOrNull(h.MuxParams), SockoptParams: rawOrNull(h.SockoptParams), FinalMask: rawOrNull(h.FinalMask), XHTTPExtraParams: rawOrNull(h.XHTTPExtraParams),
		OverrideSNIFromAddress: h.OverrideSNIFromAddress, KeepSNIBlank: h.KeepSNIBlank, ShuffleHost: h.ShuffleHost, MihomoX25519: h.MihomoX25519,
		MihomoIPVersion: h.MihomoIPVersion, VlessRouteID: h.VlessRouteID, ServerDescription: h.ServerDescription,
		PinnedPeerCert: nonNil(h.PinnedPeerCert), VerifyPeerCertByName: nonNil(h.VerifyPeerCertByName),
		ExcludeFromSubTypes: nonNil(h.ExcludeFromSubscriptionTypes), Mapper: rawOrNull(h.Mapper),
		InternalSquads: adminHostSquadsDTO{Mode: h.InternalSquadsMode, Squads: nonNil(h.InternalSquads)},
		Features: hostFeatures(h),
	}
}

func hasNode(h remnawave.Host, nodeUUID string) bool {
	for _, n := range h.NodeUUIDs {
		if strings.EqualFold(n, nodeUUID) {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Ручки
// ---------------------------------------------------------------------------

func decodeBody(w http.ResponseWriter, r *http.Request) (map[string]json.RawMessage, bool) {
	var body map[string]json.RawMessage
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<18)).Decode(&body); err != nil || body == nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return nil, false
	}
	return body, true
}

func (h *AdminNodesHandler) patchNode(w http.ResponseWriter, r *http.Request, nodeID string) {
	body, ok := decodeBody(w, r)
	if !ok {
		return
	}
	fields, err := nodePatchFields(body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.rw.PatchNode(r.Context(), nodeID, fields); err != nil {
		slog.Error("admin nodes: patch", "node", nodeID, "error", err)
		http.Error(w, "failed to update node", http.StatusBadGateway)
		return
	}
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	slog.Info("admin nodes: patched", "node", nodeID, "fields", keys)
	h.invalidate()
	d, err := h.rw.GetNodeDetail(r.Context(), nodeID)
	if err != nil {
		slog.Error("admin nodes: patch: reload", "node", nodeID, "error", err)
		http.Error(w, "failed to fetch node", http.StatusBadGateway)
		return
	}
	if h.demo {
		dd := demoDetail(*d)
		d = &dd
	}
	writeJSON(w, http.StatusOK, nodeDetailToDTO(*d))
}

func (h *AdminNodesHandler) secretKey(w http.ResponseWriter, r *http.Request) {
	k, err := h.rw.GetNodeSecretKey(r.Context())
	if err != nil {
		slog.Error("admin nodes: secret key", "error", err)
		http.Error(w, "failed to fetch key", http.StatusBadGateway)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]string{"secret_key": k})
}

func (h *AdminNodesHandler) metadata(w http.ResponseWriter, r *http.Request, nodeID string) {
	m, err := h.rw.GetNodeMetadata(r.Context(), nodeID)
	if err != nil {
		slog.Error("admin nodes: metadata", "node", nodeID, "error", err)
		http.Error(w, "failed to fetch metadata", http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]json.RawMessage{"metadata": m})
}

func (h *AdminNodesHandler) nodeHosts(w http.ResponseWriter, r *http.Request, nodeID string) {
	hosts, err := h.rw.ListHosts(r.Context())
	if err != nil {
		slog.Error("admin nodes: hosts", "node", nodeID, "error", err)
		http.Error(w, "failed to fetch hosts", http.StatusBadGateway)
		return
	}
	profiles, _ := h.rw.ListConfigProfiles(r.Context())
	out := []adminHostDTO{}
	for _, ho := range hosts {
		if hasNode(ho, nodeID) {
			out = append(out, hostToDTO(ho, profiles))
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"hosts": out})
}

type adminTreeHostDTO struct {
	UUID       string `json:"uuid"`
	Remark     string `json:"remark"`
	Address    string `json:"address"`
	Port       int    `json:"port"`
	Linked     bool   `json:"linked"`
	IsDisabled bool   `json:"is_disabled"`
}

type adminTreeInboundDTO struct {
	UUID  string             `json:"uuid"`
	Tag   string             `json:"tag"`
	Type  string             `json:"type"`
	Port  int                `json:"port"`
	Hosts []adminTreeHostDTO `json:"hosts"`
}

func (h *AdminNodesHandler) inboundTree(w http.ResponseWriter, r *http.Request, nodeID string) {
	d, err := h.rw.GetNodeDetail(r.Context(), nodeID)
	if err != nil {
		slog.Error("admin nodes: tree: node", "node", nodeID, "error", err)
		http.Error(w, "failed to fetch node", http.StatusBadGateway)
		return
	}
	hosts, err := h.rw.ListHosts(r.Context())
	if err != nil {
		slog.Error("admin nodes: tree: hosts", "node", nodeID, "error", err)
		http.Error(w, "failed to fetch hosts", http.StatusBadGateway)
		return
	}
	profiles, err := h.rw.ListConfigProfiles(r.Context())
	if err != nil {
		slog.Error("admin nodes: tree: profiles", "node", nodeID, "error", err)
		http.Error(w, "failed to fetch profiles", http.StatusBadGateway)
		return
	}
	resp := map[string]any{
		"node":     map[string]string{"uuid": d.UUID, "name": d.Name, "country_code": d.CountryCode, "address": d.Address},
		"profile":  nil,
		"inbounds": []adminTreeInboundDTO{},
	}
	for _, p := range profiles {
		if !strings.EqualFold(p.UUID, d.ConfigProfile.UUID) {
			continue
		}
		resp["profile"] = map[string]string{"uuid": p.UUID, "name": p.Name}
		active := map[string]struct{}{}
		for _, in := range d.ConfigProfile.Inbounds {
			active[strings.ToLower(in.UUID)] = struct{}{}
		}
		inbounds := []adminTreeInboundDTO{}
		for _, in := range p.Inbounds {
			if _, ok := active[strings.ToLower(in.UUID)]; !ok {
				continue
			}
			ti := adminTreeInboundDTO{UUID: in.UUID, Tag: in.Tag, Type: in.Type, Port: in.Port, Hosts: []adminTreeHostDTO{}}
			for _, ho := range hosts {
				if strings.EqualFold(ho.ConfigProfileInbound, in.UUID) {
					ti.Hosts = append(ti.Hosts, adminTreeHostDTO{UUID: ho.UUID, Remark: ho.Remark, Address: ho.Address, Port: ho.Port, Linked: hasNode(ho, nodeID), IsDisabled: ho.IsDisabled})
				}
			}
			inbounds = append(inbounds, ti)
		}
		resp["inbounds"] = inbounds
	}
	writeJSON(w, http.StatusOK, resp)
}

var dateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

func (h *AdminNodesHandler) usage(w http.ResponseWriter, r *http.Request, nodeID string) {
	q := r.URL.Query()
	start, end := q.Get("start"), q.Get("end")
	if !dateRe.MatchString(start) || !dateRe.MatchString(end) {
		http.Error(w, "bad dates", http.StatusBadRequest)
		return
	}
	ts, err1 := time.Parse("2006-01-02", start)
	te, err2 := time.Parse("2006-01-02", end)
	if err1 != nil || err2 != nil || te.Before(ts) || te.Sub(ts) > 366*24*time.Hour {
		http.Error(w, "bad dates", http.StatusBadRequest)
		return
	}
	top := 100
	if v := q.Get("top"); v != "" {
		if _, err := fmt.Sscanf(v, "%d", &top); err != nil || top < 1 || top > 2000 {
			http.Error(w, "bad top", http.StatusBadRequest)
			return
		}
	}
	u, err := h.rw.GetNodeUsage(r.Context(), nodeID, start, end, top)
	if err != nil {
		slog.Error("admin nodes: usage", "node", nodeID, "error", err)
		http.Error(w, "failed to fetch usage", http.StatusBadGateway)
		return
	}
	if h.demo && len(u.TopUsers) == 0 {
		u = demoUsage(nodeID, start, end, top)
	}
	var total, peak float64
	for _, v := range u.Sparkline {
		total += v
		if v > peak {
			peak = v
		}
	}
	if len(u.Sparkline) == 0 {
		for _, tu := range u.TopUsers {
			total += tu.Total
		}
	}
	days := int(te.Sub(ts).Hours()/24) + 1
	type topUser struct {
		Username   string  `json:"username"`
		Color      string  `json:"color"`
		TotalBytes float64 `json:"total_bytes"`
	}
	users := make([]topUser, 0, len(u.TopUsers))
	for _, tu := range u.TopUsers {
		users = append(users, topUser{Username: tu.Username, Color: tu.Color, TotalBytes: tu.Total})
	}
	spark := u.Sparkline
	if spark == nil {
		spark = []float64{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"total_bytes": total, "avg_per_day_bytes": total / float64(days), "peak_bytes": peak,
		"sparkline": spark, "top_users": users,
	})
}

func (h *AdminNodesHandler) sessions(w http.ResponseWriter, r *http.Request, nodeID string) {
	users, err := h.rw.GetNodeSessions(r.Context(), nodeID, 10*time.Second)
	if err != nil {
		slog.Error("admin nodes: sessions", "node", nodeID, "error", err)
		http.Error(w, "failed to fetch sessions", http.StatusBadGateway)
		return
	}
	if h.demo && len(users) == 0 {
		users = demoSessions(nodeID, time.Now())
	}
	type ipDTO struct {
		IP       string `json:"ip"`
		LastSeen string `json:"last_seen"`
	}
	type userDTO struct {
		UserID int64   `json:"user_id"`
		IPs    []ipDTO `json:"ips"`
	}
	out := make([]userDTO, 0, len(users))
	for _, u := range users {
		ud := userDTO{UserID: u.UserID, IPs: []ipDTO{}}
		for _, ip := range u.IPs {
			ud.IPs = append(ud.IPs, ipDTO{IP: ip.IP, LastSeen: ip.LastSeen})
		}
		out = append(out, ud)
	}
	// IP-адреса пользователей — персональные данные: не кэшируем и в лог не пишем.
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"users": out})
}

// NodeOptions — GET /admin/node-options.
func (h *AdminNodesHandler) NodeOptions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || h.rw == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	o := h.rw.GetNodeOptions(r.Context())
	type pl struct {
		UUID string `json:"uuid"`
		Name string `json:"name"`
	}
	type pv struct {
		UUID        string `json:"uuid"`
		Name        string `json:"name"`
		FaviconLink string `json:"favicon_link,omitempty"`
	}
	plugins := make([]pl, 0, len(o.Plugins))
	for _, p := range o.Plugins {
		plugins = append(plugins, pl{UUID: p.UUID, Name: p.Name})
	}
	providers := make([]pv, 0, len(o.Providers))
	for _, p := range o.Providers {
		providers = append(providers, pv{UUID: p.UUID, Name: p.Name, FaviconLink: p.FaviconLink})
	}
	writeJSON(w, http.StatusOK, map[string]any{"plugins": plugins, "providers": providers, "tags": nonNil(o.Tags)})
}

// ConfigProfiles — GET /admin/config-profiles.
func (h *AdminNodesHandler) ConfigProfiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || h.rw == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	ps, err := h.rw.ListConfigProfiles(r.Context())
	if err != nil {
		slog.Error("admin nodes: config profiles", "error", err)
		http.Error(w, "failed to fetch profiles", http.StatusBadGateway)
		return
	}
	type inb struct {
		UUID string `json:"uuid"`
		Tag  string `json:"tag"`
		Type string `json:"type"`
		Port int    `json:"port"`
		Raw  json.RawMessage `json:"raw"`
	}
	type prof struct {
		UUID      string `json:"uuid"`
		Name      string `json:"name"`
		Inbounds  []inb  `json:"inbounds"`
		NodeCount int    `json:"node_count"`
	}
	out := make([]prof, 0, len(ps))
	for _, p := range ps {
		pr := prof{UUID: p.UUID, Name: p.Name, Inbounds: []inb{}, NodeCount: p.NodeCount}
		for _, i := range p.Inbounds {
			pr.Inbounds = append(pr.Inbounds, inb{UUID: i.UUID, Tag: i.Tag, Type: i.Type, Port: i.Port, Raw: rawOrNull(i.Raw)})
		}
		out = append(out, pr)
	}
	writeJSON(w, http.StatusOK, map[string]any{"profiles": out})
}

// XrayTemplates — GET /admin/xray-templates.
func (h *AdminNodesHandler) XrayTemplates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || h.rw == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	ts, err := h.rw.ListXrayTemplates(r.Context())
	if err != nil {
		slog.Error("admin nodes: xray templates", "error", err)
		http.Error(w, "failed to fetch templates", http.StatusBadGateway)
		return
	}
	type t struct {
		UUID string `json:"uuid"`
		Name string `json:"name"`
	}
	out := make([]t, 0, len(ts))
	for _, x := range ts {
		out = append(out, t{UUID: x.UUID, Name: x.Name})
	}
	writeJSON(w, http.StatusOK, map[string]any{"templates": out})
}

const adminHostsPrefix = "/cabinet/api/admin/hosts/"

// HostItem — GET/PATCH/DELETE /admin/hosts/{uuid}.
func (h *AdminNodesHandler) HostItem(w http.ResponseWriter, r *http.Request) {
	if h.rw == nil {
		http.Error(w, "panel not configured", http.StatusServiceUnavailable)
		return
	}
	id, err := uuid.Parse(strings.Trim(strings.TrimPrefix(r.URL.Path, adminHostsPrefix), "/"))
	if err != nil {
		http.Error(w, "invalid uuid in path", http.StatusBadRequest)
		return
	}
	hostID := id.String()
	reload := func() {
		ho, err := h.rw.GetHost(r.Context(), hostID)
		if err != nil {
			slog.Error("admin hosts: get", "host", hostID, "error", err)
			http.Error(w, "failed to fetch host", http.StatusBadGateway)
			return
		}
		profiles, _ := h.rw.ListConfigProfiles(r.Context())
		writeJSON(w, http.StatusOK, hostToDTO(*ho, profiles))
	}
	switch r.Method {
	case http.MethodGet:
		reload()
	case http.MethodPatch:
		body, ok := decodeBody(w, r)
		if !ok {
			return
		}
		fields, err := hostPatchFields(body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := h.rw.PatchHost(r.Context(), hostID, fields); err != nil {
			slog.Error("admin hosts: patch", "host", hostID, "error", err)
			http.Error(w, "failed to update host", http.StatusBadGateway)
			return
		}
		keys := make([]string, 0, len(fields))
		for k := range fields {
			keys = append(keys, k)
		}
		slog.Info("admin hosts: patched", "host", hostID, "fields", keys)
		reload()
	case http.MethodDelete:
		if err := h.rw.DeleteHost(r.Context(), hostID); err != nil {
			slog.Error("admin hosts: delete", "host", hostID, "error", err)
			http.Error(w, "failed to delete host", http.StatusBadGateway)
			return
		}
		slog.Info("admin hosts: deleted", "host", hostID)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
