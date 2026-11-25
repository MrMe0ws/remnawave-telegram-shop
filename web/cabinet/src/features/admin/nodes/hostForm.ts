import type { AdminHostDTO, AdminHostPatchBody } from '@/lib/types/admin'

/**
 * Форма редактирования хоста: черновик в виде строк (то, что лежит в полях ввода),
 * сравнение с исходным хостом и сборка PATCH только из изменённых полей.
 */

export type HostInbound = { profile: string; uuid: string; profileName: string; tag: string }
export type SquadMode = 'EXCLUDE' | 'ALLOW_ONLY'

export type HostDraft = {
  remark: string
  /** is_disabled (в интерфейсе переключатель инвертирован: «Включён» = не отключён). */
  disabled: boolean
  /** is_hidden — опция «Скрыть хост». */
  hidden: boolean
  address: string
  port: string
  nodes: string[]
  /** Инбаунд хоста (ровно один): uuid профиля и инбаунда + подписи для показа. */
  inbound: HostInbound
  tags: string[]
  squadMode: SquadMode
  squads: string[]
  sni: string
  overrideSni: boolean
  keepSniBlank: boolean
  fingerprint: string
  alpn: string
  security: 'DEFAULT' | 'TLS' | 'NONE'
  vlessRoute: string
  host: string
  path: string
  description: string
  excludeSub: string[]
  shuffle: boolean
  /** uuid шаблона Xray JSON, '' — без шаблона. */
  template: string
  /** JSON-поля: '' — не задано, иначе отформатированный JSON. */
  mapper: string
  mux: string
  sockopt: string
  final_mask: string
  xhttp: string
  pinnedCert: string[]
  verifyName: string[]
  x25519: boolean
  mihomoIp: string
}

export type HostDraftKey = keyof HostDraft

/** Необязательные опции: показываются, если у хоста заданы, либо их добавили кнопкой «Добавить». */
export type HostOptKey =
  | 'tags'
  | 'nodes'
  | 'squads'
  | 'sni'
  | 'overrideSni'
  | 'keepSniBlank'
  | 'security'
  | 'fingerprint'
  | 'vlessRoute'
  | 'host'
  | 'path'
  | 'alpn'
  | 'description'
  | 'excludeSub'
  | 'hidden'
  | 'shuffle'
  | 'template'
  | 'mapper'
  | 'mux'
  | 'final_mask'
  | 'xhttp'
  | 'sockopt'
  | 'pinnedCert'
  | 'verifyName'
  | 'x25519'
  | 'mihomoIp'

export type HostJsonKey = 'mapper' | 'mux' | 'sockopt' | 'final_mask' | 'xhttp'

export type HostGroupId = 'dest' | 'security' | 'transport' | 'subscription' | 'advanced' | 'clients'

export const OPT_GROUPS: { id: HostGroupId; keys: HostOptKey[] }[] = [
  { id: 'dest', keys: ['tags', 'nodes', 'squads'] },
  { id: 'security', keys: ['sni', 'overrideSni', 'keepSniBlank', 'security', 'fingerprint'] },
  { id: 'transport', keys: ['vlessRoute', 'host', 'path', 'alpn'] },
  { id: 'subscription', keys: ['description', 'excludeSub', 'hidden', 'shuffle'] },
  { id: 'advanced', keys: ['template', 'mapper', 'mux', 'final_mask', 'xhttp', 'sockopt'] },
  { id: 'clients', keys: ['pinnedCert', 'verifyName', 'x25519', 'mihomoIp'] },
]

/** Ключ i18n (admin.nodes.panels.host.*) с названием опции. */
export const OPT_LABEL: Record<HostOptKey, string> = {
  tags: 'tags',
  nodes: 'nodes',
  squads: 'squads',
  sni: 'sni',
  overrideSni: 'overrideSni',
  keepSniBlank: 'keepSniBlank',
  security: 'securityLayer',
  fingerprint: 'fingerprint',
  vlessRoute: 'vlessRoute',
  host: 'hostHeader',
  path: 'path',
  alpn: 'alpn',
  description: 'description',
  excludeSub: 'excludeSub',
  hidden: 'hideHost',
  shuffle: 'shuffle',
  template: 'template',
  mapper: 'mapper',
  mux: 'mux',
  final_mask: 'finalMask',
  xhttp: 'xhttpExtra',
  sockopt: 'sockopt',
  pinnedCert: 'pinnedCert',
  verifyName: 'verifyName',
  x25519: 'x25519',
  mihomoIp: 'mihomoIp',
}

/** «Пустое» значение опции: то, что уходит в PATCH, когда опцию убрали, и стартовое значение у только что добавленной. */
const EMPTY: Record<HostOptKey, Partial<HostDraft>> = {
  tags: { tags: [] },
  nodes: { nodes: [] },
  squads: { squadMode: 'EXCLUDE', squads: [] },
  sni: { sni: '' },
  overrideSni: { overrideSni: false },
  keepSniBlank: { keepSniBlank: false },
  security: { security: 'DEFAULT' },
  fingerprint: { fingerprint: '' },
  vlessRoute: { vlessRoute: '' },
  host: { host: '' },
  path: { path: '' },
  alpn: { alpn: '' },
  description: { description: '' },
  excludeSub: { excludeSub: [] },
  hidden: { hidden: false },
  shuffle: { shuffle: false },
  template: { template: '' },
  mapper: { mapper: '' },
  mux: { mux: '' },
  final_mask: { final_mask: '' },
  xhttp: { xhttp: '' },
  sockopt: { sockopt: '' },
  pinnedCert: { pinnedCert: [] },
  verifyName: { verifyName: [] },
  x25519: { x25519: false },
  mihomoIp: { mihomoIp: '' },
}

export const OPT_FIELDS = Object.fromEntries(
  (Object.keys(EMPTY) as HostOptKey[]).map((k) => [k, Object.keys(EMPTY[k]) as HostDraftKey[]]),
) as Record<HostOptKey, HostDraftKey[]>

export const emptyOpt = (k: HostOptKey): Partial<HostDraft> => ({ ...EMPTY[k] })

/** Значения для выпадающих списков. */
export const FINGERPRINTS = ['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', '360', 'qq', 'random', 'randomized']
export const ALPNS = ['h3', 'h2', 'http/1.1', 'h2,http/1.1', 'h3,h2,http/1.1', 'h3,h2']
export const SUB_TYPES = ['XRAY_JSON', 'XRAY_BASE64', 'MIHOMO', 'STASH', 'CLASH', 'SINGBOX']
export const MIHOMO_IPS = ['dual', 'ipv4', 'ipv6', 'ipv4-prefer', 'ipv6-prefer']

/** Правила тегов панели: A-Z, 0-9, «_» и «:», до 36 символов, не более 10 тегов. */
export const TAG_RE = /^[A-Z0-9_:]{1,36}$/
export const TAGS_MAX = 10

// Панель отдаёт «пустое» значение как null или как {} / [] (маппер у нового хоста — {}): это «не задано».
const isEmptyJson = (v: unknown): boolean =>
  v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && Object.keys(v as object).length === 0)
const jsonText = (v: unknown): string => (isEmptyJson(v) ? '' : JSON.stringify(v, null, 2))

// В панели 3.4.0 sni/host/path/fingerprint — одна строка (или null), а не список.
export const listToText = (a: string | null | undefined): string => a ?? ''
const nullIfEmpty = (s: string): string | null => (s.trim() === '' ? null : s.trim())

export function toDraft(h: AdminHostDTO): HostDraft {
  return {
    remark: h.remark,
    disabled: !!h.is_disabled,
    hidden: !!h.is_hidden,
    address: h.address,
    port: String(h.port),
    nodes: [...(h.node_uuids ?? [])],
    inbound: {
      profile: h.inbound?.config_profile_uuid ?? '',
      uuid: h.inbound?.inbound_uuid ?? '',
      profileName: h.inbound?.profile_name ?? '',
      tag: h.inbound?.inbound_tag ?? '',
    },
    tags: [...(h.tags ?? [])],
    squadMode: h.internal_squads?.mode === 'ALLOW_ONLY' ? 'ALLOW_ONLY' : 'EXCLUDE',
    squads: [...(h.internal_squads?.squads ?? [])],
    sni: listToText(h.sni),
    overrideSni: !!h.override_sni_from_address,
    keepSniBlank: !!h.keep_sni_blank,
    fingerprint: listToText(h.fingerprint),
    alpn: h.alpn ?? '',
    security: h.security_layer ?? 'DEFAULT',
    vlessRoute: h.vless_route_id === null || h.vless_route_id === undefined ? '' : String(h.vless_route_id),
    host: listToText(h.host),
    path: listToText(h.path),
    description: h.server_description ?? '',
    excludeSub: [...(h.exclude_from_subscription_types ?? [])],
    shuffle: !!h.shuffle_host,
    template: h.xray_json_template_uuid ?? '',
    mapper: jsonText(h.mapper),
    mux: jsonText(h.mux_params),
    sockopt: jsonText(h.sockopt_params),
    final_mask: jsonText(h.final_mask),
    xhttp: jsonText(h.xhttp_extra_params),
    pinnedCert: [...(h.pinned_peer_cert_sha256 ?? [])],
    verifyName: [...(h.verify_peer_cert_by_name ?? [])],
    x25519: !!h.mihomo_x25519,
    mihomoIp: h.mihomo_ip_version ?? '',
  }
}

/** Есть ли у опции значение (тогда её показываем в форме сразу). */
const HAS_VALUE: Record<HostOptKey, (d: HostDraft) => boolean> = {
  tags: (d) => d.tags.length > 0,
  nodes: (d) => d.nodes.length > 0,
  squads: (d) => d.squads.length > 0 || d.squadMode !== 'EXCLUDE',
  sni: (d) => d.sni.trim() !== '',
  overrideSni: (d) => d.overrideSni,
  keepSniBlank: (d) => d.keepSniBlank,
  security: (d) => d.security !== 'DEFAULT',
  fingerprint: (d) => d.fingerprint.trim() !== '',
  vlessRoute: (d) => d.vlessRoute.trim() !== '',
  host: (d) => d.host.trim() !== '',
  path: (d) => d.path.trim() !== '',
  alpn: (d) => d.alpn.trim() !== '',
  description: (d) => d.description.trim() !== '',
  excludeSub: (d) => d.excludeSub.length > 0,
  hidden: (d) => d.hidden,
  shuffle: (d) => d.shuffle,
  template: (d) => d.template !== '',
  mapper: (d) => d.mapper !== '',
  mux: (d) => d.mux !== '',
  final_mask: (d) => d.final_mask !== '',
  xhttp: (d) => d.xhttp !== '',
  sockopt: (d) => d.sockopt !== '',
  pinnedCert: (d) => d.pinnedCert.length > 0,
  verifyName: (d) => d.verifyName.length > 0,
  x25519: (d) => d.x25519,
  mihomoIp: (d) => d.mihomoIp !== '',
}

/** Какие необязательные опции у хоста уже заданы (их показываем сразу). */
export function initialShown(d: HostDraft): Set<HostOptKey> {
  const s = new Set<HostOptKey>()
  for (const g of OPT_GROUPS) for (const k of g.keys) if (HAS_VALUE[k](d)) s.add(k)
  return s
}

const TRIMMED: HostDraftKey[] = ['sni', 'fingerprint', 'host', 'path', 'alpn', 'description', 'vlessRoute', 'mihomoIp']
/** Массивы-множества: порядок не важен. */
const SETS: HostDraftKey[] = ['nodes', 'squads', 'excludeSub']

export function fieldChanged(a: HostDraft, b: HostDraft, k: HostDraftKey): boolean {
  if (k === 'inbound') return a.inbound.uuid !== b.inbound.uuid || a.inbound.profile !== b.inbound.profile
  const x = a[k]
  const y = b[k]
  if (Array.isArray(x) && Array.isArray(y)) {
    const nx = SETS.includes(k) ? [...x].sort() : x
    const ny = SETS.includes(k) ? [...y].sort() : y
    return nx.join('|') !== ny.join('|')
  }
  if (TRIMMED.includes(k)) return String(x).trim() !== String(y).trim()
  return x !== y
}

/** Изменилось ли хотя бы одно поле опции. */
export const optChanged = (a: HostDraft, b: HostDraft, k: HostOptKey): boolean => OPT_FIELDS[k].some((f) => fieldChanged(a, b, f))

const ALL_KEYS = [
  'remark',
  'disabled',
  'hidden',
  'address',
  'port',
  'nodes',
  'inbound',
  'tags',
  'squadMode',
  'squads',
  'sni',
  'overrideSni',
  'keepSniBlank',
  'fingerprint',
  'alpn',
  'security',
  'vlessRoute',
  'host',
  'path',
  'description',
  'excludeSub',
  'shuffle',
  'template',
  'mapper',
  'mux',
  'sockopt',
  'final_mask',
  'xhttp',
  'pinnedCert',
  'verifyName',
  'x25519',
  'mihomoIp',
] as const satisfies readonly HostDraftKey[]

export function isDirty(draft: HostDraft, base: HostDraft): boolean {
  return ALL_KEYS.some((k) => fieldChanged(draft, base, k))
}

export type HostErrorCode = 'required' | 'invalidPort' | 'invalidVlessRoute'
export type HostErrors = Partial<Record<'remark' | 'address' | 'port' | 'vlessRoute', HostErrorCode>>

export function validate(d: HostDraft): HostErrors {
  const e: HostErrors = {}
  if (!d.remark.trim()) e.remark = 'required'
  if (!d.address.trim()) e.address = 'required'
  const p = Number(d.port)
  if (!d.port.trim() || !Number.isInteger(p) || p < 1 || p > 65535) e.port = d.port.trim() ? 'invalidPort' : 'required'
  if (d.vlessRoute.trim() !== '') {
    const r = Number(d.vlessRoute)
    if (!Number.isInteger(r) || r < 0 || r > 65535) e.vlessRoute = 'invalidVlessRoute'
  }
  return e
}

const parseJson = (s: string): unknown => (s.trim() === '' ? null : JSON.parse(s))

/** PATCH только из изменённых полей: всё остальное панель не трогает. */
export function buildPatch(draft: HostDraft, base: HostDraft): AdminHostPatchBody {
  const b: AdminHostPatchBody = {}
  const ch = (k: HostDraftKey) => fieldChanged(draft, base, k)
  if (ch('remark')) b.remark = draft.remark.trim()
  if (ch('disabled')) b.is_disabled = draft.disabled
  if (ch('hidden')) b.is_hidden = draft.hidden
  if (ch('address')) b.address = draft.address.trim()
  if (ch('port')) b.port = Number(draft.port)
  if (ch('nodes')) b.node_uuids = draft.nodes
  if (ch('inbound') && draft.inbound.uuid && draft.inbound.profile) {
    b.inbound = { config_profile_uuid: draft.inbound.profile, inbound_uuid: draft.inbound.uuid }
  }
  if (ch('tags')) b.tags = draft.tags
  if (ch('squadMode') || ch('squads')) b.internal_squads = { mode: draft.squadMode, squads: draft.squads }
  if (ch('sni')) b.sni = nullIfEmpty(draft.sni)
  if (ch('overrideSni')) b.override_sni_from_address = draft.overrideSni
  if (ch('keepSniBlank')) b.keep_sni_blank = draft.keepSniBlank
  if (ch('fingerprint')) b.fingerprint = nullIfEmpty(draft.fingerprint)
  if (ch('alpn')) b.alpn = nullIfEmpty(draft.alpn)
  if (ch('security')) b.security_layer = draft.security
  if (ch('vlessRoute')) b.vless_route_id = draft.vlessRoute.trim() === '' ? null : Number(draft.vlessRoute)
  if (ch('host')) b.host = nullIfEmpty(draft.host)
  if (ch('path')) b.path = nullIfEmpty(draft.path)
  if (ch('description')) b.server_description = nullIfEmpty(draft.description)
  if (ch('excludeSub')) b.exclude_from_subscription_types = draft.excludeSub
  if (ch('shuffle')) b.shuffle_host = draft.shuffle
  if (ch('template')) b.xray_json_template_uuid = draft.template === '' ? null : draft.template
  if (ch('mapper')) b.mapper = parseJson(draft.mapper)
  if (ch('mux')) b.mux_params = parseJson(draft.mux)
  if (ch('sockopt')) b.sockopt_params = parseJson(draft.sockopt)
  if (ch('final_mask')) b.final_mask = parseJson(draft.final_mask)
  if (ch('xhttp')) b.xhttp_extra_params = parseJson(draft.xhttp)
  if (ch('pinnedCert')) b.pinned_peer_cert_sha256 = draft.pinnedCert
  if (ch('verifyName')) b.verify_peer_cert_by_name = draft.verifyName
  if (ch('x25519')) b.mihomo_x25519 = draft.x25519
  if (ch('mihomoIp')) b.mihomo_ip_version = nullIfEmpty(draft.mihomoIp)
  return b
}

/** Проверка текста JSON: пусто — «не задано» (валидно). */
export function checkJson(text: string): { ok: true; pretty: string } | { ok: false } {
  if (text.trim() === '') return { ok: true, pretty: '' }
  try {
    return { ok: true, pretty: JSON.stringify(JSON.parse(text), null, 2) }
  } catch {
    return { ok: false }
  }
}
