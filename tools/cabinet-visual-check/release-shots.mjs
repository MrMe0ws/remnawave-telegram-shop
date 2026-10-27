// Скриншоты к посту релиза: снимки кабинета с жёлтой рамкой и подписью на том,
// что изменилось. tools/release отправляет их альбомом ответом на пост в Telegram.
//
// Кабинет снимается из собранного dist с подставным API — без базы, бота и
// входа, и в кадр не попадают настоящие пользователи. Данные берутся из фикстуры
// (см. README рядом).
//
// Запуск из корня репозитория, после `cd web/cabinet && npm run build`:
//
//   node tools/cabinet-visual-check/release-shots.mjs internal/cabinet/web/dist \
//     tools/cabinet-visual-check/fixtures/admin-broadcast.json release-screenshots
//
// Под новый релиз меняются только сценарии в конце файла: какую страницу
// открыть, что нажать и что обвести. Здесь — сценарии релиза 5.22.0 (рассылка).
// mark(locator, 'Подпись', side): side — top | bottom | left | inside | inside-low.
// Каждый снимок после съёмки посмотреть глазами: подпись не должна закрывать
// текст интерфейса, рамка — резать соседние строки.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const [, , distDir, fixturesFile, outDir] = process.argv
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' }
const server = http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0]
  let file = path.join(distDir, decodeURIComponent(url).replace(/^\/cabinet/, ''))
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' })
  res.end(fs.readFileSync(file))
})
await new Promise((r) => server.listen(5604, r))

const base = {
  '/auth/refresh': { access_token: 'stub', token_type: 'Bearer', expires_in: 3600 },
  '/me': { id: 1, email: 'admin@example.com', email_verified: true, language: 'ru', providers: ['password'], has_telegram_link: true, has_password: true, google_oauth_enabled: false, is_admin: true, customer_id: 1 },
  '/admin/bootstrap': { providers: {}, features: {} },
  ...JSON.parse(fs.readFileSync(fixturesFile, 'utf8')),
}
const hist = base['/admin/broadcast/history']
const first = base['/admin/broadcast/history/1']
const doneFirst = { ...first, status: 'done', sent: 1301, blocked: 118, failed: 23, finished_at: '2026-10-27T11:32:52Z' }
const fxQuiet = { ...base, '/admin/broadcast/history': { ...hist, items: [doneFirst, ...hist.items.slice(1)] }, '/admin/broadcast/history/1': doneFirst }
const fxDone = { ...base, '/admin/broadcast/history': { ...hist, items: [{ ...doneFirst, status: 'running' }, ...hist.items.slice(1)] }, '/admin/broadcast/history/1': doneFirst }
fs.mkdirSync(outDir, { recursive: true })

const b = await chromium.launch()
async function open(w, h, fx) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'ru-RU', timezoneId: 'Europe/Moscow' })
  await ctx.addInitScript(() => {
    localStorage.setItem('onboarding_completed', 'true')
    localStorage.setItem('cab_theme', 'dark')
  })
  await ctx.route('**/cabinet/api/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace('/cabinet/api', '')
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fx[p] ?? {}) })
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('http://localhost:5604/cabinet/admin/broadcast', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1300)
  return { ctx, page, errors }
}

// Жёлтая рамка вокруг элемента и подпись рядом.
async function mark(locator, label, where = 'top') {
  await locator.first().evaluate((el, args) => {
    const [text, side] = args
    const r = el.getBoundingClientRect()
    const pad = 6
    const box = document.createElement('div')
    Object.assign(box.style, {
      position: 'fixed', left: `${r.left - pad}px`, top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
      border: '3px solid #FFB020', borderRadius: '14px', boxShadow: '0 0 0 5px rgba(255,176,32,.22)',
      pointerEvents: 'none', zIndex: 2147483646,
    })
    document.body.appendChild(box)
    const tag = document.createElement('div')
    tag.textContent = text
    Object.assign(tag.style, {
      position: 'fixed', background: '#FFB020', color: '#1d1400',
      font: '800 15px/1.2 Manrope, Inter, system-ui, sans-serif', padding: '7px 12px',
      borderRadius: '10px', zIndex: 2147483647, whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,.35)',
    })
    document.body.appendChild(tag)
    const th = tag.offsetHeight
    const tw = tag.offsetWidth
    let top = side === 'bottom' || r.top - pad - th - 8 < 4 ? r.bottom + pad + 8 : r.top - pad - th - 8
    let left = Math.min(Math.max(4, r.left - pad), window.innerWidth - tw - 8)
    if (side === 'inside') {
      top = r.top + 14
      left = r.right - tw - 64
    }
    if (side === 'inside-low') {
      top = r.top + 40
      left = r.right - tw - 24
    }
    if (side === 'left') {
      top = r.top + (r.height - th) / 2
      left = r.left - pad - tw - 14
    }
    tag.style.top = `${top}px`
    tag.style.left = `${left}px`
  }, [label, where])
}
const shot = (page, name) => page.screenshot({ path: path.join(outDir, name) })

{
  const { ctx, page, errors } = await open(1440, 1080, fxQuiet)
  await page.getByRole('button', { name: 'Аудитория' }).click()
  await page.getByRole('checkbox', { name: /Неактивные оплатившие/ }).click()
  await page.locator('[contenteditable="true"]').first().click()
  await page.keyboard.type('Новые локации: Турция и Казахстан')
  await page.waitForTimeout(900)
  await page.evaluate(() => window.scrollTo(0, 150))
  await page.waitForTimeout(300)
  await mark(page.locator('ul[aria-label="Аудитория"]').locator('xpath=..'), 'Несколько аудиторий в одной рассылке', 'inside-low')
  await mark(page.getByText('Черновик сохранён'), 'Черновик сохраняется сам', 'bottom')
  await shot(page, '01-audiences.png')
  console.log('1', errors)
  await ctx.close()
}
{
  const { ctx, page, errors } = await open(1440, 900, fxDone)
  await mark(page.getByRole('status').filter({ hasText: 'Рассылка завершена' }), 'Итог рассылки прямо в кабинете', 'inside')
  await shot(page, '02-result.png')
  console.log('2', errors)
  await ctx.close()
}
{
  const { ctx, page, errors } = await open(1440, 1000, fxQuiet)
  await page.getByRole('tab', { name: /История/ }).first().click()
  await page.waitForTimeout(600)
  await mark(page.locator('[role="tablist"]').filter({ hasText: 'Новая рассылка' }), 'История рассылок', 'left')
  await shot(page, '03-history.png')
  console.log('3', errors)
  await ctx.close()
}
{
  const { ctx, page, errors } = await open(1440, 1000, fxQuiet)
  await page.getByRole('tab', { name: /История/ }).first().click()
  await page.waitForTimeout(500)
  await page.getByRole('row', { name: /Нидерландах/ }).click()
  await page.waitForTimeout(700)
  await mark(page.getByRole('button', { name: 'Взять за основу' }), 'Повторить рассылку в пару кликов', 'top')
  await shot(page, '04-details.png')
  console.log('4', errors)
  await ctx.close()
}
{
  const { ctx, page, errors } = await open(390, 844, fxDone)
  await page.mouse.wheel(0, 700)
  await page.waitForTimeout(700)
  await mark(page.getByRole('tab', { name: 'Сообщение' }).locator('xpath=..'), 'Вкладки всегда под рукой', 'bottom')
  await shot(page, '05-phone-tabs.png')
  console.log('5', errors)
  await ctx.close()
}
await b.close()
server.close()
