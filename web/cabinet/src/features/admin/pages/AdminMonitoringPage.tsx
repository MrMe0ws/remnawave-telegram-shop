import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Network, Pause, Play, Radar, Search, UserPlus, Wallet, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { AdminCustomerDTO, AdminMonitoringPeriod, AdminMonitoringSummaryDTO } from '@/lib/types/admin'
import { AdminLayout } from '../layout/AdminLayout'
import { EventList } from '../monitoring/EventList'
import { IncidentsCard } from '../monitoring/IncidentsCard'
import { EventFilterMenu, PeriodMenu, loadFeedFilter, loadPeriod, type FeedFilter } from '../monitoring/MonitoringMenus'
import { formatMoney } from '../monitoring/eventView'
import { useAdminAttention, useAdminMonitoringSummary } from '../monitoring/useMonitoring'
import { useEventFeed } from '../monitoring/useEventFeed'

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  valueTone,
  subTone,
  className,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  sub?: ReactNode
  valueTone?: string
  subTone?: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0 rounded-2xl border border-border/50 bg-muted/40 px-3.5 py-3 sm:px-4', className)}>
      <p className="flex items-center gap-1.5 truncate text-[12.5px] text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </p>
      <p className={cn('mt-1 truncate font-mono text-[22px] font-bold tracking-tight sm:text-2xl', valueTone)}>{value}</p>
      <p className={cn('truncate text-[12px] text-muted-foreground sm:text-[12.5px]', subTone)}>{sub ?? ' '}</p>
    </div>
  )
}

function SummaryTiles({ data, downNow }: { data?: AdminMonitoringSummaryDTO; downNow: number }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU'
  const revenue = data
    ? Object.entries(data.revenue ?? {})
        .sort(([a], [b]) => (a === 'RUB' ? -1 : b === 'RUB' ? 1 : a.localeCompare(b)))
        .map(([cur, sum]) => formatMoney(sum, cur, locale))
        .join(' · ')
    : ''
  const regs = data ? data.registrations_bot + data.registrations_cabinet : 0
  let nodesSub = t('admin.monitoring.stats.allOnline')
  let nodesSubTone: string | undefined
  if (downNow > 0) {
    nodesSub = t('admin.monitoring.stats.downNow', { count: downNow })
    nodesSubTone = 'text-rose-500'
  } else if (data && data.node_downs > 0) {
    nodesSub = t('admin.monitoring.stats.downs', { count: data.node_downs })
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
      <StatTile className="col-span-2 sm:col-span-1" icon={Wallet} label={t('admin.monitoring.stats.payments')} value={data ? data.payments : '—'} sub={revenue || '—'} />
      <StatTile
        icon={UserPlus}
        label={t('admin.monitoring.stats.registrations')}
        value={data ? regs : '—'}
        sub={data ? t('admin.monitoring.stats.regSplit', { bot: data.registrations_bot, cabinet: data.registrations_cabinet }) : '—'}
      />
      <StatTile
        icon={Network}
        label={t('admin.monitoring.stats.nodes')}
        value={
          data?.nodes_known ? (
            <>
              {data.nodes_online}
              <span className="text-base font-semibold text-muted-foreground"> / {data.nodes_total}</span>
            </>
          ) : (
            '—'
          )
        }
        sub={data?.nodes_known ? nodesSub : '—'}
        subTone={nodesSubTone}
      />
    </div>
  )
}

/** Поиск клиента для ленты: подбор по нику или ID, выбранный — фильтр ленты. */
function CustomerSearch({
  value,
  onChange,
}: {
  value: { id: number; label: string } | null
  onChange: (v: { id: number; label: string } | null) => void
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<AdminCustomerDTO[] | null>(null)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const needle = q.trim()
    if (needle.length < 2) {
      setResults(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setBusy(true)
      try {
        const res = await api.adminUserSearch(needle)
        if (!cancelled) setResults(res.items.slice(0, 6))
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setBusy(false)
      }
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [q])

  useEffect(() => {
    if (results === null) return
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setResults(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [results])

  if (value) {
    return (
      <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 pl-3 pr-1 text-sm sm:max-w-[340px]">
        <Search className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium text-primary">{value.label}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t('admin.monitoring.search.clear')}
          className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-primary hover:bg-primary/15"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    )
  }

  const label = (c: AdminCustomerDTO) =>
    c.telegram_username ? `@${c.telegram_username.replace(/^@/, '')}` : `#${c.id}`

  return (
    <div ref={box} className="relative min-w-0 flex-1 sm:max-w-[340px]">
      <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-muted/50 pl-3 pr-2 focus-within:border-primary/50">
        {busy ? <Spinner className="size-4 text-muted-foreground" /> : <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('admin.monitoring.search.placeholder')}
          aria-label={t('admin.monitoring.search.label')}
          className="min-w-0 flex-1 !border-0 !bg-transparent text-sm !shadow-none outline-none placeholder:text-muted-foreground"
        />
      </div>
      {results !== null && (
        <div className="absolute left-0 right-0 top-12 z-30 rounded-2xl border border-border bg-card p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
          {results.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">{t('admin.monitoring.search.empty')}</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange({ id: c.id, label: label(c) })
                  setQ('')
                  setResults(null)
                }}
                className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left text-sm hover:bg-secondary/70"
              >
                <span className="truncate font-medium">{label(c)}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">#{c.id}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminMonitoringPage() {
  const { t } = useTranslation()
  const [paused, setPaused] = useState(false)
  const [period, setPeriod] = useState<AdminMonitoringPeriod>(loadPeriod)
  const [filter, setFilter] = useState<FeedFilter>(loadFeedFilter)
  const [customer, setCustomer] = useState<{ id: number; label: string } | null>(null)

  const attention = useAdminAttention(paused ? 30_000 : 10_000)
  const summary = useAdminMonitoringSummary(period)
  const incidents = attention.data?.items ?? []
  const downNow = incidents.filter((i) => i.key === 'node_down').length

  const categories = useMemo(() => [...filter.categories], [filter.categories])
  // Нажатия показываем, только пока их запись включена: иначе сохранённое
  // «вкл» прятало бы переключатель, а старые нажатия было бы не убрать.
  const [botAvailable, setBotAvailable] = useState(false)
  const botActions = filter.botActions && botAvailable
  const feed = useEventFeed({
    categories,
    botActions,
    customerId: customer?.id,
    paused,
  })
  useEffect(() => {
    if (!feed.loading) setBotAvailable(feed.botActionsEnabled)
  }, [feed.loading, feed.botActionsEnabled])
  const resetKey = `${categories.join(',')}|${botActions}|${customer?.id ?? 0}`

  const pauseButton = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 shrink-0 rounded-xl bg-card dark:bg-card"
      aria-label={paused ? t('admin.monitoring.resume') : t('admin.monitoring.pause')}
      aria-pressed={paused}
      onClick={() => setPaused((v) => !v)}
    >
      {paused ? <Play /> : <Pause />}
    </Button>
  )

  const live = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium sm:rounded-full sm:border sm:px-2.5 sm:py-1',
        paused
          ? 'text-amber-500 sm:border-amber-500/30 sm:bg-amber-500/10'
          : 'text-emerald-500 sm:border-emerald-500/30 sm:bg-emerald-500/10',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          paused ? 'bg-amber-500' : 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]',
        )}
        aria-hidden
      />
      {paused ? t('admin.monitoring.paused') : t('admin.monitoring.live')}
    </span>
  )

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
            <Radar className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 sm:flex sm:flex-none sm:items-center sm:gap-3">
            <h1 className="truncate text-xl font-semibold tracking-tight">{t('admin.monitoring.title')}</h1>
            {live}
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="lg:hidden">
              <PeriodMenu value={period} onChange={setPeriod} short className="h-10 px-3 text-sm" />
            </div>
            {pauseButton}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-4">
          {attention.isLoading ? <Skeleton className="h-[184px] rounded-[--radius]" /> : <IncidentsCard items={incidents} />}
          <Card className="hidden rounded-[--radius] p-4 lg:block lg:p-5">
            <div className="mb-3">
              <PeriodMenu value={period} onChange={setPeriod} className="h-8 px-2.5 text-[13px]" />
            </div>
            <SummaryTiles data={summary.data} downNow={downNow} />
          </Card>
          <div className="lg:hidden">
            <SummaryTiles data={summary.data} downNow={downNow} />
          </div>
        </div>

        <Card className="rounded-[--radius] px-3.5 pb-3 pt-3.5 sm:px-5 sm:pt-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <CustomerSearch value={customer} onChange={setCustomer} />
            <div className="sm:hidden">
              <EventFilterMenu value={filter} onChange={setFilter} botActionsAvailable={botAvailable} botActionsOff compact />
            </div>
            <div className="hidden sm:block">
              <EventFilterMenu value={filter} onChange={setFilter} botActionsAvailable={botAvailable} botActionsOff />
            </div>
          </div>

          <div className="mt-2">
            {feed.loading && feed.items.length === 0 ? (
              <div className="space-y-2 pt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : feed.error && feed.items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-muted-foreground">{t('admin.monitoring.error')}</p>
                <Button type="button" variant="outline" size="sm" loading={feed.loading} onClick={() => void feed.reload()}>
                  {t('admin.monitoring.retry')}
                </Button>
              </div>
            ) : feed.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {categories.length || customer ? t('admin.monitoring.emptyFiltered') : t('admin.monitoring.empty')}
              </p>
            ) : (
              <EventList
                items={feed.items}
                fresh={feed.fresh}
                withCustomer={!customer}
                hasMore={feed.hasMore}
                loadingMore={feed.loadingMore}
                onLoadMore={() => void feed.loadMore()}
                resetKey={resetKey}
              />
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}
