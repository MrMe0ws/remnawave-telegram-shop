import type { AdminNodeDetailDTO, AdminNodePatchBody } from '@/lib/types/admin'

/** Черновик формы ноды: всё строками, как в полях ввода; разбор и проверка — ниже. */
export interface NodeDraft {
  country_code: string
  name: string
  address: string
  port: string
  proxy_url: string
  plugin_uuid: string
  provider_uuid: string
  tracking: boolean
  limit: string
  unit: 'GiB' | 'TiB'
  reset_day: string
  notify: string
  tags: string[]
  note: string
  mult_user: string
  mult_node: string
}

const GIB = 1024 ** 3
const TIB = 1024 ** 4

export const MULT_MIN = 0
export const MULT_MAX = 100
export const MULT_STEP = 0.1

/** Число без хвоста нулей: 1.50 → «1.5». */
function trimNum(n: number, digits: number): string {
  return String(Number(n.toFixed(digits)))
}

export function toDraft(n: AdminNodeDetailDTO): NodeDraft {
  const bytes = n.traffic_limit_bytes || 0
  const tib = bytes > 0 && bytes % TIB === 0
  return {
    country_code: n.country_code,
    name: n.name,
    address: n.address,
    port: n.port ? String(n.port) : '',
    proxy_url: n.proxy_url ?? '',
    plugin_uuid: n.plugin_uuid ?? '',
    provider_uuid: n.provider_uuid ?? '',
    tracking: n.traffic_tracking,
    limit: bytes > 0 ? trimNum(tib ? bytes / TIB : bytes / GIB, 2) : '',
    unit: tib ? 'TiB' : 'GiB',
    reset_day: n.traffic_reset_day ? String(n.traffic_reset_day) : '',
    notify: String(n.notify_percent ?? 0),
    tags: [...n.tags],
    note: n.note ?? '',
    mult_user: (n.consumption_multiplier ?? 1).toFixed(1),
    mult_node: (n.node_consumption_multiplier ?? 1).toFixed(1),
  }
}

export function sameDraft(a: NodeDraft, b: NodeDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Десятичное число из поля: допускает запятую, пустое — NaN. */
export function parseNum(s: string): number {
  const v = s.trim().replace(',', '.')
  if (v === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(v)) return NaN
  return Number(v)
}

export function parseIntStrict(s: string): number {
  const v = s.trim()
  return /^\d+$/.test(v) ? Number(v) : NaN
}

/** Ключи ошибок (admin.nodes.edit.err.*) по полям. */
export type NodeDraftErrors = Partial<Record<'name' | 'address' | 'port' | 'proxy_url' | 'limit' | 'reset_day' | 'notify' | 'mult_user' | 'mult_node', string>>

const PROXY_RE = /^(socks5h?|socks4a?|https?):\/\/\S+$/i

export function validateDraft(d: NodeDraft): NodeDraftErrors {
  const e: NodeDraftErrors = {}
  if (!d.name.trim()) e.name = 'required'
  if (!d.address.trim()) e.address = 'required'
  const port = parseIntStrict(d.port)
  if (d.port.trim() === '') e.port = 'required'
  else if (!(port >= 1 && port <= 65535)) e.port = 'port'
  if (d.proxy_url.trim() && !PROXY_RE.test(d.proxy_url.trim())) e.proxy_url = 'proxy'
  if (d.tracking) {
    if (d.limit.trim() !== '') {
      const l = parseNum(d.limit)
      if (!(l >= 0)) e.limit = 'limit'
    }
    if (d.reset_day.trim() !== '') {
      const r = parseIntStrict(d.reset_day)
      if (!(r >= 1 && r <= 31)) e.reset_day = 'resetDay'
    }
    const np = parseIntStrict(d.notify)
    if (!(np >= 0 && np <= 100)) e.notify = 'notify'
  }
  for (const k of ['mult_user', 'mult_node'] as const) {
    const m = parseNum(d[k])
    if (!(m >= MULT_MIN && m <= MULT_MAX)) e[k] = 'mult'
  }
  return e
}

/** Значения черновика в тех единицах, в которых их ждёт API. Для сравнения «изменилось ли поле». */
function values(d: NodeDraft) {
  const unitBytes = d.unit === 'TiB' ? TIB : GIB
  const lim = d.limit.trim() === '' ? 0 : Math.round(parseNum(d.limit) * unitBytes)
  return {
    name: d.name.trim(),
    country_code: d.country_code,
    address: d.address.trim(),
    port: parseIntStrict(d.port),
    proxy_url: d.proxy_url.trim(),
    plugin_uuid: d.plugin_uuid,
    provider_uuid: d.provider_uuid,
    traffic_tracking: d.tracking,
    traffic_limit_bytes: lim,
    traffic_reset_day: d.reset_day.trim() === '' ? 0 : parseIntStrict(d.reset_day),
    notify_percent: parseIntStrict(d.notify),
    tags: d.tags,
    note: d.note,
    consumption_multiplier: Math.round(parseNum(d.mult_user) * 10) / 10,
    node_consumption_multiplier: Math.round(parseNum(d.mult_node) * 10) / 10,
  }
}

/** Только изменённые поля. Параметры учёта трафика уходят лишь при включённом отслеживании. */
export function buildPatch(draft: NodeDraft, base: NodeDraft): AdminNodePatchBody {
  const a = values(draft)
  const b = values(base)
  const patch: Record<string, unknown> = {}
  for (const k of Object.keys(a) as (keyof typeof a)[]) {
    if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue
    if (!a.traffic_tracking && (k === 'traffic_limit_bytes' || k === 'traffic_reset_day' || k === 'notify_percent')) continue
    patch[k] = a[k]
  }
  return patch as AdminNodePatchBody
}

/** Шаг степпера с округлением до десятых (без хвостов вроде 0.30000000000000004). */
export function stepMult(cur: string, dir: 1 | -1): string {
  const v = parseNum(cur)
  const base = Number.isFinite(v) ? v : 1
  const next = Math.min(MULT_MAX, Math.max(MULT_MIN, Math.round((base + dir * MULT_STEP) * 10) / 10))
  return next.toFixed(1)
}
