import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { AdminFortunePeriod } from '../../hooks/useAdminFortuneStats'
import {
  statsChartTooltipItemStyle,
  statsChartTooltipLabelStyle,
  statsChartTooltipStyle,
} from '../utils/statsChartTheme'

interface FortuneConversionFunnelProps {
  period: AdminFortunePeriod
  trendPoints?: { label: string; users: number }[]
}

const FUNNEL_COLORS = ['#2dd4bf', '#3b82f6', '#a78bfa'] as const

function funnelWidths(pcts: number[]) {
  const maxW = 100
  const minW = 38
  return pcts.map((pct) => minW + ((maxW - minW) * Math.min(100, Math.max(0, pct))) / 100)
}

export function FortuneConversionFunnel({ period, trendPoints }: FortuneConversionFunnelProps) {
  const { t } = useTranslation()
  const arrowId = useId()

  const { stages, lineData } = useMemo(() => {
    const total = period.total_spins || 0
    const users = period.distinct_users || 0
    const wins = Object.values(period.by_reward ?? {}).reduce((s, v) => s + v, 0)
    const paid = period.paid_spins || 0

    const p1 = users > 0 ? 100 : 0
    const p2 = total > 0 ? Math.round((paid / total) * 100) : 0
    const p3 = total > 0 ? Math.round((wins / total) * 100) : 0
    const widths = funnelWidths([p1, p2, p3])

    const stageData = [
      {
        label: t('admin.stats.fortuneFunnelUsers'),
        value: users,
        pct: p1,
        width: widths[0],
        color: FUNNEL_COLORS[0],
      },
      {
        label: t('admin.stats.fortuneFunnelSpins'),
        value: total,
        pct: p2,
        width: widths[1],
        color: FUNNEL_COLORS[1],
      },
      {
        label: t('admin.stats.fortuneFunnelWins'),
        value: wins,
        pct: p3,
        width: widths[2],
        color: FUNNEL_COLORS[2],
      },
    ]

    return {
      stages: stageData,
      lineData: trendPoints ?? [],
    }
  }, [period, t, trendPoints])

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative flex justify-center pr-6">
        <div className="flex w-full max-w-[220px] flex-col items-center gap-0.5">
          {stages.map((stage, index) => (
            <div
              key={stage.label}
              className="relative flex items-center justify-center transition-all"
              style={{ width: `${stage.width}%` }}
            >
              <div
                className="flex w-full flex-col items-center justify-center px-2 py-2.5 text-center text-white shadow-sm"
                style={{
                  backgroundColor: stage.color,
                  clipPath:
                    index < stages.length - 1
                      ? 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)'
                      : 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)',
                  minHeight: index === 0 ? '3.25rem' : '2.75rem',
                }}
              >
                <span className="text-lg font-bold leading-none tabular-nums">{stage.pct}%</span>
                <span className="mt-0.5 text-[10px] font-medium leading-tight opacity-90">
                  {stage.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <svg
          className="pointer-events-none absolute right-0 top-2 h-[calc(100%-0.5rem)] w-5 text-muted-foreground/50"
          viewBox="0 0 20 120"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M 2 18 Q 14 28 2 42"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            markerEnd={`url(#${arrowId})`}
          />
          <path
            d="M 2 58 Q 14 68 2 82"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <defs>
            <marker id={arrowId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
            </marker>
          </defs>
        </svg>
      </div>

      <ul className="space-y-0.5 text-center text-[10px] text-muted-foreground">
        {stages.map((stage) => (
          <li key={`meta-${stage.label}`}>
            {stage.label}: <span className="font-medium text-foreground">{stage.value}</span>
          </li>
        ))}
      </ul>

      {lineData.length > 1 && (
        <div className="mt-auto h-28 w-full">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {t('admin.stats.fortuneUserTrend')}
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={lineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fortuneUserArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" width={24} />
              <Tooltip
                contentStyle={statsChartTooltipStyle}
                labelStyle={statsChartTooltipLabelStyle}
                itemStyle={statsChartTooltipItemStyle}
              />
              <Area
                type="monotone"
                dataKey="users"
                name={t('admin.stats.fortuneFunnelUsers')}
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#fortuneUserArea)"
                dot={{ r: 2.5, fill: '#3b82f6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
