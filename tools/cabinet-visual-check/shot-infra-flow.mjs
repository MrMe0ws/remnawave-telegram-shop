// Снимки страницы «Инфраструктура» по шагам: оплата в строке (A), счёт провайдера (B),
// меню ноды, колокольчик, вкладки, телефон (шторки, свайп), светлая тема.
// Запуск: CAB_CHROME=... node tools/cabinet-visual-check/shot-infra-flow.mjs [.tmp/infra-flow]
import { chromium } from 'playwright'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'

const dist = path.resolve('internal/cabinet/web/dist')
const out = path.resolve(process.argv[2] || '.tmp/infra-flow')
fs.mkdirSync(out, { recursive: true })
const base = JSON.parse(fs.readFileSync('tools/cabinet-visual-check/fixtures/admin-infra.json', 'utf8'))
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const server = http.createServer((req, res) => {
  const u = (req.url ?? '/').split('?')[0]
  let f = path.join(dist, u.replace(/^\/cabinet/, ''))
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' })
  res.end(fs.readFileSync(f))
})
await new Promise((r) => server.listen(5611, r))
const browser = await chromium.launch(process.env.CAB_CHROME ? { executablePath: process.env.CAB_CHROME } : {})
const errors = []

async function open(theme, w, h) {
  const fx = JSON.parse(JSON.stringify(base))
  Object.assign(fx, {
    '/auth/refresh': { access_token: 'stub', token_type: 'Bearer', expires_in: 3600 },
    '/me': { id: 1, email: 'a@example.com', email_verified: true, language: 'ru', providers: ['password'], has_telegram_link: true, has_password: true, is_admin: true, customer_id: 1 },
    '/admin/bootstrap': { providers: {}, features: {} },
  })
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5, colorScheme: theme, locale: 'ru-RU', timezoneId: 'Europe/Moscow', hasTouch: w < 640 })
  await ctx.addInitScript((m) => { localStorage.setItem('onboarding_completed', 'true'); localStorage.setItem('cab_theme', m) }, theme)
  await ctx.route('**/cabinet/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace('/cabinet/api', '')
    if (p === '/admin/infra/pay' && req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}')
      const ov = fx['/admin/infra/overview']
      const nodes = body.nodes.map((n) => {
        const bn = ov.billingNodes.find((x) => x.uuid === n.billing_uuid)
        const prev = bn.nextBillingAt
        const d = new Date(prev)
        d.setMonth(d.getMonth() + body.period_months)
        bn.nextBillingAt = d.toISOString()
        return { billingUuid: bn.uuid, nodeUuid: bn.nodeUuid, prevNextBillingAt: prev, nextBillingAt: bn.nextBillingAt }
      })
      await new Promise((r) => setTimeout(r, 350))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ historyUuid: '11111111-0000-4000-8000-000000000000', nodes }) })
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fx[p] ?? {}) })
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('http://localhost:5611/cabinet/admin/infra', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  return page
}
const shot = (page, name, full = false) => page.screenshot({ path: `${out}/${name}.png`, fullPage: full })

// ── ПК ──
const d = await open('dark', 1440, 1000)
await d.getByRole('tab', { name: /Провайдеры/ }).click()
await d.waitForTimeout(1200)
await shot(d, 'desk-providers', true)
await d.getByRole('tab', { name: /История/ }).click()
await d.waitForTimeout(1200)
await shot(d, 'desk-history', true)
await d.getByRole('tab', { name: /Ноды/ }).click()
await d.waitForTimeout(900)
await d.locator('[data-infra-row]').first().getByRole('button', { name: 'Оплачено' }).click()
await d.waitForTimeout(900)
await shot(d, 'desk-inline-open')
await d.keyboard.press('Enter')
await d.waitForTimeout(500)
await shot(d, 'desk-after-pay-toast')
await d.waitForTimeout(1200)
await shot(d, 'desk-after-pay-settled')
await d.getByRole('button', { name: 'Записать оплату' }).first().click()
await d.waitForTimeout(700)
await d.getByRole('button', { name: /xorek/ }).first().click()
await d.waitForTimeout(400)
await d.getByRole('button', { name: 'выбрать все' }).click()
await d.waitForTimeout(500)
await shot(d, 'desk-bill-panel')
await d.keyboard.press('Escape')
await d.waitForTimeout(500)
await d.locator('[data-infra-row]').nth(2).getByRole('button', { name: 'Действия' }).click()
await d.waitForTimeout(400)
await shot(d, 'desk-row-menu')
await d.keyboard.press('Escape')
await d.getByRole('button', { name: 'Напоминания об оплате' }).click()
await d.waitForTimeout(400)
await shot(d, 'desk-bell')

// ── Светлая тема ──
const l = await open('light', 1440, 1000)
await shot(l, 'desk-light')

// ── Телефон ──
const m = await open('dark', 390, 860)
await shot(m, 'mob-main')
await m.locator('[data-admin-no-edge-swipe]').first().getByRole('button', { name: 'Оплачено' }).click()
await m.waitForTimeout(800)
await shot(m, 'mob-sheet-a')
await m.keyboard.press('Escape')
await m.waitForTimeout(600)
await m.getByRole('button', { name: 'Записать оплату' }).last().click()
await m.waitForTimeout(800)
await m.getByRole('button', { name: /Wcloud/ }).first().click()
await m.waitForTimeout(400)
await shot(m, 'mob-sheet-b')
await m.keyboard.press('Escape')
await m.waitForTimeout(600)
const card = m.locator('[data-admin-no-edge-swipe]').nth(1)
const box = await card.boundingBox()
await m.mouse.move(box.x + 60, box.y + box.height / 2)
await m.mouse.down()
for (let i = 1; i <= 10; i++) await m.mouse.move(box.x + 60 + i * 14, box.y + box.height / 2)
await m.waitForTimeout(150)
await shot(m, 'mob-swipe-armed')
await m.mouse.up()
await m.waitForTimeout(700)
await shot(m, 'mob-after-swipe')

console.log(errors.length ? `pageerrors:\n${errors.join('\n')}` : 'без ошибок страницы')
await browser.close()
server.close()
