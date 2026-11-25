import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { AdminSelect } from '../components/AdminSelect'
import { DateRangePicker, toYmd, type DateRangePreset } from '../components/DateRangePicker'
import { formatGiB } from './format'
import { NodeSidePanel } from './NodeSidePanel'
import { HeaderIconButton, PANEL_CAP, PanelEmpty, PanelError, PanelSkeleton } from './panelUi'

const TOP_OPTIONS = [100, 500, 1000, 2000]

function lastDays(n: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (n - 1))
  return { start: toYmd(start), end: toYmd(end) }
}

/** Мини-график area по дням на чистом SVG. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const gid = useId().replace(/:/g, '')
  const W = 320
  const H = 76
  const pts = values.length === 1 ? [values[0], values[0]] : values
  const max = Math.max(...pts, 1)
  const step = pts.length > 1 ? W / (pts.length - 1) : W
  const xy = pts.map((v, i) => [i * step, H - 4 - (v / max) * (H - 12)] as const)
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="h-[76px] w-full text-indigo-500 dark:text-indigo-400"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function UsagePanel({ nodeUuid, open, onClose }: { nodeUuid: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [top, setTop] = useState(100)
  const [range, setRange] = useState(() => lastDays(7))
  const valid = !!range.start && !!range.end && range.start <= range.end
  const presets = useMemo<DateRangePreset[]>(() => {
    const now = new Date()
    const month = { start: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)), end: toYmd(now) }
    return [
      { key: 'month', label: t('admin.nodes.panels.usage.presets.month'), range: month },
      ...[3, 7, 14, 30, 60, 90, 180].map((n) => ({ key: `d${n}`, label: t(`admin.nodes.panels.usage.presets.d${n}`), range: lastDays(n) })),
    ]
  }, [t])

  const q = useQuery({
    queryKey: ['admin-node-usage', nodeUuid, range.start, range.end, top],
    queryFn: () => api.adminNodeUsage(nodeUuid, { start: range.start, end: range.end, top }),
    enabled: open && valid,
  })

  const data = q.data
  const maxUser = useMemo(() => Math.max(1, ...(data?.top_users.map((u) => u.total_bytes) ?? [0])), [data])

  return (
    <NodeSidePanel
      open={open}
      onClose={onClose}
      title={t('admin.nodes.panels.usage.title')}
      icon={BarChart3}
      iconAccent="indigo"
      headerAction={<HeaderIconButton label={t('admin.nodes.panels.refresh')} onClick={() => void q.refetch()} busy={q.isFetching} />}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <div className="w-[6.5rem] shrink-0">
          <AdminSelect
            value={top}
            onChange={(v) => v && setTop(v)}
            options={TOP_OPTIONS.map((n) => ({ value: n, label: t('admin.nodes.panels.usage.top', { n }) }))}
            placeholder={t('admin.nodes.panels.usage.top', { n: top })}
            ariaLabel={t('admin.nodes.panels.usage.topLabel')}
          />
        </div>
        <DateRangePicker
          value={range}
          onChange={setRange}
          presets={presets}
          ariaLabel={t('admin.nodes.panels.usage.period')}
          className="flex-1"
        />
      </div>

      {valid && q.isLoading && <PanelSkeleton rows={4} />}
      {valid && q.isError && !data && <PanelError onRetry={() => void q.refetch()} />}
      {valid && data && (
        <div className={cn('flex flex-col gap-4 transition-opacity', q.isFetching && 'opacity-60')}>
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
            <div className={PANEL_CAP}>{t('admin.nodes.panels.usage.total')}</div>
            <div className="mt-1 font-mono text-3xl font-extrabold leading-none">{formatGiB(data.total_bytes)}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 font-mono">
              <div>
                <div className={PANEL_CAP}>{t('admin.nodes.panels.usage.avgDay')}</div>
                <div className="text-sm font-bold">{formatGiB(data.avg_per_day_bytes)}</div>
              </div>
              <div>
                <div className={PANEL_CAP}>{t('admin.nodes.panels.usage.peak')}</div>
                <div className="text-sm font-bold">{formatGiB(data.peak_bytes)}</div>
              </div>
            </div>
            {data.sparkline.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-lg">
                <Sparkline values={data.sparkline} label={t('admin.nodes.panels.usage.chart')} />
              </div>
            )}
          </div>

          <div>
            <div className={cn(PANEL_CAP, 'mb-2')}>{t('admin.nodes.panels.usage.users')}</div>
            {data.top_users.length === 0 ? (
              <PanelEmpty icon={BarChart3}>{t('admin.nodes.panels.usage.empty')}</PanelEmpty>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.top_users.map((u, i) => (
                  <li key={`${u.username}-${i}`} className="rounded-[10px] border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: u.color || undefined }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={u.username}>
                        {u.username}
                      </span>
                      <span className="shrink-0 font-mono text-[13px] font-bold">{formatGiB(u.total_bytes)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/80">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, (u.total_bytes / maxUser) * 100)}%`,
                          backgroundColor: u.color || 'hsl(var(--primary))',
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </NodeSidePanel>
  )
}
