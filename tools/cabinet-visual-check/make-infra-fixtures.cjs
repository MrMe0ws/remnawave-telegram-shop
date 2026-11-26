// Фикстура страницы «Инфраструктура» (данные выдуманные, даты — от сегодняшнего дня).
// node tools/cabinet-visual-check/make-infra-fixtures.cjs > tools/cabinet-visual-check/fixtures/admin-infra.json
const day = 86400000
const now = new Date()
const at = (d) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 0, 0, 0).toISOString()
const addM = (iso, m) => {
  const r = new Date(iso)
  const dd = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + m)
  r.setDate(Math.min(dd, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()))
  return r.toISOString()
}
const uid = (p, i) => `${p}${String(i).padStart(4, '0')}-0000-4000-8000-000000000000`.slice(0, 36)

const P = [
  ['FreakHosting', 'freakhosting.com'], ['intezio', 'intezio.net'], ['qwins.co', 'qwins.co'], ['xorek', 'xorek.cloud'],
  ['Wcloud', 'wcloud.pro'], ['HipHosting', 'hiphosting.net'], ['Hostup', 'hostup.se'], ['Dasabo', 'dasabo.com'], ['UpCloud', 'upcloud.com'],
].map(([name, host], i) => ({ uuid: uid('aaaa', i + 1), name, faviconLink: '', loginUrl: `https://${host}/login` }))
const prov = (n) => P.find((p) => p.name === n)

const N = [
  ['TEST Remnawave', 'DE', 'FreakHosting', 6, 5, 1], ['Эстония', 'EE', 'intezio', 7, 4.5, 1], ['Финляндия 2', 'FI', 'qwins.co', 9, 6, 1],
  ['Россия 2', 'RU', 'xorek', 11, 3.5, 1], ['Германия 3', 'DE', 'xorek', 14, 3.5, 1], ['Wcloud Обход', 'RU', 'Wcloud', 18, 4, 1],
  ['Финляндия HipHosting', 'FI', 'HipHosting', 25, 5, 1], ['Швеция', 'SE', 'Hostup', 25, 4.9, 1], ['Германия Premium', 'DE', 'Dasabo', 27, 9, 1],
  ['Польша', 'PL', 'UpCloud', 27, 5, 1], ['Нидерланды', 'NL', 'Wcloud', 27, 4, 1], ['Латвия', 'LV', 'intezio', -2, 4.5, 1],
  ['Россия Обход', 'RU', 'xorek', 2, 3.5, 1], ['Франция', 'FR', 'Hostup', 4, null, 1], ['Германия 4', 'DE', 'FreakHosting', 5, 5, 1],
  ['Литва', 'LT', 'UpCloud', 32, 5, 1], ['Нидерланды 2', 'NL', 'Wcloud', 40, 12, 3], ['США', 'US', 'HipHosting', 47, 7, 1], ['Австрия', 'AT', 'Dasabo', 126, 48, 6],
]
const billingNodes = N.map(([name, cc, pn, d], i) => {
  const p = prov(pn)
  return {
    uuid: uid('bbbb', i + 1), nodeUuid: uid('cccc', i + 1), providerUuid: p.uuid, nextBillingAt: at(d), createdAt: at(-200), updatedAt: at(-3),
    provider: { uuid: p.uuid, name: p.name, faviconLink: p.faviconLink, loginUrl: p.loginUrl }, node: { uuid: uid('cccc', i + 1), name, countryCode: cc },
  }
})
const meta = {}
N.forEach(([, , , , price, per], i) => {
  meta[uid('cccc', i + 1)] = { price, periodMonths: per, priceSource: price == null ? 'none' : i % 5 === 0 ? 'guess' : 'set', lastPaidAt: addM(billingNodes[i].nextBillingAt, -per), lastPaidAmount: price }
})

// История: прошлые оплаты каждой ноды за полгода.
const records = []
let k = 1
N.forEach(([name, cc, pn, , price, per], i) => {
  if (price == null) return
  for (let m = 1; m <= 6; m++) {
    const billed = addM(billingNodes[i].nextBillingAt, -m * per)
    if (new Date(billed) > now || new Date(billed) < new Date(now.getTime() - 185 * day)) continue
    const p = prov(pn)
    records.push({ uuid: uid('dddd', k++), providerUuid: p.uuid, amount: price, billedAt: billed, provider: { uuid: p.uuid, name: p.name, faviconLink: '' },
      nodes: [{ nodeUuid: uid('cccc', i + 1), name, countryCode: cc, amount: price }] })
  }
})
records.sort((a, b) => +new Date(b.billedAt) - +new Date(a.billedAt))
const months = []
for (let i = 5; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const rs = records.filter((r) => { const b = new Date(r.billedAt); return b.getFullYear() === d.getFullYear() && b.getMonth() === d.getMonth() })
  months.push({ month: key, total: Math.round(rs.reduce((s, r) => s + r.amount, 0) * 100) / 100, count: rs.length })
}
const totalSpent = Math.round(records.reduce((s, r) => s + r.amount, 0) * 100) / 100

const providers = P.map((p) => ({
  ...p, createdAt: at(-300), updatedAt: at(-10),
  billingHistory: { totalAmount: Math.round(records.filter((r) => r.providerUuid === p.uuid).reduce((s, r) => s + r.amount, 0) * 100) / 100, totalBills: records.filter((r) => r.providerUuid === p.uuid).length },
  billingNodes: billingNodes.filter((n) => n.providerUuid === p.uuid).map((n) => ({ nodeUuid: n.nodeUuid, name: n.node.name, countryCode: n.node.countryCode })),
}))
providers.push({ uuid: uid('aaaa', 99), name: 'Aeza', faviconLink: '', loginUrl: '', createdAt: at(-30), updatedAt: at(-30), billingHistory: { totalAmount: 0, totalBills: 0 }, billingNodes: [] })

const out = {
  '/admin/infra/overview': {
    totalBillingNodes: billingNodes.length, totalAvailableBillingNodes: 2, billingNodes,
    availableBillingNodes: [{ uuid: uid('eeee', 1), name: 'Казахстан', countryCode: 'KZ' }, { uuid: uid('eeee', 2), name: 'Турция', countryCode: 'TR' }],
    stats: { upcomingNodesCount: 4, currentMonthPayments: months[5].total, totalSpent },
    meta, months, recent: records.slice(0, 5), historyTotal: records.length,
  },
  '/admin/infra/providers': { total: providers.length, providers },
  '/admin/infra/history': { records: records.slice(0, 50), total: records.length },
  '/admin/reviews': { items: [], total: 0, counts: { pending: 0, published: 0, hidden: 0, all: 0 } },
  '/admin/infra/settings': { notify_before_1: true, notify_before_3: true, notify_before_7: false, notify_before_14: false },
}
process.stdout.write(JSON.stringify(out, null, 1))
