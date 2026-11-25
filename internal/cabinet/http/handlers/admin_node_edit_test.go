package handlers

import (
	"encoding/json"
	"testing"

	"remnawave-tg-shop-bot/internal/remnawave"
)

func body(t *testing.T, s string) map[string]json.RawMessage {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func TestNodePatchFields_mapsToPanelNames(t *testing.T) {
	out, err := nodePatchFields(body(t, `{"name":" Берлин ","country_code":"de","port":2222,"proxy_url":"","consumption_multiplier":1.5,
		"traffic_tracking":true,"provider_uuid":"","tags":["a","b"],"note":"","config_profile":{"uuid":"11111111-1111-4111-8111-111111111111","inbound_uuids":["22222222-2222-4222-8222-222222222222"]}}`))
	if err != nil {
		t.Fatal(err)
	}
	if out["name"] != "Берлин" || out["countryCode"] != "DE" || out["port"] != int64(2222) {
		t.Fatalf("bad mapping: %+v", out)
	}
	for _, k := range []string{"proxyUrl", "providerUuid", "note"} {
		if v, ok := out[k]; !ok || v != nil {
			t.Fatalf("%s must be explicit null, got %v (present=%v)", k, v, ok)
		}
	}
	cp := out["configProfile"].(map[string]any)
	if cp["activeConfigProfileUuid"] != "11111111-1111-4111-8111-111111111111" || len(cp["activeInbounds"].([]string)) != 1 {
		t.Fatalf("bad config profile: %+v", cp)
	}
}

func TestNodePatchFields_rejectsBadInput(t *testing.T) {
	for _, s := range []string{
		`{}`,
		`{"bogus":1}`,
		`{"port":70000}`,
		`{"port":1.5}`,
		`{"name":""}`,
		`{"country_code":"DEU"}`,
		`{"notify_percent":101}`,
		`{"provider_uuid":"not-a-uuid"}`,
		`{"config_profile":{"uuid":"x","inbound_uuids":[]}}`,
		`{"tags":[""]}`,
	} {
		if _, err := nodePatchFields(body(t, s)); err == nil {
			t.Errorf("expected error for %s", s)
		}
	}
}

func TestHostPatchFields(t *testing.T) {
	out, err := hostPatchFields(body(t, `{"remark":"Нидерланды","is_hidden":true,"alpn":null,"security_layer":"TLS","sni":"a.example",
		"mux_params":{"enabled":true},"final_mask":null,"vless_route_id":null,"node_uuids":["11111111-1111-4111-8111-111111111111"],
		"inbound":{"config_profile_uuid":"11111111-1111-4111-8111-111111111111","inbound_uuid":"22222222-2222-4222-8222-222222222222"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if out["remark"] != "Нидерланды" || out["isHidden"] != true || out["securityLayer"] != "TLS" {
		t.Fatalf("bad mapping: %+v", out)
	}
	if v, ok := out["alpn"]; !ok || v != nil {
		t.Fatalf("alpn must be explicit null")
	}
	if string(out["muxParams"].(json.RawMessage)) != `{"enabled":true}` {
		t.Fatalf("mux params must pass through as JSON: %v", out["muxParams"])
	}
	if _, ok := out["inbound"].(map[string]any)["configProfileInboundUuid"]; !ok {
		t.Fatalf("inbound not mapped: %+v", out["inbound"])
	}
	for _, s := range []string{`{"security_layer":"WEIRD"}`, `{"alpn":"spdy"}`, `{"mux_params":{broken`, `{"uuid":"x"}`, `{"features":[]}`} {
		var m map[string]json.RawMessage
		if json.Unmarshal([]byte(s), &m) != nil {
			continue
		}
		if _, err := hostPatchFields(m); err == nil {
			t.Errorf("expected error for %s", s)
		}
	}
}

func TestHostFeatures(t *testing.T) {
	tpl := "11111111-1111-4111-8111-111111111111"
	route := 5
	h := remnawave.Host{
		XrayJSONTemplateUUID: &tpl,
		MuxParams:            json.RawMessage(`{"enabled":true}`),
		SockoptParams:        json.RawMessage(`null`),
		FinalMask:            json.RawMessage(`{"tcp":[]}`),
		ShuffleHost:          true,
		VlessRouteID:         &route,
	}
	got := hostFeatures(h)
	want := []string{"xray_template", "mux", "final_mask", "shuffle_host", "vless_route"}
	if len(got) != len(want) {
		t.Fatalf("features = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("features = %v, want %v", got, want)
		}
	}
	if len(hostFeatures(remnawave.Host{})) != 0 {
		t.Fatal("empty host must have no features")
	}
}

func TestHostPatchFields_extendedOptions(t *testing.T) {
	out, err := hostPatchFields(body(t, `{"internal_squads":{"mode":"ALLOW_ONLY","squads":["11111111-1111-4111-8111-111111111111"]},
		"exclude_from_subscription_types":["MIHOMO","CLASH"],"mapper":{"xrayJson":[]},"pinned_peer_cert_sha256":["ab"],"verify_peer_cert_by_name":[],
		"mihomo_ip_version":"ipv4-prefer","vless_route_id":7}`))
	if err != nil {
		t.Fatal(err)
	}
	sq := out["internalSquads"].(map[string]any)
	if sq["mode"] != "ALLOW_ONLY" || len(sq["squads"].([]string)) != 1 {
		t.Fatalf("bad squads: %+v", sq)
	}
	if len(out["excludeFromSubscriptionTypes"].([]string)) != 2 || out["vlessRouteId"] != int64(7) {
		t.Fatalf("bad mapping: %+v", out)
	}
	for _, s := range []string{
		`{"internal_squads":{"mode":"BOTH","squads":[]}}`,
		`{"internal_squads":{"mode":"EXCLUDE","squads":["x"]}}`,
		`{"exclude_from_subscription_types":["WINDOWS"]}`,
		`{"mihomo_ip_version":"ipv9"}`,
	} {
		if _, err := hostPatchFields(body(t, s)); err == nil {
			t.Errorf("expected error for %s", s)
		}
	}
}
