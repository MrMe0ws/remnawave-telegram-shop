import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Braces, ChevronRight, Eye, EyeOff, Sparkle, Trash2, Undo2, X } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AdminHostDTO } from '@/lib/types/admin'
import { AdminSelect } from '../components/AdminSelect'
import { AdminToggleSwitch } from '../components/AdminToggleSwitch'
import { CountryFlag } from '../components/CountryFlag'
import {
  ALPNS,
  FINGERPRINTS,
  MIHOMO_IPS,
  OPT_FIELDS,
  OPT_GROUPS,
  OPT_LABEL,
  SUB_TYPES,
  TAGS_MAX,
  TAG_RE,
  buildPatch,
  checkJson,
  emptyOpt,
  fieldChanged,
  initialShown,
  isDirty,
  optChanged,
  toDraft,
  validate,
  type HostDraft,
  type HostDraftKey,
  type HostErrorCode,
  type HostJsonKey,
  type HostOptKey,
  type SquadMode,
} from './hostForm'
import { AddMenu, ChipInput, JsonButton, MultiPick } from './HostFields'
import { HostInboundPicker } from './HostInboundPicker'
import { PANEL_INPUT, PanelConfirm, PanelDialog, PanelError, PanelSkeleton } from './panelUi'

type Leave = 'back' | 'close'

/**
 * Состояние редактора хоста. Живёт на уровне панели «Назначенные хосты», потому что кнопки «Сохранить» и
 * «Удалить» стоят в подвале оболочки, а поля — в её теле.
 */
export function useHostEditor(hostUuid: string | null, nodeUuid: string, onGone: () => void) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['admin-host', hostUuid],
    queryFn: () => api.adminHost(hostUuid as string),
    enabled: !!hostUuid,
    refetchOnWindowFocus: false,
    gcTime: 0,
  })
  const templatesQ = useQuery({
    queryKey: ['admin-xray-templates'],
    queryFn: () => api.adminXrayTemplates(),
    enabled: !!hostUuid,
    staleTime: 60_000,
  })
  const nodesQ = useQuery({ queryKey: ['admin-nodes'], queryFn: () => api.adminNodes(), enabled: !!hostUuid, staleTime: 30_000 })
  const squadsQ = useQuery({ queryKey: ['admin-squads'], queryFn: () => api.adminSquads(), enabled: !!hostUuid, staleTime: 60_000 })

  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [base, setBase] = useState<HostDraft | null>(null)
  const [draft, setDraft] = useState<HostDraft | null>(null)
  const [shown, setShown] = useState<Set<HostOptKey>>(new Set())
  const [jsonKey, setJsonKey] = useState<HostJsonKey | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState<Leave | null>(null)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!hostUuid) {
      setLoadedFor(null)
      setBase(null)
      setDraft(null)
      setShown(new Set())
      setJsonKey(null)
      setPickerOpen(false)
      setConfirmDelete(false)
      setConfirmLeave(null)
      setTried(false)
      return
    }
    if (q.data && q.data.uuid === hostUuid && loadedFor !== hostUuid) {
      const d = toDraft(q.data)
      setBase(d)
      setDraft(d)
      setShown(initialShown(d))
      setLoadedFor(hostUuid)
    }
  }, [hostUuid, q.data, loadedFor])

  /** Опции, у которых в хосте уже есть значение: для них стрелка сбрасывает, а не убирает. */
  const initial = useMemo(() => (base ? initialShown(base) : new Set<HostOptKey>()), [base])

  const dirty = !!draft && !!base && isDirty(draft, base)
  const errors = draft ? validate(draft) : {}
  const invalid = Object.keys(errors).length > 0

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['admin-node-hosts', nodeUuid] })
    void qc.invalidateQueries({ queryKey: ['admin-node', nodeUuid] })
    void qc.invalidateQueries({ queryKey: ['admin-node-inbound-tree', nodeUuid] })
  }, [qc, nodeUuid])

  const save = useMutation({
    mutationFn: () => api.adminHostPatch(hostUuid as string, buildPatch(draft as HostDraft, base as HostDraft)),
    onSuccess: (h: AdminHostDTO) => {
      const d = toDraft(h)
      setBase(d)
      setDraft(d)
      setShown((s) => new Set([...s, ...initialShown(d)]))
      setTried(false)
      toast.success(t('admin.nodes.panels.host.saved'))
      invalidate()
    },
    onError: () => toast.error(t('admin.nodes.panels.host.saveError')),
  })

  const remove = useMutation({
    mutationFn: () => api.adminHostDelete(hostUuid as string),
    onSuccess: () => {
      toast.success(t('admin.nodes.panels.host.deleted'))
      setConfirmDelete(false)
      invalidate()
      void qc.invalidateQueries({ queryKey: ['admin-nodes'] })
      onGone()
    },
    onError: () => toast.error(t('admin.nodes.panels.host.deleteError')),
  })

  const set = <K extends HostDraftKey>(k: K, v: HostDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const reset = (k: HostDraftKey) => setDraft((d) => (d && base ? { ...d, [k]: base[k] } : d))

  /** Вернуть поля опции к исходным значениям. */
  const resetOpt = (k: HostOptKey) => {
    setDraft((d) => {
      if (!d || !base) return d
      const next = { ...d } as Record<HostDraftKey, unknown>
      for (const f of OPT_FIELDS[k]) next[f] = base[f]
      return next as HostDraft
    })
    if (initial.has(k)) setShown((s) => new Set(s).add(k))
  }
  /** Убрать опцию из формы: значение становится пустым (для хоста с исходным значением это «сбросить» в панели). */
  const removeOpt = (k: HostOptKey) => {
    setDraft((d) => (d ? { ...d, ...emptyOpt(k) } : d))
    setShown((s) => {
      const n = new Set(s)
      n.delete(k)
      return n
    })
  }

  const onSave = () => {
    setTried(true)
    if (!dirty || invalid || save.isPending) return
    save.mutate()
  }

  /** Есть ли открытое поверх панели окно (его Esc закрывает первым). */
  const dialogOpen = pickerOpen || jsonKey !== null || confirmDelete || confirmLeave !== null

  const closeTopDialog = () => {
    if (pickerOpen) setPickerOpen(false)
    else if (jsonKey !== null) setJsonKey(null)
    else if (confirmDelete) setConfirmDelete(false)
    else if (confirmLeave) setConfirmLeave(null)
  }

  return {
    q,
    ready: !!draft && !!base,
    draft,
    base,
    shown,
    initial,
    addOpt: (k: HostOptKey) => setShown((s) => new Set(s).add(k)),
    set,
    reset,
    resetOpt,
    removeOpt,
    dirty,
    errors,
    tried,
    saving: save.isPending,
    deleting: remove.isPending,
    onSave,
    canSave: dirty && !save.isPending,
    templates: templatesQ.data?.templates ?? [],
    nodes: nodesQ.data?.nodes ?? [],
    squads: squadsQ.data?.items ?? [],
    pickerOpen,
    setPickerOpen,
    jsonKey,
    setJsonKey,
    confirmDelete,
    setConfirmDelete,
    onDelete: () => remove.mutate(),
    confirmLeave,
    setConfirmLeave,
    dialogOpen,
    closeTopDialog,
    title: q.data?.remark ?? draft?.remark ?? '',
  }
}

export type HostEditor = ReturnType<typeof useHostEditor>

/** Подпись поля со стрелкой «сбросить к исходному» / крестиком «убрать опцию». */
function OptRow({
  label,
  required,
  changed,
  onReset,
  onRemove,
  inline,
  headerExtra,
  children,
}: {
  label: string
  required?: boolean
  changed?: boolean
  onReset?: () => void
  /** Если задан, вместо стрелки показывается «убрать опцию». */
  onRemove?: () => void
  /** Переключатель в одной строке с подписью. */
  inline?: boolean
  /** Элемент справа от заголовка (например, выбор режима). */
  headerExtra?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()
  const action = onRemove ? (
    <button
      type="button"
      onClick={onRemove}
      title={t('admin.nodes.panels.host.removeOpt')}
      aria-label={t('admin.nodes.panels.host.removeOpt')}
      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  ) : onReset ? (
    <button
      type="button"
      onClick={onReset}
      disabled={!changed}
      title={t('admin.nodes.panels.host.reset')}
      aria-label={t('admin.nodes.panels.host.reset')}
      className={cn(
        'shrink-0 rounded p-1 transition-colors',
        changed ? 'text-amber-600 hover:bg-secondary dark:text-amber-400' : 'cursor-default text-muted-foreground/40',
      )}
    >
      <Undo2 className="size-3.5" aria-hidden />
    </button>
  ) : null
  const title = (
    <div className="min-w-0 text-sm font-semibold">
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}
    </div>
  )
  if (inline) {
    return (
      <div className="flex min-h-9 min-w-0 items-center justify-between gap-2">
        {title}
        <div className="flex shrink-0 items-center gap-1.5">
          {children}
          {action}
        </div>
      </div>
    )
  }
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {title}
        <div className="flex min-w-0 items-center gap-1.5">
          {headerExtra}
          {action}
        </div>
      </div>
      {children}
    </div>
  )
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-xs font-semibold text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-border/70" />
    </div>
  )
}

function ErrText({ e }: { e?: HostErrorCode }) {
  const { t } = useTranslation()
  if (!e) return null
  const key = e === 'required' ? 'required' : e === 'invalidPort' ? 'invalidPort' : 'invalidVlessRoute'
  return <div className="mt-1 text-[11.5px] text-red-600 dark:text-red-400">{t(`admin.nodes.panels.host.${key}`)}</div>
}

const GROUP_LABEL = {
  dest: 'groupDest',
  security: 'groupSecurity',
  transport: 'groupTransport',
  subscription: 'groupSubscription',
  advanced: 'groupAdvanced',
  clients: 'groupClients',
} as const

/** Значения списка плюс текущее, если его в списке нет (панель может хранить и нестандартное). */
const withCurrent = (list: string[], cur: string): string[] => (cur && !list.includes(cur) ? [cur, ...list] : list)

export function HostEditBody({ ed }: { ed: HostEditor }) {
  const { t } = useTranslation()
  const { draft, base } = ed
  if (ed.q.isError && !ed.ready) return <PanelError onRetry={() => void ed.q.refetch()} />
  if (!draft || !base) return <PanelSkeleton rows={4} />

  const ch = (k: HostDraftKey) => fieldChanged(draft, base, k)
  const err = (k: 'remark' | 'address' | 'port') => (ed.tried ? ed.errors[k] : undefined)
  const available = OPT_GROUPS.flatMap((g) => g.keys).filter((k) => !ed.shown.has(k))
  const L = (k: string) => t(`admin.nodes.panels.host.${k}`)
  const optLabel = (k: HostOptKey) => L(OPT_LABEL[k])

  const textInput = (k: 'sni' | 'host' | 'path', placeholder: string) => (
    <input
      value={draft[k]}
      onChange={(e) => ed.set(k, e.target.value.replace(/[\r\n]+/g, ''))}
      placeholder={placeholder}
      aria-label={optLabel(k)}
      className={cn(PANEL_INPUT, 'font-mono text-[13px]')}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
    />
  )

  /** Селект из списка строк с возможностью очистки. */
  const listSelect = (k: 'fingerprint' | 'alpn' | 'mihomoIp', list: string[], placeholder: string) => (
    <AdminSelect
      value={draft[k] || null}
      onChange={(v) => ed.set(k, v ?? '')}
      options={withCurrent(list, draft[k]).map((v) => ({ value: v, label: v }))}
      placeholder={placeholder}
      ariaLabel={optLabel(k)}
      allowEmpty
      emptyLabel={L('unset')}
    />
  )

  const nodeItems = ed.nodes.map((n) => ({
    id: n.uuid,
    label: n.name,
    icon: <CountryFlag code={n.country_code} className="h-3.5 w-5 shrink-0" />,
  }))
  const squadItems = ed.squads.map((s) => ({ id: s.uuid, label: s.name }))

  const toggle = (k: 'overrideSni' | 'keepSniBlank' | 'hidden' | 'shuffle' | 'x25519', label: string) => (
    <AdminToggleSwitch checked={draft[k]} onChange={(v) => ed.set(k, v)} aria-label={label} />
  )

  const renderOpt = (k: HostOptKey): ReactNode => {
    const isNew = !ed.initial.has(k)
    const changed = optChanged(draft, base, k)
    const useReset = !isNew && changed
    const common = {
      key: k,
      label: optLabel(k),
      changed,
      onReset: useReset ? () => ed.resetOpt(k) : undefined,
      onRemove: useReset ? undefined : () => ed.removeOpt(k),
    }
    switch (k) {
      case 'tags':
        return (
          <OptRow {...common}>
            <ChipInput
              value={draft.tags}
              onChange={(v) => ed.set('tags', v)}
              placeholder={L('tagsPlaceholder')}
              normalize={(s) => s.toUpperCase()}
              check={(s, cur) => (cur.length >= TAGS_MAX ? L('tagsMax') : !TAG_RE.test(s) ? L('tagsInvalid') : null)}
              mono
            />
          </OptRow>
        )
      case 'nodes':
        return (
          <OptRow {...common}>
            <MultiPick
              items={nodeItems}
              value={draft.nodes}
              onChange={(v) => ed.set('nodes', v)}
              placeholder={L('nodesPlaceholder')}
              searchable={nodeItems.length > 6}
              ariaLabel={optLabel(k)}
            />
          </OptRow>
        )
      case 'squads':
        return (
          <OptRow
            {...common}
            headerExtra={
              <AdminSelect
                value={draft.squadMode}
                onChange={(v) => v && ed.set('squadMode', v as SquadMode)}
                options={[
                  { value: 'EXCLUDE', label: L('squadsExclude') },
                  { value: 'ALLOW_ONLY', label: L('squadsAllow') },
                ]}
                placeholder={L('squadsExclude')}
                ariaLabel={L('squadsMode')}
                className="w-[210px] max-w-full [&>button]:min-h-8 [&>button]:py-1 [&>button]:text-xs"
              />
            }
          >
            <div className="flex flex-col gap-2">
              <MultiPick
                items={squadItems}
                value={draft.squads}
                onChange={(v) => ed.set('squads', v)}
                placeholder={L('squadsPlaceholder')}
                searchable
                tone="violet"
                ariaLabel={optLabel(k)}
              />
            </div>
          </OptRow>
        )
      case 'sni':
        return <OptRow {...common}>{textInput('sni', 'example.com')}</OptRow>
      case 'host':
        return <OptRow {...common}>{textInput('host', 'example.com')}</OptRow>
      case 'path':
        return <OptRow {...common}>{textInput('path', '/')}</OptRow>
      case 'overrideSni':
      case 'keepSniBlank':
      case 'hidden':
      case 'shuffle':
      case 'x25519':
        return (
          <OptRow {...common} inline>
            {toggle(k, optLabel(k))}
          </OptRow>
        )
      case 'security':
        return (
          <OptRow {...common}>
            <AdminSelect
              value={draft.security}
              onChange={(v) => v && ed.set('security', v as HostDraft['security'])}
              options={[
                { value: 'DEFAULT', label: L('securityDefault') },
                { value: 'TLS', label: L('securityTls') },
                { value: 'NONE', label: L('securityNone') },
              ]}
              placeholder={optLabel(k)}
              ariaLabel={optLabel(k)}
            />
          </OptRow>
        )
      case 'fingerprint':
        return <OptRow {...common}>{listSelect('fingerprint', FINGERPRINTS, 'chrome')}</OptRow>
      case 'alpn':
        return <OptRow {...common}>{listSelect('alpn', ALPNS, 'h2,http/1.1')}</OptRow>
      case 'mihomoIp':
        return <OptRow {...common}>{listSelect('mihomoIp', MIHOMO_IPS, 'dual')}</OptRow>
      case 'vlessRoute':
        return (
          <OptRow {...common}>
            <input
              value={draft.vlessRoute}
              onChange={(e) => ed.set('vlessRoute', e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              placeholder="0 – 65535"
              aria-label={optLabel(k)}
              className={cn(PANEL_INPUT, 'font-mono text-[13px]', ed.errors.vlessRoute && 'border-red-500/60')}
            />
            <ErrText e={ed.errors.vlessRoute} />
          </OptRow>
        )
      case 'description':
        return (
          <OptRow {...common}>
            <textarea
              value={draft.description}
              onChange={(e) => ed.set('description', e.target.value)}
              rows={2}
              aria-label={optLabel(k)}
              className="w-full resize-y rounded-[10px] border border-input bg-background/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </OptRow>
        )
      case 'excludeSub':
        return (
          <OptRow {...common}>
            <MultiPick
              items={SUB_TYPES.map((s) => ({ id: s, label: s }))}
              value={draft.excludeSub}
              onChange={(v) => ed.set('excludeSub', v)}
              placeholder={L('excludeSubPlaceholder')}
              tone="violet"
              ariaLabel={optLabel(k)}
            />
          </OptRow>
        )
      case 'template':
        return (
          <OptRow {...common}>
            <AdminSelect
              value={draft.template || null}
              onChange={(v) => ed.set('template', v ?? '')}
              options={ed.templates.map((x) => ({ value: x.uuid, label: x.name }))}
              placeholder={L('templateNone')}
              ariaLabel={optLabel(k)}
              allowEmpty
              emptyLabel={L('templateNone')}
            />
          </OptRow>
        )
      case 'mapper':
      case 'mux':
      case 'sockopt':
      case 'final_mask':
      case 'xhttp':
        return (
          <OptRow {...common}>
            <JsonButton text={draft[k]} onClick={() => ed.setJsonKey(k)} />
          </OptRow>
        )
      case 'pinnedCert':
      case 'verifyName':
        return (
          <OptRow {...common}>
            <ChipInput value={draft[k]} onChange={(v) => ed.set(k, v)} placeholder={L('chipPlaceholder')} mono />
          </OptRow>
        )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg border',
              draft.disabled
                ? 'border-border bg-muted/50 text-muted-foreground'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
          >
            {draft.disabled ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{L('visibility')}</div>
            <div className={cn('text-xs font-semibold', draft.disabled ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400')}>
              {draft.disabled ? L('visibilityOff') : L('visibilityOn')}
            </div>
          </div>
          <AdminToggleSwitch checked={!draft.disabled} onChange={(on) => ed.set('disabled', !on)} aria-label={L('visibility')} />
        </div>

        <div className="mt-4 flex flex-col gap-3.5">
          <OptRow label={L('remark')} required changed={ch('remark')} onReset={() => ed.reset('remark')}>
            <input
              value={draft.remark}
              onChange={(e) => ed.set('remark', e.target.value)}
              className={cn(PANEL_INPUT, err('remark') && 'border-red-500/60')}
            />
            <ErrText e={err('remark')} />
          </OptRow>

          <OptRow label={L('inbound')} changed={ch('inbound')} onReset={() => ed.reset('inbound')}>
            <button
              type="button"
              onClick={() => ed.setPickerOpen(true)}
              title={L('inboundPick')}
              aria-label={L('inboundPick')}
              className={cn(
                'flex w-full items-center gap-3 rounded-[10px] border bg-background/50 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-background/80',
                ch('inbound') ? 'border-amber-500/50' : 'border-border',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkle className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{draft.inbound.profileName || '—'}</span>
                <span className="block truncate font-mono text-xs text-muted-foreground">{draft.inbound.tag || L('inbound')}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </OptRow>

          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
            <OptRow label={L('address')} required changed={ch('address')} onReset={() => ed.reset('address')}>
              <input
                value={draft.address}
                onChange={(e) => ed.set('address', e.target.value)}
                className={cn(PANEL_INPUT, 'font-mono text-[13px]', err('address') && 'border-red-500/60')}
                spellCheck={false}
              />
              <ErrText e={err('address')} />
            </OptRow>
            <OptRow label={L('port')} required changed={ch('port')} onReset={() => ed.reset('port')}>
              <input
                value={draft.port}
                onChange={(e) => ed.set('port', e.target.value.replace(/\D/g, '').slice(0, 5))}
                inputMode="numeric"
                className={cn(PANEL_INPUT, 'font-mono text-[13px]', err('port') && 'border-red-500/60')}
              />
              <ErrText e={err('port')} />
            </OptRow>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-base font-bold">{L('options')}</div>
          <AddMenu available={available} onPick={ed.addOpt} />
        </div>
        <div className="flex flex-col gap-3.5">
          {OPT_GROUPS.map((g) => {
            const keys = g.keys.filter((k) => ed.shown.has(k))
            if (keys.length === 0) return null
            return (
              <div key={g.id} className="flex flex-col gap-3.5">
                <GroupTitle>{L(GROUP_LABEL[g.id])}</GroupTitle>
                {keys.map(renderOpt)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function HostEditFooter({ ed }: { ed: HostEditor }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={ed.onSave}
        disabled={!ed.canSave || !ed.ready}
        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[11px] bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ed.saving && <Spinner />}
        {t('admin.nodes.panels.host.save')}
      </button>
      <button
        type="button"
        onClick={() => ed.setConfirmDelete(true)}
        disabled={!ed.ready || ed.deleting}
        title={t('admin.nodes.panels.host.delete')}
        aria-label={t('admin.nodes.panels.host.delete')}
        className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-red-500/40 bg-red-500/10 text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
      >
        {ed.deleting ? <Spinner /> : <Trash2 className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

/** Окна поверх панели: редактор JSON, подтверждение удаления и закрытия с несохранёнными правками. */
export function HostEditDialogs({ ed, onLeave }: { ed: HostEditor; onLeave: (k: Leave) => void }) {
  const { t } = useTranslation()
  const key = ed.jsonKey
  const [text, setText] = useState('')
  const lastKey = useRef<HostJsonKey | null>(null)
  // При открытии окна берём текущее значение поля; пока окно уезжает, текст остаётся прежним.
  if (key && lastKey.current !== key) {
    lastKey.current = key
    setText(ed.draft ? ed.draft[key] : '')
  }
  if (!key && lastKey.current) lastKey.current = null

  const check = checkJson(text)
  const titleKey = key ? OPT_LABEL[key] : 'mux'
  const L = (k: string) => t(`admin.nodes.panels.host.${k}`)

  return (
    <>
      <HostInboundPicker
        open={ed.pickerOpen}
        onClose={() => ed.setPickerOpen(false)}
        hostName={ed.draft?.remark ?? ''}
        value={ed.draft?.inbound ?? { profile: '', uuid: '', profileName: '', tag: '' }}
        onApply={(v) => ed.set('inbound', v)}
      />

      <PanelDialog
        open={!!key}
        onClose={() => ed.setJsonKey(null)}
        title={L(titleKey)}
        icon={Braces}
        iconAccent="violet"
        wide
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setText('')}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {L('jsonClear')}
            </button>
            <button
              type="button"
              disabled={!check.ok}
              onClick={() => {
                if (!key || !check.ok) return
                ed.set(key, check.pretty)
                ed.setJsonKey(null)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {L('jsonApply')}
            </button>
          </div>
        }
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={12}
          className={cn(
            'w-full resize-y rounded-[10px] border bg-background/60 p-3 font-mono text-[12.5px] leading-relaxed outline-none transition-colors focus:ring-2',
            check.ok ? 'border-input focus:border-primary/60 focus:ring-primary/20' : 'border-red-500/60 focus:ring-red-500/20',
          )}
          aria-label={L(titleKey)}
        />
        <div
          className={cn(
            'mt-2 text-xs font-semibold',
            !check.ok ? 'text-red-600 dark:text-red-400' : text.trim() ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
          )}
        >
          {!check.ok ? L('jsonInvalid') : text.trim() ? L('jsonValid') : L('jsonHint')}
        </div>
      </PanelDialog>

      <PanelConfirm
        open={ed.confirmDelete}
        onClose={() => ed.setConfirmDelete(false)}
        onConfirm={ed.onDelete}
        title={L('deleteTitle')}
        message={t('admin.nodes.panels.host.deleteText', { name: ed.title })}
        confirmLabel={L('delete')}
        cancelLabel={t('admin.cancel')}
        destructive
        loading={ed.deleting}
      />

      <PanelConfirm
        open={ed.confirmLeave !== null}
        onClose={() => ed.setConfirmLeave(null)}
        onConfirm={() => {
          const k = ed.confirmLeave
          ed.setConfirmLeave(null)
          if (k) onLeave(k)
        }}
        title={L('discardTitle')}
        message={L('discardText')}
        confirmLabel={L('discard')}
        cancelLabel={L('keepEditing')}
      />
    </>
  )
}
