package remnawave

import (
	"encoding/json"
	"testing"
)

func TestNodeDetailFromWire_offlineWithError(t *testing.T) {
	raw := `{"uuid":"u","name":"Германия 3","address":"a","port":2222,"proxyUrl":null,"isConnected":false,"isConnecting":false,"isDisabled":false,
	"lastStatusMessage":"timeout of 15000ms exceeded","isTrafficTrackingActive":true,"trafficResetDay":6,"trafficLimitBytes":null,"trafficUsedBytes":359,
	"countryCode":"DE","consumptionMultiplier":1,"nodeConsumptionMultiplier":1,"tags":[],"ips":[],"configProfile":{"activeConfigProfileUuid":"p","activeInbounds":[{"uuid":"i1","profileUuid":"p","tag":"vless-reality","type":"vless","network":"tcp","security":"reality","port":443,"rawInbound":null}]},
	"system":null,"versions":null,"xrayUptime":0,"usersOnline":null,"note":null}`
	var w nodeDetailWire
	if err := json.Unmarshal([]byte(raw), &w); err != nil {
		t.Fatal(err)
	}
	d := nodeDetailFromWire(w)
	if d.State != NodeStateOffline || d.LastStatusMessage != "timeout of 15000ms exceeded" || d.Port != 2222 {
		t.Fatalf("bad detail: %+v", d)
	}
	if d.System != nil || d.TrafficLimitBytes != 0 || d.UsersOnline != 0 || d.ConfigProfile.UUID != "p" || len(d.ConfigProfile.Inbounds) != 1 || d.ConfigProfile.Inbounds[0].Port != 443 {
		t.Fatalf("nullables not handled: %+v", d)
	}
}

func TestNodeAction_rejectsUnknown(t *testing.T) {
	var c Client
	if err := c.NodeAction(nil, "u", "drop-database"); err == nil {
		t.Fatal("expected error for unknown action")
	}
}
