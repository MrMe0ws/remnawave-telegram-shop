import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Percent, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

interface FortuneRewardsListProps {
  byReward: Record<string, number>
}

const REWARD_ICON_RULES: { test: RegExp; icon: typeof Calendar; tone: string }[] = [
  { test: /day|дн/i, icon: Calendar, tone: 'text-cyan-500 bg-cyan-500/10' },
  { test: /xp|лоял/i, icon: Sparkles, tone: 'text-violet-500 bg-violet-500/10' },
  { test: /discount|скид/i, icon: Percent, tone: 'text-amber-500 bg-amber-500/10' },
]

function rewardMeta(name: string) {
  const rule = REWARD_ICON_RULES.find((r) => r.test.test(name))
  return rule ?? { icon: Sparkles, tone: 'text-fuchsia-500 bg-fuchsia-500/10' }
}

export function FortuneRewardsList({ byReward }: FortuneRewardsListProps) {
  const { t } = useTranslation()

  const rows = useMemo(() => {
    const entries = Object.entries(byReward ?? {}).filter(([, v]) => v > 0)
    const total = entries.reduce((s, [, v]) => s + v, 0)
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: total > 0 ? ((count * 100) / total).toFixed(1) : '0.0',
      }))
  }, [byReward])

  if (rows.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center py-4 text-center text-sm text-muted-foreground">
        {t('admin.noData')}
      </p>
    )
  }

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
      {rows.map((row) => {
        const { icon: Icon, tone } = rewardMeta(row.name)
        return (
          <li
            key={row.name}
            className="flex flex-1 items-center gap-2.5 rounded-lg border border-border/50 bg-muted/15 px-2.5 py-2"
          >
            <div className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', tone)}>
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.count} · {row.pct}%
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{row.pct}%</span>
          </li>
        )
      })}
    </ul>
  )
}
