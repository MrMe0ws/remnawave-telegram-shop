import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Filter, Gift, PieChart, Trophy } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AdminFortuneStatsResponse } from '../../hooks/useAdminFortuneStats'
import { fortunePeriodKey, type StatsPeriod } from '../utils/statsPeriod'

import { FortuneConversionFunnel } from './FortuneConversionFunnel'
import { FortuneRewardsList } from './FortuneRewardsList'
import { FortuneSectionHeader } from './FortuneSectionHeader'
import { FortuneSpinsChart } from './FortuneSpinsChart'

type FortunePeriodKey = 'today' | 'month' | 'all_time'

interface FortuneStatsAccordionProps {
  data: AdminFortuneStatsResponse
  globalPeriod: StatsPeriod
}

export function FortuneStatsAccordion({ data, globalPeriod }: FortuneStatsAccordionProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [periodKey, setPeriodKey] = useState<FortunePeriodKey>(() => fortunePeriodKey(globalPeriod))

  useEffect(() => {
    setPeriodKey(fortunePeriodKey(globalPeriod))
  }, [globalPeriod])

  const period = data[periodKey]
  const spinTrend = [
    { label: t('admin.stats.fortuneToday'), value: data.today.total_spins },
    { label: t('admin.stats.fortuneMonth'), value: data.month.total_spins },
    { label: t('admin.stats.fortuneAllTime'), value: data.all_time.total_spins },
  ]
  const userTrend = [
    { label: t('admin.stats.fortuneToday'), users: data.today.distinct_users },
    { label: t('admin.stats.fortuneMonth'), users: data.month.distinct_users },
    { label: t('admin.stats.fortuneAllTime'), users: data.all_time.distinct_users },
  ]

  const periodOptions: { key: FortunePeriodKey; label: string }[] = [
    { key: 'today', label: t('admin.stats.fortuneToday') },
    { key: 'month', label: t('admin.stats.fortuneMonth') },
    { key: 'all_time', label: t('admin.stats.fortuneAllTime') },
  ]

  return (
    <Card className="cabinet-elevated-card overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-fuchsia-500 to-violet-500" />
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 sm:px-5"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-fuchsia-500/10 dark:bg-fuchsia-500/20">
            <Gift className="size-4 text-fuchsia-500" />
          </div>
          <div>
            <p className="text-base font-semibold">{t('admin.stats.fortune')}</p>
            <p className="text-xs text-muted-foreground">{t('admin.stats.fortuneExpandHint')}</p>
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
              <div className="flex flex-wrap gap-2">
                {periodOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPeriodKey(opt.key)}
                    className={cn(
                      'min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      periodKey === opt.key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 bg-card hover:bg-accent/50',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="grid min-h-[300px] gap-4 lg:grid-cols-3 lg:items-stretch">
                <div className="flex min-h-[300px] flex-col rounded-xl border border-border/60 bg-muted/10 p-3">
                  <FortuneSectionHeader
                    icon={PieChart}
                    title={t('admin.stats.fortuneSpinsSection')}
                    boxClassName="bg-cyan-500/10 dark:bg-cyan-500/20"
                    iconClassName="text-cyan-500"
                  />
                  <FortuneSpinsChart period={period} comparePoints={spinTrend} />
                </div>
                <div className="flex min-h-[300px] flex-col rounded-xl border border-border/60 bg-muted/10 p-3">
                  <FortuneSectionHeader
                    icon={Trophy}
                    title={t('admin.stats.fortuneRewardsSection')}
                    boxClassName="bg-amber-500/10 dark:bg-amber-500/20"
                    iconClassName="text-amber-500"
                  />
                  <FortuneRewardsList byReward={period.by_reward} />
                </div>
                <div className="flex min-h-[300px] flex-col rounded-xl border border-border/60 bg-muted/10 p-3">
                  <FortuneSectionHeader
                    icon={Filter}
                    title={t('admin.stats.fortuneConversionSection')}
                    boxClassName="bg-violet-500/10 dark:bg-violet-500/20"
                    iconClassName="text-violet-500"
                  />
                  <FortuneConversionFunnel period={period} trendPoints={userTrend} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
