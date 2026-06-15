import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, ChevronDown, Tag, Ticket, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AdminPromoStatsResponse } from '../../hooks/useAdminPromoStats'
import { FortuneSectionHeader } from './FortuneSectionHeader'
import { statsNumberLocale } from '../utils/statsFormat'
import {
  statsChartAxisTick,
  STATS_CHART_PALETTE,
  statsChartTooltipItemStyle,
  statsChartTooltipLabelStyle,
  statsChartTooltipStyle,
} from '../utils/statsChartTheme'

interface PromoStatsAccordionProps {
  data: AdminPromoStatsResponse
}

export function PromoStatsAccordion({ data }: PromoStatsAccordionProps) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const numberLocale = statsNumberLocale(i18n.language)

  const chartData = useMemo(
    () =>
      data.top_by_redemptions
        .filter((p) => p.redemptions > 0)
        .slice(0, 8)
        .map((p) => ({
          code: p.code,
          redemptions: p.redemptions,
          active: p.active,
        })),
    [data.top_by_redemptions],
  )

  return (
    <Card className="cabinet-elevated-card overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-rose-500 to-orange-500" />
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 sm:px-5"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-rose-500/10 dark:bg-rose-500/20">
            <Ticket className="size-4 text-rose-500" />
          </div>
          <div>
            <p className="text-base font-semibold">{t('admin.stats.promos')}</p>
            <p className="text-xs text-muted-foreground">{t('admin.stats.promosExpandHint')}</p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border/60 px-4 py-4 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  icon={Tag}
                  label={t('admin.stats.promosTotal')}
                  value={data.total}
                  numberLocale={numberLocale}
                  tone="rose"
                />
                <MetricCard
                  icon={TrendingUp}
                  label={t('admin.stats.promosActive')}
                  value={data.active}
                  numberLocale={numberLocale}
                  tone="emerald"
                />
                <MetricCard
                  icon={Tag}
                  label={t('admin.stats.promosInactive')}
                  value={data.inactive}
                  numberLocale={numberLocale}
                  tone="slate"
                />
                <MetricCard
                  icon={BarChart3}
                  label={t('admin.stats.promosRedemptions')}
                  value={data.total_redemptions}
                  sub={t('admin.stats.promosToday', { count: data.redemptions_today })}
                  numberLocale={numberLocale}
                  tone="amber"
                />
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                <FortuneSectionHeader
                  icon={BarChart3}
                  title={t('admin.stats.promosTopChart')}
                  boxClassName="bg-rose-500/10 dark:bg-rose-500/20"
                  iconClassName="text-rose-500"
                />
                {chartData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.stats.promosEmpty')}</p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" horizontal={false} />
                        <XAxis type="number" tick={statsChartAxisTick} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="code"
                          tick={statsChartAxisTick}
                          width={88}
                        />
                        <Tooltip
                          contentStyle={statsChartTooltipStyle}
                          labelStyle={statsChartTooltipLabelStyle}
                          itemStyle={statsChartTooltipItemStyle}
                          formatter={(value: number) => [
                            value.toLocaleString(numberLocale),
                            t('admin.stats.promosRedemptions'),
                          ]}
                        />
                        <Bar dataKey="redemptions" radius={[0, 6, 6, 0]} maxBarSize={28}>
                          {chartData.map((row, i) => (
                            <Cell
                              key={row.code}
                              fill={row.active ? STATS_CHART_PALETTE[i % STATS_CHART_PALETTE.length] : 'hsl(var(--muted-foreground) / 0.35)'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {data.top_by_redemptions.length > 0 && (
                <div className="rounded-xl border border-border/60">
                  <table className="w-full table-fixed text-xs sm:text-sm md:table-auto">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/20 text-left text-[11px] text-muted-foreground sm:text-xs">
                        <th className="w-[38%] px-2 py-2 font-medium sm:px-3 md:w-auto">{t('admin.stats.promosColCode')}</th>
                        <th className="hidden w-[22%] px-3 py-2 font-medium sm:table-cell md:w-auto">{t('admin.stats.promosColStatus')}</th>
                        <th className="w-[31%] px-1 py-2 text-right font-medium sm:px-3 md:w-auto">
                          <span className="md:hidden">{t('admin.stats.promosColUsesShort')}</span>
                          <span className="hidden md:inline">{t('admin.stats.promosColUses')}</span>
                        </th>
                        <th className="w-[31%] px-2 py-2 text-right font-medium sm:px-3 md:w-auto">
                          <span className="md:hidden">{t('admin.stats.promosColRedemptionsShort')}</span>
                          <span className="hidden md:inline">{t('admin.stats.promosRedemptions')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_by_redemptions.map((promo) => (
                        <tr key={promo.id} className="border-b border-border/40 last:border-0">
                          <td className="px-2 py-2 sm:px-3">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={cn(
                                  'size-1.5 shrink-0 rounded-full sm:hidden',
                                  promo.active ? 'bg-emerald-500' : 'bg-muted-foreground/45',
                                )}
                                aria-hidden
                              />
                              <span className="truncate font-mono text-[11px] font-medium sm:text-xs">{promo.code}</span>
                            </div>
                          </td>
                          <td className="hidden px-3 py-2 sm:table-cell">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                promo.active
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {promo.active ? t('admin.stats.promosStatusActive') : t('admin.stats.promosStatusInactive')}
                            </span>
                          </td>
                          <td className="px-1 py-2 text-right tabular-nums sm:px-3">{promo.uses_count}</td>
                          <td className="px-2 py-2 text-right tabular-nums font-medium sm:px-3">
                            {promo.redemptions.toLocaleString(numberLocale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  numberLocale,
  tone,
}: {
  icon: typeof Tag
  label: string
  value: number
  sub?: string
  numberLocale: string
  tone: 'rose' | 'emerald' | 'slate' | 'amber'
}) {
  const tones = {
    rose: { box: 'bg-rose-500/10 dark:bg-rose-500/20', icon: 'text-rose-500' },
    emerald: { box: 'bg-emerald-500/10 dark:bg-emerald-500/20', icon: 'text-emerald-500' },
    slate: { box: 'bg-slate-500/10 dark:bg-slate-500/20', icon: 'text-slate-400' },
    amber: { box: 'bg-amber-500/10 dark:bg-amber-500/20', icon: 'text-amber-500' },
  }[tone]

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className={cn('flex size-7 items-center justify-center rounded-md', tones.box)}>
          <Icon className={cn('size-3.5', tones.icon)} />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums">{value.toLocaleString(numberLocale)}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
