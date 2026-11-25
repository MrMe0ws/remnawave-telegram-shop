import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Bell,
  TrendingUp,
  AlertTriangle,
  Ban,
  BarChart3,
  ChevronUp,
  CircleAlert,
  Clock,
  Cloud,
  Copy,
  Cpu,
  Ellipsis,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  HardDrive,
  Link2,
  ServerCog,
  Network,
  Pencil,
  Power,
  RefreshCw,
  RotateCw,
  Save,
  Server,
  Sparkle,
  Tag,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/clipboard'
import { hapticTap } from '@/lib/haptic'
import { cn } from '@/lib/utils'
import type { AdminNodeAction, AdminNodeDetailDTO, AdminNodeState } from '@/lib/types/admin'
import { AdminConfirmModal } from '../components/AdminConfirmModal'
import { AdminModal } from '../components/AdminModal'
import { AdminSectionCard } from '../components/AdminSectionCard'
import { AdminSelect } from '../components/AdminSelect'
import { AdminToggleSwitch } from '../components/AdminToggleSwitch'
import { CountryFlag } from '../components/CountryFlag'
import { CountrySelect } from '../components/CountrySelect'
import { formatBytes, formatBitrate, formatUptime, daysUntilReset } from './format'
import { FaviconImg, FormField, IconInput, MultiplierStepper, TagsInput, TEXTAREA_CLASS } from './NodeFormControls'
import { faviconSrcFromUrl } from '../utils/normalizeUrl'
import { NodeProfilesPanel } from './NodeProfilesPanel'
import { NodeSidePanels, type NodeSidePanelKind } from './NodeSidePanels'
import { buildPatch, sameDraft, toDraft, validateDraft, type NodeDraft } from './nodeForm'
import { useHoverTip } from './HoverTip'

/** Тон состояния: цвет значка «Подробностей» и кнопки питания. */
const STATE_TONE: Record<AdminNodeState, { icon: LucideIcon; box: string }> = {
  online: { icon: Activity, box: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  connecting: { icon: Cloud, box: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  offline: { icon: CircleAlert, box: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400' },
  disabled: { icon: Ban, box: 'border-border bg-muted/40 text-muted-foreground' },
}

type Pending = Exclude<AdminNodeAction, 'enable'> | 'delete'

function Bar({ pct, tone = 'ok' }: { pct: number; tone?: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'bg-red-500' : tone === 'warn' ? 'bg-orange-500' : 'bg-emerald-500'
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-border/80">
      <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

/** Плашка с числом под трафиком. hint — подсказка при наведении (у числа юзеров её нет: там и так понятно). */
function StatTile({ icon: Icon, value, className, hint }: { icon: LucideIcon; value: ReactNode; className: string; hint?: string }) {
  const { handlers, tip } = useHoverTip(hint ?? '')
  return (
    <div
      aria-label={hint}
      {...(hint ? handlers : {})}
      className={cn('flex h-11 items-center justify-center gap-2 rounded-[10px] border font-mono text-[13px] font-extrabold', className)}
    >
      <Icon className="size-4" aria-hidden />
      {value}
      {hint && tip}
    </div>
  )
}

const SUB_TONE = {
  emerald: 'border-emerald-500/25 bg-emerald-500/[0.07]',
  cyan: 'border-cyan-500/25 bg-cyan-500/[0.07]',
  violet: 'border-violet-500/25 bg-violet-500/[0.07]',
} as const

function SubBlock({ children, className, tone }: { children: ReactNode; className?: string; tone?: keyof typeof SUB_TONE }) {
  return <div className={cn('rounded-[10px] border p-3', tone ? SUB_TONE[tone] : 'border-border/70 bg-background/70 dark:bg-muted/30', className)}>{children}</div>
}

const CAP = 'text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground'

const PANEL_TONE = {
  emerald: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20',
  indigo: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20',
  cyan: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20',
  sky: 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20',
} as const

/** Значок-кнопка в «Подробностях»: открывает боковую панель. */
function PanelButton({
  kind,
  icon: Icon,
  tone,
  title,
  onOpen,
}: {
  kind: NodeSidePanelKind
  icon: LucideIcon
  tone: keyof typeof PANEL_TONE
  title: string
  onOpen: (k: NodeSidePanelKind) => void
}) {
  const { handlers, tip } = useHoverTip(title)
  return (
    <button
      type="button"
      aria-label={title}
      {...handlers}
      onClick={() => onOpen(kind)}
      className={cn('flex size-9 items-center justify-center rounded-[9px] border transition-colors', PANEL_TONE[tone])}
    >
      <Icon className="size-4" aria-hidden />
      {tip}
    </button>
  )
}

/** Плашка «JSON» в «Подробностях»: пока только подпись, без действия. */
function MetadataBadge({ label }: { label: string }) {
  const { handlers, tip } = useHoverTip(label)
  return (
    <span
      role="img"
      tabIndex={0}
      aria-label={label}
      {...handlers}
      className="flex size-9 cursor-default select-none items-center justify-center rounded-[9px] bg-muted/50 font-mono text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground"
    >
      JSON
      {tip}
    </span>
  )
}

/** Меню «Ещё действия»: открывается вверх, закрывается кликом вне и по Esc. */
function ActionsMenu({
  state,
  onCopyUuid,
  onPick,
}: {
  state: AdminNodeState
  onCopyUuid: () => void
  onPick: (a: Pending | 'enable') => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-secondary'
  const pick = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  return (
    <div ref={ref} className="relative max-sm:flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[11px] border border-border bg-card px-4 text-sm font-bold max-sm:gap-1.5 max-sm:px-2 transition-colors hover:bg-secondary"
      >
        <Ellipsis className="size-4 max-sm:hidden" aria-hidden />
        {t('admin.nodes.detail.moreActions')}
        <ChevronUp className={cn('size-4 transition-transform', !open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl shadow-black/30 max-sm:w-full">
          <button type="button" className={cn(item, 'text-red-600 dark:text-red-400')} onClick={pick(() => onPick('delete'))}>
            <Trash2 className="size-4" aria-hidden />
            {t('admin.nodes.detail.delete')}
          </button>
          <div className="my-1 border-t border-border/70" />
          <button type="button" className={item} onClick={pick(onCopyUuid)}>
            <Copy className="size-4" aria-hidden />
            {t('admin.nodes.detail.copyUuid')}
          </button>
          <button type="button" className={item} onClick={pick(() => onPick('reset-traffic'))}>
            <RotateCw className="size-4" aria-hidden />
            {t('admin.nodes.detail.resetTraffic')}
          </button>
          {state !== 'disabled' && (
            <button type="button" className={cn(item, 'text-emerald-600 dark:text-emerald-400')} onClick={pick(() => onPick('restart'))}>
              <RefreshCw className="size-4" aria-hidden />
              {t('admin.nodes.detail.restart')}
            </button>
          )}
          {state === 'disabled' ? (
            <button type="button" className={cn(item, 'text-emerald-600 dark:text-emerald-400')} onClick={pick(() => onPick('enable'))}>
              <Power className="size-4" aria-hidden />
              {t('admin.nodes.detail.enable')}
            </button>
          ) : (
            <button type="button" className={cn(item, 'text-red-600 dark:text-red-400')} onClick={pick(() => onPick('disable'))}>
              <Ban className="size-4" aria-hidden />
              {t('admin.nodes.detail.disable')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function NodeDetailModal({ uuid, onClose }: { uuid: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState<Pending | null>(null)

  const q = useQuery({
    queryKey: ['admin-node', uuid],
    queryFn: () => api.adminNode(uuid as string),
    enabled: !!uuid,
    refetchInterval: 10_000,
  })
  // Пока окно уезжает, uuid уже сброшен: держим последние данные, как это делает AdminModal.
  const lastRef = useRef<AdminNodeDetailDTO | null>(null)
  if (q.data) lastRef.current = q.data
  const node = q.data ?? (uuid ? null : lastRef.current)

  const action = useMutation({
    mutationFn: ({ id, a }: { id: string; a: AdminNodeAction | 'delete' }) =>
      a === 'delete' ? api.adminNodeDelete(id) : api.adminNodeAction(id, a),
    onSuccess: (_r, { a }) => {
      toast.success(t(`admin.nodes.detail.done.${a}`))
      void qc.invalidateQueries({ queryKey: ['admin-nodes'] })
      if (a === 'delete') onClose()
      else void qc.invalidateQueries({ queryKey: ['admin-node', uuid] })
    },
    onError: () => toast.error(t('admin.nodes.detail.actionError')),
  })
  const run = (a: AdminNodeAction | 'delete') => {
    if (!uuid) return
    setConfirm(null)
    action.mutate({ id: uuid, a })
  }
  const pick = (a: Pending | 'enable') => {
    if (a === 'enable') run('enable')
    else setConfirm(a)
  }

  const copy = async (value: string, okKey: string) => {
    if (await copyToClipboard(value)) {
      hapticTap()
      toast.success(t(okKey))
    }
  }


  // ---- Форма: черновик, сравнение с сервером, сохранение ----
  const optionsQ = useQuery({
    queryKey: ['admin-node-options'],
    queryFn: () => api.adminNodeOptions(),
    enabled: !!uuid,
    staleTime: 60_000,
  })
  const options = optionsQ.data

  const [draft, setDraft] = useState<NodeDraft | null>(null)
  const [base, setBase] = useState<NodeDraft | null>(null)
  const baseRef = useRef<NodeDraft | null>(null)
  const baseUuidRef = useRef<string | null>(null)
  // Данные с сервера обновляются опросом: ввод пользователя затираем только если он ничего не менял.
  useEffect(() => {
    if (!node) return
    const nb = toDraft(node)
    const prev = baseRef.current
    const sameNode = baseUuidRef.current === node.uuid
    baseRef.current = nb
    baseUuidRef.current = node.uuid
    setBase(nb)
    setDraft((d) => (!d || !sameNode || !prev || sameDraft(d, prev) ? nb : d))
  }, [node])

  const form = draft ?? (node ? toDraft(node) : null)
  const errors = useMemo(() => (form ? validateDraft(form) : {}), [form])
  const hasErrors = Object.keys(errors).length > 0
  const patch = useMemo(() => (form && base ? buildPatch(form, base) : {}), [form, base])
  const dirty = Object.keys(patch).length > 0
  const set = <K extends keyof NodeDraft>(k: K, v: NodeDraft[K]) =>
    setDraft((prev) => ({ ...(prev ?? (node ? toDraft(node) : (null as never))), [k]: v }))
  const err = (k: keyof typeof errors) => (errors[k] ? t(`admin.nodes.edit.err.${errors[k]}`) : undefined)

  const save = useMutation({
    mutationFn: () => api.adminNodePatch(uuid as string, patch),
    onSuccess: (res) => {
      const nb = toDraft(res)
      baseRef.current = nb
      baseUuidRef.current = res.uuid
      setBase(nb)
      setDraft(nb)
      qc.setQueryData(['admin-node', uuid], res)
      toast.success(t('admin.nodes.edit.saved'))
      void qc.invalidateQueries({ queryKey: ['admin-nodes'] })
      void qc.invalidateQueries({ queryKey: ['admin-node', uuid] })
    },
    onError: () => toast.error(t('admin.nodes.edit.saveError')),
  })
  const [discardAsk, setDiscardAsk] = useState(false)
  const requestClose = () => {
    if (save.isPending) return
    if (dirty) setDiscardAsk(true)
    else onClose()
  }
  const discard = () => {
    setDiscardAsk(false)
    if (base) setDraft(base)
    onClose()
  }

  // ---- Secret Key: только по клику, живёт в состоянии окна, не в кэше ----
  const [secret, setSecret] = useState<string | null>(null)
  const [secretShown, setSecretShown] = useState(false)
  const fetchSecret = useMutation({
    mutationFn: () => api.adminNodeSecretKey(uuid as string),
    onError: () => toast.error(t('admin.nodes.edit.secretError')),
  })
  const showSecret = async () => {
    if (secretShown) {
      setSecretShown(false)
      return
    }
    const key = secret ?? (await fetchSecret.mutateAsync()).secret_key
    setSecret(key)
    setSecretShown(true)
  }
  const copySecret = async () => {
    const key = secret ?? (await fetchSecret.mutateAsync()).secret_key
    setSecret(key)
    await copy(key, 'admin.nodes.edit.secretCopied')
  }
  // Показанный ключ прячем через минуту, при закрытии окна и при смене ноды.
  useEffect(() => {
    if (!secret) return
    const id = window.setTimeout(() => {
      setSecret(null)
      setSecretShown(false)
    }, 60_000)
    return () => window.clearTimeout(id)
  }, [secret])

  // ---- Metadata, боковые панели ----
  const [panel, setPanel] = useState<NodeSidePanelKind | null>(null)
  const [profilesOpen, setProfilesOpen] = useState(false)
  useEffect(() => {
    if (uuid) return
    setSecret(null)
    setSecretShown(false)
    setPanel(null)
    setProfilesOpen(false)
    setDiscardAsk(false)
  }, [uuid])

  const limit = node?.traffic_limit_bytes ?? 0
  const pct = node && limit > 0 ? (node.traffic_used_bytes / limit) * 100 : 100
  const tone = limit > 0 ? (pct >= 95 ? 'bad' : pct >= 80 ? 'warn' : 'ok') : 'ok'
  const st = node ? STATE_TONE[node.state] : STATE_TONE.online
  const StateIcon = st.icon
  const online = node?.state === 'online'
  const sys = node?.system
  const memPct = sys && sys.memory_total_bytes > 0 ? (sys.memory_used_bytes / sys.memory_total_bytes) * 100 : 0
  const ports = node ? Array.from(new Set(node.inbounds.map((i) => i.port).filter((p) => p > 0))) : []

  const confirmCfg = confirm && node && {
    disable: { title: 'disableTitle', text: 'disableText' },
    restart: { title: 'restartTitle', text: 'restartText' },
    'reset-traffic': { title: 'resetTitle', text: 'resetText' },
    delete: { title: 'deleteTitle', text: 'deleteText' },
  }[confirm]

  return (
    <>
      <AdminModal
        open={!!uuid}
        onClose={requestClose}
        dismissGuarded={dirty || save.isPending}
        title={node?.name ?? ''}
        icon={Cpu}
        iconAccent="emerald"
        panelClassName="sm:max-w-5xl"
        bodyClassName="max-sm:px-2.5 max-sm:py-3"
        titleSlot={
          node && (
            <div className="flex min-w-0 items-center gap-2.5">
              <CountryFlag code={node.country_code} className="h-[18px] w-[25px] shrink-0" />
              <h3 className="truncate text-lg font-semibold leading-tight">{node.name}</h3>
              <button
                type="button"
                title={t('admin.nodes.detail.copyLink')}
                aria-label={t('admin.nodes.detail.copyLink')}
                onClick={() =>
                  void copy(`${window.location.origin}/cabinet/admin/nodes?node=${node.uuid}`, 'admin.nodes.detail.linkCopied')
                }
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Link2 className="size-4" aria-hidden />
              </button>
            </div>
          )
        }
        footer={
          node && (
            <div className="flex justify-end gap-2.5">
              <ActionsMenu
                state={node.state}
                onCopyUuid={() => void copy(node.uuid, 'admin.nodes.detail.uuidCopied')}
                onPick={pick}
              />
              <Button
                type="button"
                loading={save.isPending}
                disabled={!dirty || hasErrors}
                onClick={() => save.mutate()}
                className="h-11 rounded-[11px] px-5 font-bold max-sm:flex-1"
              >
                <Save aria-hidden />
                {t('admin.save')}
              </Button>
            </div>
          )
        }
      >
        {!node && q.isError && (
          <div className="p-6 text-center text-sm text-muted-foreground">{t('admin.nodes.detail.loadError')}</div>
        )}
        {!node && !q.isError && <div className="p-10 text-center text-sm text-muted-foreground">…</div>}
        {node && (
          <div className="flex flex-col gap-3 sm:gap-4 lg:grid lg:grid-cols-2 lg:items-start">
            {/* На телефоне колонки «растворяются» (contents), и порядок задают order-*: как в панели —
                Подробности, О системе, Основное, Конфигурация ядра, Учёт и биллинг, Расход. */}
            <div className="max-lg:contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
              {(node.state === 'offline' || node.state === 'connecting') && node.last_status_message && (
                <AdminSectionCard
                  className="max-lg:order-1"
                  level="raised"
                  title={t('admin.nodes.detail.lastError')}
                  icon={AlertTriangle}
                  iconAccent="rose"
                >
                  <div className="flex items-center gap-2 rounded-[10px] border border-border bg-background/60 py-2.5 pl-3 pr-2 font-mono text-[13px] [border-left:3px_solid_rgb(239_68_68)]">
                    <span className="min-w-0 flex-1 break-words">&quot;{node.last_status_message}&quot;</span>
                    <button
                      type="button"
                      aria-label={t('admin.nodes.detail.copy')}
                      onClick={() => void copy(node.last_status_message ?? '', 'admin.nodes.detail.copied')}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="size-4" aria-hidden />
                    </button>
                  </div>
                </AdminSectionCard>
              )}

              <AdminSectionCard
                className="max-lg:order-2"
                level="raised"
                title={t('admin.nodes.detail.details')}
                icon={StateIcon}
                headerRightInline
                iconAccent={node.state === 'disabled' ? undefined : node.state === 'online' ? 'emerald' : node.state === 'connecting' ? 'amber' : 'rose'}
                headerRight={
                  <div className="flex items-center gap-2">
                    {online && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        <Sparkle className="size-3" aria-hidden />
                        {formatUptime(node.xray_uptime_sec).toUpperCase()}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={action.isPending}
                      title={node.state === 'disabled' ? t('admin.nodes.detail.power.on') : t('admin.nodes.detail.power.off')}
                      aria-label={node.state === 'disabled' ? t('admin.nodes.detail.power.on') : t('admin.nodes.detail.power.off')}
                      onClick={() => (node.state === 'disabled' ? run('enable') : setConfirm('disable'))}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-50',
                        node.state === 'disabled'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20',
                      )}
                    >
                      <Power className="size-4" aria-hidden />
                    </button>
                  </div>
                }
              >
                <div className="mb-4 flex items-center justify-end gap-2">
                  <MetadataBadge label={t('admin.nodes.detail.metadata')} />
                  <span className="mx-0.5 h-5 w-px bg-border" />
                  <PanelButton kind="hosts" icon={ServerCog} tone="cyan" title={t('admin.nodes.detail.hosts')} onOpen={setPanel} />
                  <PanelButton kind="tree" icon={Network} tone="emerald" title={t('admin.nodes.detail.inbounds')} onOpen={setPanel} />
                  <span className="mx-0.5 h-5 w-px bg-border" />
                  <PanelButton kind="usage" icon={BarChart3} tone="indigo" title={t('admin.nodes.detail.usage')} onOpen={setPanel} />
                  <PanelButton kind="sessions" icon={Users} tone="sky" title={t('admin.nodes.detail.sessions')} onOpen={setPanel} />
                </div>

                <div className="flex items-baseline justify-between font-mono">
                  <b className="text-[15px]">{formatBytes(node.traffic_used_bytes)}</b>
                  <span className="text-xs text-muted-foreground">{limit > 0 ? formatBytes(limit) : '∞'}</span>
                </div>
                <div className="mt-2">
                  <Bar pct={pct} tone={tone} />
                </div>
                {node.traffic_reset_day > 0 && (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <RotateCw className="size-3" aria-hidden />
                    {t('admin.nodes.detail.resetIn', { days: daysUntilReset(node.traffic_reset_day) })}
                  </div>
                )}

                {online && (
                  <div className="mt-4 grid gap-2 border-t border-border/60 pt-4 sm:grid-cols-3">
                    <StatTile
                      icon={Users}
                      value={node.users_online}
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    />
                    <StatTile
                      icon={Sparkle}
                      value={node.xray_version ?? '—'}
                      hint={t('admin.nodes.xrayTitle')}
                      className="border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                    />
                    <StatTile
                      icon={Server}
                      value={node.node_version ?? '—'}
                      hint={t('admin.nodes.nodeTitle')}
                      className="border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                    />
                  </div>
                )}
              </AdminSectionCard>

              <AdminSectionCard className="max-lg:order-4" level="raised" title={t('admin.nodes.detail.main')} description={node.uuid} icon={Server} iconAccent="blue">
                {form && (
                  <div className="flex flex-col gap-4">
                    <FormField label={t('admin.nodes.detail.country')}>
                      <CountrySelect
                        value={form.country_code}
                        onChange={(c) => set('country_code', c)}
                        placeholder={t('admin.nodes.edit.countryPlaceholder')}
                      />
                    </FormField>
                    <FormField label={t('admin.nodes.detail.internalName')} required error={err('name')}>
                      <Input value={form.name} error={!!errors.name} maxLength={100} onChange={(e) => set('name', e.target.value)} />
                    </FormField>
                    <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                      <FormField label={t('admin.nodes.detail.address')} required error={err('address')}>
                        <Input
                          value={form.address}
                          error={!!errors.address}
                          className="font-mono text-[13px]"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(e) => set('address', e.target.value)}
                        />
                      </FormField>
                      <FormField label={t('admin.nodes.detail.port')} required error={err('port')}>
                        <Input
                          value={form.port}
                          error={!!errors.port}
                          inputMode="numeric"
                          className="font-mono text-[13px]"
                          onChange={(e) => set('port', e.target.value.replace(/\D/g, '').slice(0, 5))}
                        />
                      </FormField>
                    </div>
                    <FormField label={t('admin.nodes.edit.secretKey')}>
                      <div className="flex min-h-10 items-center gap-1 rounded-lg border border-input bg-muted/40 py-1 pl-3 pr-1.5 font-mono text-[13px]">
                        <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 select-all truncate px-1.5">
                          {secretShown && secret ? secret : '••••••••••••••••••••••••'}
                        </span>
                        <button
                          type="button"
                          disabled={fetchSecret.isPending}
                          onClick={() => void showSecret()}
                          title={secretShown ? t('admin.nodes.edit.secretHide') : t('admin.nodes.edit.secretShow')}
                          aria-label={secretShown ? t('admin.nodes.edit.secretHide') : t('admin.nodes.edit.secretShow')}
                          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                        >
                          {fetchSecret.isPending ? <Spinner /> : secretShown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                        </button>
                        <button
                          type="button"
                          disabled={fetchSecret.isPending}
                          onClick={() => void copySecret()}
                          title={t('admin.nodes.detail.copy')}
                          aria-label={t('admin.nodes.detail.copy')}
                          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                        >
                          <Copy className="size-4" aria-hidden />
                        </button>
                      </div>
                    </FormField>
                    <FormField label={t('admin.nodes.detail.plugin')}>
                      <AdminSelect
                        value={form.plugin_uuid || null}
                        options={(options?.plugins ?? []).map((p) => ({ value: p.uuid, label: p.name }))}
                        onChange={(v) => set('plugin_uuid', v ?? '')}
                        placeholder={t('admin.nodes.detail.pluginNone')}
                        ariaLabel={t('admin.nodes.detail.plugin')}
                        className="[&>button]:bg-background dark:[&>button]:bg-input"
                        allowEmpty
                        busy={optionsQ.isLoading}
                        disabled={!optionsQ.isLoading && (options?.plugins ?? []).length === 0}
                      />
                    </FormField>
                    <FormField label={t('admin.nodes.detail.proxyUrl')} hint={t('admin.nodes.detail.proxyHint')} error={err('proxy_url')}>
                      <Input
                        value={form.proxy_url}
                        error={!!errors.proxy_url}
                        placeholder="socks5://user:pass@address:port"
                        className="font-mono text-[13px]"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => set('proxy_url', e.target.value)}
                      />
                    </FormField>
                  </div>
                )}
              </AdminSectionCard>

              <AdminSectionCard className="max-lg:order-7" level="raised" title={t('admin.nodes.detail.consumption')} icon={Activity} iconAccent="violet">
                {form && (
                  <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                    <FormField label={t('admin.nodes.detail.userMultiplier')} error={err('mult_user')}>
                      <MultiplierStepper
                        value={form.mult_user}
                        onChange={(v) => set('mult_user', v)}
                        error={!!errors.mult_user}
                        ariaLabel={t('admin.nodes.detail.userMultiplier')}
                      />
                    </FormField>
                    <FormField label={t('admin.nodes.detail.nodeMultiplier')} error={err('mult_node')}>
                      <MultiplierStepper
                        value={form.mult_node}
                        onChange={(v) => set('mult_node', v)}
                        error={!!errors.mult_node}
                        ariaLabel={t('admin.nodes.detail.nodeMultiplier')}
                      />
                    </FormField>
                  </div>
                )}
              </AdminSectionCard>
            </div>

            <div className="max-lg:contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
              {online && sys && (
                <AdminSectionCard
                  className="max-lg:order-3"
                  level="raised"
                  title={t('admin.nodes.detail.system')}
                  icon={HardDrive}
                  headerRightInline
                  iconAccent="violet"
                  headerRight={
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <span className="max-sm:hidden rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-mono text-[10px] font-extrabold uppercase text-violet-700 dark:text-violet-300">
                        {sys.platform} / {sys.arch}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">
                        <Clock className="size-3" aria-hidden />
                        {formatLongUptime(sys.uptime_sec)}
                      </span>
                    </div>
                  }
                >
                  <div className="flex flex-col gap-3">
                    <SubBlock tone="emerald">
                      <div className={CAP}>{t('admin.nodes.detail.memory')}</div>
                      <div className="mb-2 mt-1 font-mono text-[13px] font-bold">
                        {formatBytes(sys.memory_used_bytes)} / {formatBytes(sys.memory_total_bytes)}{' '}
                        <span className="font-normal text-muted-foreground">({Math.round(memPct)}%)</span>
                      </div>
                      <Bar pct={memPct} tone={memPct > 90 ? 'bad' : memPct > 70 ? 'warn' : 'ok'} />
                    </SubBlock>
                    <SubBlock tone="cyan">
                      <div className="flex items-center justify-between">
                        <span className={CAP}>{t('admin.nodes.detail.interface')}</span>
                        {sys.interface && (
                          <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300">
                            {sys.interface}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3 font-mono">
                        <div>
                          <div className={CAP}>↓ RX</div>
                          <div className="text-[13px] font-bold">{formatBitrate(sys.rx_bytes_per_sec)}</div>
                          <div className="text-[10.5px] text-muted-foreground">
                            {t('admin.nodes.detail.total')}: {formatBytes(sys.rx_total_bytes)}
                          </div>
                        </div>
                        <div>
                          <div className={CAP}>↑ TX</div>
                          <div className="text-[13px] font-bold">{formatBitrate(sys.tx_bytes_per_sec)}</div>
                          <div className="text-[10.5px] text-muted-foreground">
                            {t('admin.nodes.detail.total')}: {formatBytes(sys.tx_total_bytes)}
                          </div>
                        </div>
                      </div>
                    </SubBlock>
                    <SubBlock tone="violet">
                      <div className={CAP}>{t('admin.nodes.detail.systemInfo')}</div>
                      <div className="mt-1.5 flex flex-col gap-2 font-mono text-[13px]">
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Cpu className="size-3" aria-hidden />
                            {t('admin.nodes.detail.cpu')}
                          </div>
                          <div className="font-bold">
                            {sys.cpus} x {sys.cpu_model}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[11px] text-muted-foreground">{t('admin.nodes.detail.kernel')}</div>
                            <div className="font-bold">{sys.kernel || '—'}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-foreground">{t('admin.nodes.detail.network')}</div>
                            <div className="font-bold">{sys.interface || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </SubBlock>
                  </div>
                </AdminSectionCard>
              )}

              <AdminSectionCard className="max-lg:order-5" level="raised" title={t('admin.nodes.detail.core')} icon={Sparkle} iconAccent="emerald">
                <div
                  role="button"
                  tabIndex={0}
                  title={t('admin.nodes.edit.profiles.open')}
                  aria-label={t('admin.nodes.edit.profiles.open')}
                  onClick={() => setProfilesOpen(true)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      setProfilesOpen(true)
                    }
                  }}
                  className="cursor-pointer rounded-[10px] border border-border/70 bg-background/70 p-3 transition-colors hover:bg-background dark:bg-muted/30 dark:hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {node.config_profile_uuid ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                          <Sparkle className="size-4" aria-hidden />
                        </span>
                        <b className="min-w-0 flex-1 truncate font-mono text-sm">{node.config_profile_name || node.config_profile_uuid}</b>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-mono text-xs font-bold text-sky-700 dark:text-sky-300">
                          <Tag className="size-3" aria-hidden />
                          {node.inbounds.length}
                        </span>
                        <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
                          <Pencil className="size-4" aria-hidden />
                        </span>
                      </div>
                      {ports.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {ports.map((p) => (
                            <span key={p} className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                      {t('admin.nodes.detail.coreNone')}
                      <span className="flex size-8 shrink-0 items-center justify-center">
                        <Pencil className="size-4" aria-hidden />
                      </span>
                    </div>
                  )}
                </div>
              </AdminSectionCard>

              <AdminSectionCard className="max-lg:order-6" level="raised" title={t('admin.nodes.detail.billing')} icon={Wallet} iconAccent="amber">
                {form && (
                  <div className="flex flex-col gap-4">
                    <FormField label={t('admin.nodes.detail.provider')}>
                      <AdminSelect
                        value={form.provider_uuid || null}
                        options={(options?.providers ?? []).map((p) => {
                          const icon = faviconSrcFromUrl(p.favicon_link)
                          return { value: p.uuid, label: p.name, icon: icon ? <FaviconImg src={icon} /> : undefined }
                        })}
                        onChange={(v) => set('provider_uuid', v ?? '')}
                        placeholder={t('admin.nodes.detail.providerNone')}
                        ariaLabel={t('admin.nodes.detail.provider')}
                        className="[&>button]:bg-background dark:[&>button]:bg-input"
                        allowEmpty
                        busy={optionsQ.isLoading}
                        disabled={!optionsQ.isLoading && (options?.providers ?? []).length === 0}
                      />
                    </FormField>
                    <div className="rounded-[10px] border border-border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                        <span className="flex items-center gap-2">
                          <Activity className="size-4 text-primary" aria-hidden />
                          {t('admin.nodes.detail.tracking')}
                        </span>
                        <AdminToggleSwitch
                          checked={form.tracking}
                          onChange={(v) => set('tracking', v)}
                          aria-label={t('admin.nodes.detail.tracking')}
                        />
                      </div>
                      {form.tracking && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <FormField label={t('admin.nodes.detail.limit')} error={err('limit')} className="col-span-2">
                            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
                              <IconInput
                                icon={TrendingUp}
                                value={form.limit}
                                error={!!errors.limit}
                                inputMode="decimal"
                                placeholder={t('admin.nodes.edit.limitPlaceholder')}
                                className="font-mono text-[13px]"
                                onChange={(e) => set('limit', e.target.value.replace(/[^\d.,]/g, ''))}
                              />
                              <AdminSelect
                                value={form.unit}
                                options={[
                                  { value: 'GiB', label: 'GiB' },
                                  { value: 'TiB', label: 'TiB' },
                                ]}
                                onChange={(v) => set('unit', v === 'TiB' ? 'TiB' : 'GiB')}
                                placeholder="GiB"
                                ariaLabel={t('admin.nodes.edit.unit')}
                                className="[&>button]:min-h-10 [&>button]:bg-background dark:[&>button]:bg-input"
                              />
                            </div>
                          </FormField>
                          <FormField label={t('admin.nodes.detail.resetDay')} error={err('reset_day')}>
                            <IconInput
                              icon={Clock}
                              value={form.reset_day}
                              error={!!errors.reset_day}
                              inputMode="numeric"
                              placeholder="1–31"
                              className="font-mono text-[13px]"
                              onChange={(e) => set('reset_day', e.target.value.replace(/\D/g, '').slice(0, 2))}
                            />
                          </FormField>
                          <FormField label={t('admin.nodes.detail.notifyAt')} error={err('notify')}>
                            <IconInput
                              icon={Bell}
                              value={form.notify}
                              error={!!errors.notify}
                              inputMode="numeric"
                              placeholder="0–100"
                              className="font-mono text-[13px]"
                              onChange={(e) => set('notify', e.target.value.replace(/\D/g, '').slice(0, 3))}
                            />
                          </FormField>
                        </div>
                      )}
                    </div>
                    <FormField label={t('admin.nodes.detail.tags')}>
                      <TagsInput
                        value={form.tags}
                        onChange={(v) => set('tags', v)}
                        suggestions={options?.tags ?? []}
                        placeholder={t('admin.nodes.edit.tagsPlaceholder')}
                        invalidText={t('admin.nodes.edit.err.tag')}
                        removeLabel={t('admin.nodes.edit.removeTag')}
                      />
                    </FormField>
                    <FormField label={t('admin.nodes.detail.note')}>
                      <textarea
                        value={form.note}
                        onChange={(e) => set('note', e.target.value)}
                        placeholder={t('admin.nodes.detail.noteEmpty')}
                        rows={3}
                        className={TEXTAREA_CLASS}
                      />
                    </FormField>
                  </div>
                )}
              </AdminSectionCard>
            </div>
          </div>
        )}
      </AdminModal>

      {uuid && <NodeSidePanels nodeUuid={uuid} panel={panel} onClose={() => setPanel(null)} />}
      <NodeProfilesPanel open={profilesOpen && !!node} onClose={() => setProfilesOpen(false)} node={node} />

      <AdminConfirmModal
        open={discardAsk}
        onClose={() => setDiscardAsk(false)}
        onConfirm={discard}
        title={t('admin.nodes.edit.discardTitle')}
        message={t('admin.nodes.edit.discardText')}
        confirmLabel={t('admin.nodes.edit.discard')}
        variant="destructive"
      />

      <AdminConfirmModal
        open={!!confirm && !!node}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && run(confirm)}
        title={confirmCfg ? t(`admin.nodes.detail.confirm.${confirmCfg.title}`) : ''}
        message={confirmCfg && node ? t(`admin.nodes.detail.confirm.${confirmCfg.text}`, { name: node.name }) : ''}
        confirmLabel={confirm === 'delete' ? t('admin.nodes.detail.delete') : undefined}
        variant={confirm === 'delete' || confirm === 'disable' ? 'destructive' : 'default'}
        loading={action.isPending}
      />
    </>
  )
}

/** 1D 19H 13M 52S — как в панели «О системе». */
function formatLongUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return [d && `${d}D`, (d || h) && `${h}H`, `${m}M`, `${s}S`].filter(Boolean).join(' ')
}
