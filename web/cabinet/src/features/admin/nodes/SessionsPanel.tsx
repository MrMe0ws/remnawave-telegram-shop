import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Copy, ExternalLink, User, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/clipboard'
import { hapticTap } from '@/lib/haptic'
import { cn } from '@/lib/utils'
import type { AdminNodeSessionsDTO } from '@/lib/types/admin'
import { InfoTip } from '../components/InfoTip'
import { NodeSidePanel } from './NodeSidePanel'
import { HeaderIconButton, PanelEmpty, PanelError, PanelSkeleton } from './panelUi'

type Age = 'fresh' | 'recent' | 'stale'
type Sort = 'default' | 'asc' | 'desc'

const AGE_STYLE: Record<Age, { dot: string; tile: string }> = {
  fresh: { dot: 'bg-emerald-500', tile: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  recent: { dot: 'bg-amber-500', tile: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  stale: { dot: 'bg-red-500', tile: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400' },
}

const TIP_KEY = {
  fresh: 'admin.nodes.panels.sessions.tipFresh',
  recent: 'admin.nodes.panels.sessions.tipRecent',
  stale: 'admin.nodes.panels.sessions.tipStale',
} as const

function ageOf(iso: string, now: number): { age: Age; ms: number } {
  const ts = Date.parse(iso)
  const ms = Number.isFinite(ts) ? Math.max(0, now - ts) : Infinity
  return { age: ms < 5 * 60_000 ? 'fresh' : ms < 3_600_000 ? 'recent' : 'stale', ms }
}

function shortAgo(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function SessionsPanel({ nodeUuid, open, onClose }: { nodeUuid: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [sort, setSort] = useState<Sort>('default')

  // IP-адреса пользователей не держим в кэше дольше окна панели: gcTime короткий, повторный вход — свежий запрос.
  const q = useQuery<AdminNodeSessionsDTO>({
    queryKey: ['admin-node-sessions', nodeUuid],
    queryFn: () => api.adminNodeSessions(nodeUuid),
    enabled: open,
    staleTime: 0,
    gcTime: 10_000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const now = q.dataUpdatedAt || Date.now()
  const users = useMemo(() => {
    const list = q.data?.users ?? []
    if (sort === 'default') return list
    return [...list].sort((a, b) => (sort === 'asc' ? a.ips.length - b.ips.length : b.ips.length - a.ips.length))
  }, [q.data, sort])

  const counts = useMemo(() => {
    const c: Record<Age, number> = { fresh: 0, recent: 0, stale: 0 }
    for (const u of q.data?.users ?? []) for (const ip of u.ips) c[ageOf(ip.last_seen, now).age]++
    return c
  }, [q.data, now])

  const copy = async (ip: string) => {
    if (await copyToClipboard(ip)) {
      hapticTap()
      toast.success(t('admin.nodes.panels.sessions.copied'))
    }
  }

  const loading = q.isFetching && !q.data
  const sortBtn = (s: Sort, label: string) => (
    <button
      key={s}
      type="button"
      onClick={() => setSort(s)}
      aria-pressed={sort === s}
      className={cn(
        'h-8 flex-1 rounded-lg px-2 text-xs font-bold transition-colors',
        sort === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {label}
    </button>
  )

  return (
    <NodeSidePanel
      open={open}
      onClose={onClose}
      title={t('admin.nodes.panels.sessions.title')}
      icon={Users}
      iconAccent="blue"
      headerAction={<HeaderIconButton label={t('admin.nodes.panels.refresh')} onClick={() => void q.refetch()} busy={q.isFetching} />}
    >
      {loading && (
        <div>
          <p className="mb-3 text-center text-sm text-muted-foreground">{t('admin.nodes.panels.sessions.loading')}</p>
          <PanelSkeleton rows={3} />
        </div>
      )}
      {q.isError && !q.data && !q.isFetching && <PanelError onRetry={() => void q.refetch()} />}
      {q.data && (
        <div className={cn('flex flex-col gap-4 transition-opacity', q.isFetching && 'opacity-60')}>
          <div className="flex items-center justify-between gap-3" title={t('admin.nodes.panels.sessions.hint')}>
            <span className="text-sm font-semibold text-muted-foreground">{t('admin.nodes.panels.sessions.active')}</span>
            <span className="font-mono text-2xl font-extrabold">{q.data.users.length}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['fresh', 'recent', 'stale'] as const).map((a) => (
              <div
                key={a}
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-[10px] border font-mono text-[13px] font-extrabold',
                  AGE_STYLE[a].tile,
                )}
              >
                <span className={cn('size-2 rounded-full', AGE_STYLE[a].dot)} aria-hidden />
                {counts[a]}
                <InfoTip
                  text={`${t(`admin.nodes.panels.sessions.${a}`)}. ${t(TIP_KEY[a])}`}
                  label={t(`admin.nodes.panels.sessions.${a}`)}
                  align={a === 'fresh' ? 'left' : a === 'recent' ? 'center' : 'right'}
                />
              </div>
            ))}
          </div>

          {q.data.users.length > 1 && (
            <div
              className="flex gap-1 rounded-xl border border-border/70 bg-muted/30 p-1"
              role="group"
              aria-label={t('admin.nodes.panels.sessions.sort')}
            >
              {sortBtn('default', t('admin.nodes.panels.sessions.sortDefault'))}
              {sortBtn('asc', t('admin.nodes.panels.sessions.sortAsc'))}
              {sortBtn('desc', t('admin.nodes.panels.sessions.sortDesc'))}
            </div>
          )}

          {users.length === 0 ? (
            <PanelEmpty icon={Users}>{t('admin.nodes.panels.sessions.empty')}</PanelEmpty>
          ) : (
            <ul className="flex flex-col gap-3">
              {users.map((u) => (
                <li key={u.user_id} className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      <User className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold" title={u.username ?? undefined}>
                      {u.username ? `${u.user_id}_${u.username}` : t('admin.nodes.panels.sessions.user', { id: u.user_id })}
                    </span>
                    <span className="shrink-0 rounded-md border border-border bg-background/70 px-2 py-0.5 font-mono text-xs font-bold">
                      {t('admin.nodes.panels.sessions.ips', { count: u.ips.length })}
                    </span>
                    <Link
                      to={`/admin/users/${u.user_id}`}
                      title={t('admin.nodes.panels.sessions.openUser')}
                      aria-label={t('admin.nodes.panels.sessions.openUser')}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </Link>
                  </div>
                  <ul className="mt-2.5 flex flex-col gap-1.5">
                    {u.ips.map((ip) => {
                      const a = ageOf(ip.last_seen, now)
                      return (
                        <li key={ip.ip} className="flex items-center gap-2.5 rounded-[9px] border border-border/60 bg-background/60 px-2.5 py-1.5">
                          <span
                            className={cn('size-2 shrink-0 rounded-full', AGE_STYLE[a.age].dot)}
                            title={t(`admin.nodes.panels.sessions.${a.age}`)}
                          />
                          <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{ip.ip}</span>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {t('admin.nodes.panels.sessions.ago', { when: shortAgo(a.ms) })}
                          </span>
                          <button
                            type="button"
                            onClick={() => void copy(ip.ip)}
                            title={t('admin.nodes.panels.sessions.copyIp')}
                            aria-label={t('admin.nodes.panels.sessions.copyIp')}
                            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Copy className="size-3.5" aria-hidden />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </NodeSidePanel>
  )
}
