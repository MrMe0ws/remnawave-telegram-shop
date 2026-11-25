package handlers

import (
	"fmt"
	"hash/fnv"
	"math/rand"
	"os"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/remnawave"
)

// Демо-данные нод для ТЕСТОВОГО стенда.
//
// Включаются только переменной окружения ADMIN_NODES_DEMO=1 (в обычной работе её нет — код ничего не делает).
// Тестовая панель почти пуста: ноды не подключены, пользователей и трафика нет, и окно ноды нечем проверять.
// Поэтому поверх ответа панели накладываются правдоподобные, но выдуманные показатели: состояние, нагрузка, память,
// трафик, пользователи онлайн, версии, аптайм, «О системе», статистика использования и активные сессии.
// Всё стабильно по uuid ноды (одна и та же нода выглядит одинаково в списке и в окне).
// Настройки, которые можно записать в панель (теги, примечание, лимиты, хосты, провайдеры), демо не трогает —
// их кладут в панель обычными запросами, и они настоящие. Disabled-нода остаётся выключенной.

func demoEnabled() bool { return os.Getenv("ADMIN_NODES_DEMO") == "1" }

type demoNode struct {
	state       string
	users       int
	memPct      float64
	load        []float64
	cpus        int
	rx, tx      float64 // байт/с
	rxTotal     float64
	txTotal     float64
	used        int64
	limit       int64
	resetDay    int
	uptime      int64
	sysUptime   int64
	provider    string
	plugin      string
	xrayVersion string
	nodeVersion string
	cpuModel    string
	kernel      string
	iface       string
}

func demoRand(uuid string, salt string) *rand.Rand {
	h := fnv.New64a()
	_, _ = h.Write([]byte(strings.ToLower(uuid) + salt))
	return rand.New(rand.NewSource(int64(h.Sum64())))
}

const gib = int64(1) << 30

func demoFor(uuid, realState string) demoNode {
	r := demoRand(uuid, "node")
	d := demoNode{}
	switch {
	case realState == remnawave.NodeStateDisabled:
		d.state = realState
	default:
		switch r.Intn(5) {
		case 0:
			d.state = remnawave.NodeStateOffline
		case 1:
			d.state = remnawave.NodeStateConnecting
		default:
			d.state = remnawave.NodeStateOnline
		}
	}
	d.users = 2 + r.Intn(27)
	d.memPct = 22 + r.Float64()*72
	d.cpus = []int{1, 2, 4, 8}[r.Intn(4)]
	d.load = []float64{r.Float64() * float64(d.cpus) * 1.1, r.Float64() * float64(d.cpus), r.Float64() * float64(d.cpus) * 0.9}
	d.rx = (0.4 + r.Float64()*40) * 125000
	d.tx = (0.4 + r.Float64()*40) * 125000
	d.rxTotal = float64(20+r.Intn(900)) * float64(gib)
	d.txTotal = float64(20+r.Intn(900)) * float64(gib)
	d.used = int64(5+r.Intn(900)) * gib
	if r.Intn(2) == 0 {
		d.limit = []int64{500 * gib, 1024 * gib, 2048 * gib, 4096 * gib}[r.Intn(4)]
		if d.used > d.limit {
			d.used = d.limit * 9 / 10
		}
	}
	d.resetDay = 1 + r.Intn(28)
	d.uptime = int64(3600 + r.Intn(30*86400))
	d.sysUptime = d.uptime + int64(r.Intn(40*86400))
	d.provider = []string{"Hetzner", "OVH", "Contabo", "Vultr", "Aeza"}[r.Intn(5)]
	if r.Intn(3) == 0 {
		d.plugin = "TBlocker"
	}
	d.xrayVersion = []string{"26.7.28", "26.11.9", "26.5.3"}[r.Intn(3)]
	d.nodeVersion = []string{"3.4.1", "3.4.6", "3.0.0"}[r.Intn(3)]
	d.cpuModel = []string{"AMD EPYC 7452 32-Core Processor", "Intel Xeon Processor (Skylake, IBRS)", "AMD EPYC 7542 32-Core Processor"}[r.Intn(3)]
	d.kernel = []string{"6.8.0-149-generic", "7.0.0-43-generic", "6.8.0-35-generic"}[r.Intn(3)]
	d.iface = []string{"ens3", "eth0", "enp1s0"}[r.Intn(3)]
	return d
}

var demoErrors = []string{"timeout of 15000ms exceeded", "connect ECONNREFUSED 127.0.0.1:2222", "socket hang up"}

// demoOverview накладывает демо на строку списка нод.
func demoOverview(n remnawave.NodeOverview) remnawave.NodeOverview {
	d := demoFor(n.UUID, n.State)
	n.State = d.state
	n.TrafficUsedBytes = d.used
	n.TrafficLimitBytes = d.limit
	if n.TrafficResetDay == 0 {
		n.TrafficResetDay = d.resetDay
	}
	if n.Provider == nil {
		n.Provider = &remnawave.NodeProvider{Name: d.provider}
	}
	if n.PluginName == "" {
		n.PluginName = d.plugin
	}
	if d.state != remnawave.NodeStateOnline {
		n.UsersOnline, n.MemoryUsedPct, n.LoadAvg, n.RxBytesPerSec, n.TxBytesPerSec = 0, nil, nil, nil, nil
		n.XrayUptimeSec, n.XrayVersion, n.NodeVersion = 0, "", ""
		return n
	}
	n.UsersOnline = d.users
	mem := d.memPct
	n.MemoryUsedPct = &mem
	n.LoadAvg = d.load
	n.CPUs = d.cpus
	rx, tx := d.rx, d.tx
	n.RxBytesPerSec, n.TxBytesPerSec = &rx, &tx
	n.XrayUptimeSec = d.uptime
	n.XrayVersion, n.NodeVersion = d.xrayVersion, d.nodeVersion
	return n
}

// demoDetail накладывает демо на окно ноды.
func demoDetail(n remnawave.NodeDetail) remnawave.NodeDetail {
	d := demoFor(n.UUID, n.State)
	n.State = d.state
	n.TrafficUsedBytes = d.used
	if !n.TrafficTracking && n.TrafficLimitBytes == 0 {
		n.TrafficLimitBytes = d.limit
	}
	if n.TrafficResetDay == 0 {
		n.TrafficResetDay = d.resetDay
	}
	if n.Provider == nil {
		n.Provider = &remnawave.NodeProvider{Name: d.provider}
	}
	switch d.state {
	case remnawave.NodeStateOnline:
		n.LastStatusMessage = ""
		n.UsersOnline = d.users
		n.XrayUptimeSec = d.uptime
		n.XrayVersion, n.NodeVersion = d.xrayVersion, d.nodeVersion
		total := float64(1+demoRand(n.UUID, "mem").Intn(3)) * float64(gib)
		n.System = &remnawave.NodeSystem{
			Arch: "x64", Platform: "linux", CPUModel: d.cpuModel, CPUs: d.cpus, Kernel: d.kernel, Hostname: "node",
			MemoryTotal: total, MemoryUsed: total * d.memPct / 100, UptimeSec: d.sysUptime,
			Interface: d.iface, RxPerSec: d.rx, TxPerSec: d.tx, RxTotal: d.rxTotal, TxTotal: d.txTotal,
		}
	case remnawave.NodeStateOffline, remnawave.NodeStateConnecting:
		n.UsersOnline, n.XrayUptimeSec, n.XrayVersion, n.NodeVersion, n.System = 0, 0, "", "", nil
		if n.LastStatusMessage == "" {
			n.LastStatusMessage = demoErrors[demoRand(n.UUID, "err").Intn(len(demoErrors))]
		}
	default:
		n.UsersOnline, n.XrayUptimeSec, n.XrayVersion, n.NodeVersion, n.System = 0, 0, "", "", nil
	}
	return n
}

var demoColors = []string{"#e8d44d", "#3fb27f", "#e5534b", "#d4a72c", "#6e76e5", "#c69a7c", "#4a90d9", "#b5179e", "#2f855a", "#1d3fbb", "#7d8590"}

// demoUsage — статистика использования за период start..end (YYYY-MM-DD), если у панели для ноды её нет.
func demoUsage(uuid, start, end string, top int) *remnawave.NodeUsage {
	ts, _ := time.Parse("2006-01-02", start)
	te, _ := time.Parse("2006-01-02", end)
	days := int(te.Sub(ts).Hours()/24) + 1
	if days < 1 {
		days = 1
	}
	r := demoRand(uuid, "usage"+start+end)
	base := float64(6+r.Intn(24)) * float64(gib)
	out := &remnawave.NodeUsage{}
	for i := 0; i < days; i++ {
		out.Sparkline = append(out.Sparkline, base*(0.55+r.Float64()*0.9))
	}
	n := top
	if n > 60 {
		n = 60
	}
	weight := 1.0
	for i := 0; i < n; i++ {
		weight *= 0.93 + r.Float64()*0.05
		out.TopUsers = append(out.TopUsers, remnawave.NodeUsageUser{
			Username: fmt.Sprintf("%d_%d", 100+r.Intn(1900), 100000000+r.Intn(900000000)),
			Color:    demoColors[i%len(demoColors)],
			Total:    base * float64(days) * 0.16 * weight * (0.6 + r.Float64()*0.6),
		})
	}
	return out
}

// demoSessions — активные сессии, если у панели для ноды их нет.
func demoSessions(uuid string, now time.Time) []remnawave.NodeSessionUser {
	r := demoRand(uuid, "sessions")
	n := 6 + r.Intn(12)
	out := make([]remnawave.NodeSessionUser, 0, n)
	for i := 0; i < n; i++ {
		u := remnawave.NodeSessionUser{UserID: int64(1 + r.Intn(900))}
		for k, c := 0, 1+r.Intn(3); k < c; k++ {
			ago := time.Duration([]int{20, 90, 240, 600, 2400, 7200}[r.Intn(6)]+r.Intn(60)) * time.Second
			u.IPs = append(u.IPs, remnawave.NodeSessionIP{
				IP:       fmt.Sprintf("%d.%d.%d.%d", 31+r.Intn(180), r.Intn(255), r.Intn(255), 1+r.Intn(254)),
				LastSeen: now.Add(-ago).UTC().Format(time.RFC3339),
			})
		}
		out = append(out, u)
	}
	return out
}
