// Фикстура страницы «Ноды»: разные состояния, лимит, плагин, длинный адрес.
// node tools/cabinet-visual-check/make-nodes-fixture.cjs
const fs = require('fs')
const path = require('path')

const GiB = 1024 ** 3
const bitsToBytes = (mb) => (mb * 1e6) / 8

const live = (o) => ({
  state: 'online',
  memory_used_pct: 40,
  load_avg: [0.13, 0.21, 0.15],
  rx_bytes_per_sec: bitsToBytes(5),
  tx_bytes_per_sec: bitsToBytes(6),
  traffic_limit_bytes: 0,
  traffic_reset_day: 25,
  xray_uptime_sec: 4 * 86400,
  xray_version: '26.7.28',
  node_version: '3.0.0',
  ...o,
})

const nodes = [
  live({ uuid: 'n1', name: 'Швеция2', country_code: 'SE', address: '179.254.109.151', users_online: 24, provider: { name: '1cent.host' }, plugin_name: 'TBlocker', memory_used_pct: 43, rx_bytes_per_sec: bitsToBytes(14.37), tx_bytes_per_sec: bitsToBytes(14.47), traffic_used_bytes: 652.59 * GiB }),
  live({ uuid: 'n2', name: 'Германия', country_code: 'DE', address: '109.122.198.77', users_online: 15, provider: { name: 'waicore' }, plugin_name: 'TBlocker', node_version: '2.7.0', xray_version: '26.3.27', traffic_used_bytes: 786.52 * GiB }),
  live({ uuid: 'n3', name: 'Германия 2 премиум', country_code: 'DE', address: '144.31.84.141', users_online: 15, provider: { name: 'senko' }, memory_used_pct: 56, rx_bytes_per_sec: bitsToBytes(1.25), tx_bytes_per_sec: bitsToBytes(17.57), traffic_used_bytes: 503.89 * GiB }),
  live({ uuid: 'n4', name: 'Senko_Rastyan', country_code: 'DE', address: '31.77.160.151', users_online: 12, provider: { name: 'senko' }, memory_used_pct: 88, rx_bytes_per_sec: bitsToBytes(28.13), tx_bytes_per_sec: bitsToBytes(62.13), xray_uptime_sec: 2 * 86400, traffic_used_bytes: 360.35 * GiB }),
  live({ uuid: 'n5', name: 'Wcloud Обход', country_code: 'DE', address: 'pvk68vkt.4vov6kbvi.ru', users_online: 6, provider: { name: 'wcloud' }, memory_used_pct: 20, rx_bytes_per_sec: 46960 / 8, tx_bytes_per_sec: 29620 / 8, xray_uptime_sec: 13 * 3600, traffic_used_bytes: 102.06 * GiB, traffic_limit_bytes: 400 * GiB }),
  live({ uuid: 'n6', name: 'Эстония', country_code: 'EE', address: '138.124.100.62', users_online: 3, provider: { name: 'intezio' }, traffic_reset_day: 0, node_version: '3.4.4', traffic_used_bytes: 42.15 * GiB, xray_uptime_sec: 3 * 86400 }),
  live({ uuid: 'n7', name: 'Польша', country_code: 'PL', address: '179.253.179.100', users_online: 4, provider: { name: 'xytor.cloud' }, traffic_used_bytes: 112.74 * GiB, xray_uptime_sec: 3 * 86400 }),
  live({ uuid: 'n8', name: 'Гонконг', country_code: 'HK', address: '139.28.168.82', users_online: 0, provider: { name: 'likevps' }, traffic_reset_day: 0, traffic_used_bytes: 174.36 * 1024 ** 2, xray_uptime_sec: 2 * 86400 }),
  { uuid: 'n9', name: 'Россия', country_code: 'RU', address: '62.217.183.48', state: 'offline', users_online: 0, provider: { name: 'beget' }, plugin_name: 'TBlocker', memory_used_pct: null, load_avg: null, rx_bytes_per_sec: null, tx_bytes_per_sec: null, traffic_used_bytes: 71.11 * GiB, traffic_limit_bytes: 0, traffic_reset_day: 25, xray_uptime_sec: 0 },
  { uuid: 'n10', name: 'Нидерланды', country_code: 'NL', address: '91.205.12.40', state: 'connecting', users_online: 0, provider: { name: 'hostkey' }, memory_used_pct: null, load_avg: null, rx_bytes_per_sec: null, tx_bytes_per_sec: null, traffic_used_bytes: 0, traffic_limit_bytes: 0, traffic_reset_day: 25, xray_uptime_sec: 0 },
  { uuid: 'n11', name: 'Германия 3 · бывший MTProxy', country_code: 'DE', address: '2.26.172.180', state: 'disabled', users_online: 0, provider: { name: 'freakhosting' }, memory_used_pct: null, load_avg: null, rx_bytes_per_sec: null, tx_bytes_per_sec: null, traffic_used_bytes: 0, traffic_limit_bytes: 0, traffic_reset_day: 0, xray_uptime_sec: 0 },
]

const out = path.join(__dirname, 'fixtures', 'admin-nodes.json')
fs.writeFileSync(out, JSON.stringify({ '/admin/nodes': { nodes } }, null, 2))
console.log('written', out)
