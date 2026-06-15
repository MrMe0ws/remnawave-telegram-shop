import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, ChevronDown, Gem, Percent, Users } from 'lucide-react'
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
import type { AdminLoyaltyStatsResponse } from '../../hooks/useAdminLoyaltyStats'
import { FortuneSectionHeader } from './FortuneSectionHeader'
import { statsNumberLocale } from '../utils/statsFormat'
import {
  statsChartAxisTick,
  STATS_CHART_PALETTE,
  statsChartTooltipItemStyle,
  statsChartTooltipLabelStyle,
  statsChartTooltipStyle,
} from '../utils/statsChartTheme'

interface LoyaltyStatsAccordionProps {
  data: AdminLoyaltyStatsResponse
}

export function LoyaltyStatsAccordion({ data }: LoyaltyStatsAccordionProps) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const numberLocale = statsNumberLocale(i18n.language)

  const chartData = useMemo(
    () =>
      data.tiers.map((tier) => ({
        key: `lv-${tier.sort_order}`,
        label: t('admin.stats.loyaltyTierShort', {
          level: tier.sort_order,
          discount: tier.discount_percent,
        }),
        level: tier.sort_order,
        discount: tier.discount_percent,
        xpMin: tier.xp_min,
        users: tier.user_count,
        displayName: tier.display_name?.trim() || null,
      })),
    [data.tiers, t],
  )

  const totalUsers = useMemo(
    () => chartData.reduce((sum, row) => sum + row.users, 0),
    [chartData],
  )

  if (!data.enabled) {
    return null
  }

  return (
    <Card className="cabinet-elevated-card overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 sm:px-5"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 dark:bg-emerald-500/20">
            <Gem className="size-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-base font-semibold">{t('admin.stats.loyalty')}</p>
            <p className="text-xs text-muted-foreground">{t('admin.stats.loyaltyExpandHint')}</p>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                  <FortuneSectionHeader
                    icon={Users}
                    title={t('admin.stats.loyaltyUsersTotal')}
                    boxClassName="bg-cyan-500/10 dark:bg-cyan-500/20"
                    iconClassName="text-cyan-500"
                  />
                  <p className="text-2xl font-bold tabular-nums">{totalUsers.toLocaleString(numberLocale)}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                  <FortuneSectionHeader
                    icon={Percent}
                    title={t('admin.stats.loyaltyTiersCount')}
                    boxClassName="bg-amber-500/10 dark:bg-amber-500/20"
                    iconClassName="text-amber-500"
                  />
                  <p className="text-2xl font-bold tabular-nums">{data.tiers.length.toLocaleString(numberLocale)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                <FortuneSectionHeader
                  icon={BarChart3}
                  title={t('admin.stats.loyaltyDistribution')}
                  boxClassName="bg-emerald-500/10 dark:bg-emerald-500/20"
                  iconClassName="text-emerald-500"
                />
                {chartData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.stats.loyaltyEmpty')}</p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={statsChartAxisTick}
                          interval={0}
                          angle={chartData.length > 4 ? -24 : 0}
                          textAnchor={chartData.length > 4 ? 'end' : 'middle'}
                          height={chartData.length > 4 ? 56 : 32}
                        />
                        <YAxis tick={statsChartAxisTick} allowDecimals={false} width={36} />
                        <Tooltip
                          contentStyle={statsChartTooltipStyle}
                          labelStyle={statsChartTooltipLabelStyle}
                          itemStyle={statsChartTooltipItemStyle}
                          formatter={(value: number) => [
                            value.toLocaleString(numberLocale),
                            t('admin.stats.loyaltyUsers'),
                          ]}
                          labelFormatter={(_, payload) => {
                            const row = payload?.[0]?.payload as (typeof chartData)[number] | undefined
                            if (!row) return ''
                            const name = row.displayName ? ` — ${row.displayName}` : ''
                            return `${t('admin.stats.loyaltyTierFromXp', { level: row.level, xp: row.xpMin })}${name} · ${row.discount}%`
                          }}
                        />
                        <Bar dataKey="users" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={STATS_CHART_PALETTE[i % STATS_CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/60">
                <table className="w-full table-fixed text-xs sm:text-sm md:table-auto">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/20 text-left text-[11px] text-muted-foreground sm:text-xs">
                      <th className="w-[34%] px-2 py-2 font-medium sm:px-3 md:w-auto">{t('admin.stats.loyaltyColLevel')}</th>
                      <th className="w-[22%] px-1 py-2 font-medium sm:px-3 md:w-auto">
                        <span className="md:hidden">{t('admin.stats.loyaltyColXpShort')}</span>
                        <span className="hidden md:inline">{t('admin.stats.loyaltyColXp')}</span>
                      </th>
                      <th className="w-[18%] px-1 py-2 font-medium sm:px-3 md:w-auto">
                        <span className="md:hidden">{t('admin.stats.loyaltyColDiscountShort')}</span>
                        <span className="hidden md:inline">{t('admin.stats.loyaltyColDiscount')}</span>
                      </th>
                      <th className="w-[26%] px-2 py-2 text-right font-medium sm:px-3 md:w-auto">
                        <span className="md:hidden">{t('admin.stats.loyaltyColUsersShort')}</span>
                        <span className="hidden md:inline">{t('admin.stats.loyaltyColUsers')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tiers.map((tier) => (
                      <tr key={tier.sort_order} className="border-b border-border/40 last:border-0">
                        <td className="truncate px-2 py-2 font-medium sm:px-3">
                          {tier.display_name?.trim() || t('admin.stats.loyaltyLevelN', { n: tier.sort_order })}
                        </td>
                        <td className="px-1 py-2 tabular-nums text-muted-foreground sm:px-3">{tier.xp_min}</td>
                        <td className="px-1 py-2 tabular-nums sm:px-3">{tier.discount_percent}%</td>
                        <td className="px-2 py-2 text-right tabular-nums font-medium sm:px-3">
                          {tier.user_count.toLocaleString(numberLocale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
