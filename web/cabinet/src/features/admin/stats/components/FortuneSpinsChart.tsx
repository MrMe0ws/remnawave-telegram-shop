import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { AdminFortunePeriod } from '../../hooks/useAdminFortuneStats'

import { statsNumberLocale } from '../utils/statsFormat'
import {
  statsChartTooltipItemStyle,
  statsChartTooltipLabelStyle,
  statsChartTooltipStyle,
} from '../utils/statsChartTheme'

const SPIN_COLORS = ['hsl(var(--primary))', 'hsl(280 70% 55%)']

interface FortuneSpinsChartProps {
  period: AdminFortunePeriod
  comparePoints?: { label: string; value: number }[]
}

export function FortuneSpinsChart({ period, comparePoints }: FortuneSpinsChartProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const donutData = useMemo(
    () => [
      { name: t('admin.stats.freeSpins'), value: period.free_spins },
      { name: t('admin.stats.paidSpins'), value: period.paid_spins },
    ],
    [period.free_spins, period.paid_spins, t],
  )

  const trendData = useMemo(
    () => (comparePoints ?? []).map((pt) => ({ ...pt, name: pt.label })),
    [comparePoints],
  )

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative mx-auto h-40 w-full max-w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {donutData.map((_, i) => (
                <Cell key={i} fill={SPIN_COLORS[i % SPIN_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => value.toLocaleString(numberLocale)}
              contentStyle={statsChartTooltipStyle}
              labelStyle={statsChartTooltipLabelStyle}
              itemStyle={statsChartTooltipItemStyle}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{period.total_spins}</span>
          <span className="text-xs text-muted-foreground">{t('admin.stats.totalSpins')}</span>
        </div>
      </div>

      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {donutData.map((entry, i) => (
          <li key={entry.name} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: SPIN_COLORS[i % SPIN_COLORS.length] }}
            />
            {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
          </li>
        ))}
      </ul>

      {trendData.length > 0 && (
        <div className="mt-auto rounded-lg border border-border/60 bg-muted/20 p-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {t('admin.stats.fortuneSpinTrend')}
          </p>
          <div className="h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" width={24} />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString(numberLocale)}
                  contentStyle={statsChartTooltipStyle}
                  labelStyle={statsChartTooltipLabelStyle}
                  itemStyle={statsChartTooltipItemStyle}
                />
                <Bar dataKey="value" name={t('admin.stats.totalSpins')} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
