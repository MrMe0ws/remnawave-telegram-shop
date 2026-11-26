import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Search, Sparkle, Undo2, Check, Code, Copy } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AdminNodeDetailDTO } from '@/lib/types/admin'
import { AdminCheckbox } from '../components/AdminCheckbox'
import { NodeSidePanel } from './NodeSidePanel'
import { PanelDialog } from './panelUi'

/**
 * Панель «Профили»: выбор профиля ядра и его инбаундов для ноды.
 * Ядро ноды — ровно один профиль, поэтому выбор в другом профиле переключает профиль и сбрасывает прежний.
 */
export function NodeProfilesPanel({
  open,
  onClose,
  node,
}: {
  open: boolean
  onClose: () => void
  node: Pick<AdminNodeDetailDTO, 'uuid' | 'name' | 'config_profile_uuid' | 'inbounds'> | null
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()

  const profilesQ = useQuery({
    queryKey: ['admin-config-profiles'],
    queryFn: () => api.adminConfigProfiles(),
    enabled: open,
    staleTime: 30_000,
  })
  const profiles = profilesQ.data?.profiles ?? []

  const initial = useMemo(
    () => ({ profile: node?.config_profile_uuid ?? null, ids: (node?.inbounds ?? []).map((i) => i.uuid) }),
    [node?.config_profile_uuid, node?.inbounds],
  )
  const [jsonOf, setJsonOf] = useState<{ tag: string; raw: unknown } | null>(null)
  const [profile, setProfile] = useState<string | null>(initial.profile)
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.ids))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  // При каждом открытии начинаем с того, что сейчас назначено ноде.
  useEffect(() => {
    if (!open) return
    setProfile(initial.profile)
    setSelected(new Set(initial.ids))
    setExpanded(new Set(initial.profile ? [initial.profile] : []))
    setQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.uuid])

  const reset = () => {
    setProfile(initial.profile)
    setSelected(new Set(initial.ids))
  }

  const changed =
    profile !== initial.profile || selected.size !== initial.ids.length || initial.ids.some((id) => !selected.has(id))

  const save = useMutation({
    mutationFn: () => api.adminNodePatch(node!.uuid, { config_profile: { uuid: profile!, inbound_uuids: [...selected] } }),
    onSuccess: (res) => {
      toast.success(t('admin.nodes.edit.profiles.saved'))
      qc.setQueryData(['admin-node', node!.uuid], res)
      void qc.invalidateQueries({ queryKey: ['admin-nodes'] })
      void qc.invalidateQueries({ queryKey: ['admin-node', node!.uuid] })
      onClose()
    },
    onError: () => toast.error(t('admin.nodes.edit.saveError')),
  })

  const toggleInbound = (profileUuid: string, inboundUuid: string) => {
    if (profileUuid !== profile) {
      setProfile(profileUuid)
      setSelected(new Set([inboundUuid]))
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(inboundUuid)) next.delete(inboundUuid)
      else next.add(inboundUuid)
      return next
    })
  }
  const toggleOpen = (uuid: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })

  const needle = query.trim().toLowerCase()
  const view = profiles
    .map((p) => {
      const nameHit = needle !== '' && p.name.toLowerCase().includes(needle)
      const inbounds =
        needle === '' || nameHit
          ? p.inbounds
          : p.inbounds.filter((i) => `${i.tag} ${i.type} ${i.port}`.toLowerCase().includes(needle))
      return { p, inbounds, hit: needle === '' || nameHit || inbounds.length > 0 }
    })
    .filter((x) => x.hit)

  const count = selected.size
  const act =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:opacity-40'

  return (
    <>
    <NodeSidePanel
      open={open}
      onClose={onClose}
      icon={Sparkle}
      iconAccent="emerald"
      title={
        <div className="min-w-0">
          <div className="truncate">{node?.name ?? ''}</div>
          <div className="mt-0.5 text-xs font-normal text-muted-foreground">
            {t('admin.nodes.edit.profiles.selected', { n: count })}
          </div>
        </div>
      }
      headerAction={
        <>
          <button
            type="button"
            onClick={reset}
            disabled={!changed || save.isPending}
            title={t('admin.nodes.edit.profiles.reset')}
            aria-label={t('admin.nodes.edit.profiles.reset')}
            className={cn(act, 'border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400')}
          >
            <Undo2 className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!changed || !profile || count === 0 || save.isPending}
            title={t('admin.save')}
            aria-label={t('admin.save')}
            className={cn(
              act,
              'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400',
              save.isPending && '!opacity-100',
            )}
          >
            {save.isPending ? <Spinner /> : <Check className="size-4" aria-hidden />}
          </button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.nodes.edit.profiles.search')}
          aria-label={t('admin.nodes.edit.profiles.search')}
          className="h-10 w-full rounded-lg border border-input bg-card dark:bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring dark:bg-input"
        />
      </div>

      {profilesQ.isLoading && (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Spinner />
        </div>
      )}
      {profilesQ.isError && (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('admin.nodes.edit.profiles.loadError')}</div>
      )}
      {!profilesQ.isLoading && !profilesQ.isError && view.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('admin.nodes.edit.profiles.empty')}</div>
      )}

      <div className="flex flex-col gap-2.5">
        {view.map(({ p, inbounds }) => {
          const isOpen = needle !== '' || expanded.has(p.uuid)
          const chosen = p.uuid === profile ? p.inbounds.filter((i) => selected.has(i.uuid)).length : 0
          const active = p.uuid === profile && chosen > 0
          return (
            <div
              key={p.uuid}
              className={cn(
                'overflow-hidden rounded-xl border bg-muted/30',
                active ? 'border-emerald-500/40' : 'border-border/70',
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleOpen(p.uuid)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !isOpen && '-rotate-90')} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold">{p.name}</span>
                </button>
                <span
                  className={cn(
                    'shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold',
                    active
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-border bg-background/60 text-muted-foreground',
                  )}
                  title={t('admin.nodes.edit.profiles.chosenOf')}
                >
                  {chosen}/{p.inbounds.length}
                </span>
                {p.node_count > 0 && (
                  <span
                    className="flex size-6 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400"
                    title={t('admin.nodes.edit.profiles.activeOnNodes', { count: p.node_count })}
                    aria-label={t('admin.nodes.edit.profiles.activeOnNodes', { count: p.node_count })}
                  >
                    <Sparkle className="size-4" aria-hidden />
                  </span>
                )}
              </div>
              {isOpen && (
                <div className="admin-expand border-t border-border/60 px-3 pb-3 pt-2">
                  {inbounds.length === 0 ? (
                    <div className="py-2 text-xs text-muted-foreground">{t('admin.nodes.edit.profiles.noInbounds')}</div>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {inbounds.map((i) => {
                        const on = p.uuid === profile && selected.has(i.uuid)
                        return (
                          <li key={i.uuid} className="flex items-center gap-1.5">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-accent/40">
                              <AdminCheckbox checked={on} onChange={() => toggleInbound(p.uuid, i.uuid)} aria-label={i.tag} />
                              <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-bold">{i.tag}</span>
                              <span className="shrink-0 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300">
                                {i.type}
                              </span>
                              {i.port > 0 && (
                                <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                  {i.port}
                                </span>
                              )}
                            </label>
                            <button
                              type="button"
                              onClick={() => setJsonOf({ tag: i.tag, raw: i.raw })}
                              title={t('admin.nodes.edit.profiles.inboundJson')}
                              aria-label={t('admin.nodes.edit.profiles.inboundJson')}
                              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                            >
                              <Code className="size-4" aria-hidden />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </NodeSidePanel>
    <InboundJsonDialog value={jsonOf} onClose={() => setJsonOf(null)} />
    </>
  )
}

/** Конфиг инбаунда: только чтение, с кнопкой «Копировать». */
function InboundJsonDialog({ value, onClose }: { value: { tag: string; raw: unknown } | null; onClose: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const last = useRef(value)
  if (value) last.current = value
  const shown = value ?? last.current
  const text = useMemo(() => (shown ? JSON.stringify(shown.raw, null, 2) : ''), [shown])
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <PanelDialog
      open={!!value}
      onClose={onClose}
      wide
      icon={Code}
      iconAccent="violet"
      title={t('admin.nodes.edit.profiles.inboundJsonTitle', { tag: shown?.tag ?? '' })}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold transition-colors hover:bg-muted"
          >
            {copied ? <Check className="size-4 text-emerald-500" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? t('admin.nodes.edit.profiles.copied') : t('admin.nodes.edit.profiles.copyJson')}
          </button>
        </div>
      }
    >
      <pre className="max-h-[60vh] overflow-auto rounded-lg border border-border/70 bg-background/70 p-3 font-mono text-xs leading-relaxed text-foreground dark:bg-muted/30">
        {text}
      </pre>
    </PanelDialog>
  )
}
