import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  CalendarPlus,
  Hourglass,
  Link2,
  Repeat,
  UserMinus,
  UserRoundCheck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'

import type { AdminStatsInsightsDTO, AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'

import { StatsGroupCard, type StatsGroupItem } from '../components/StatsGroupCard'
import { TopReferrersTable } from '../components/TopReferrersTable'
import { UsersStatsWidget } from '../components/UsersStatsWidget'
import { pctOf, statsNumberLocale } from '../utils/statsFormat'
import {
  getStatsPeriodSlice,
  snapshotFallbackPeriod,
  statsPeriodLabel,
  type StatsCustomRange,
  type StatsPeriod,
} from '../utils/statsPeriod'

interface StatsUsersTabProps {
  data: AdminStatsResponse
  insights?: AdminStatsInsightsDTO | null
  timeseries?: AdminStatsTimeSeriesDTO | null
  period: StatsPeriod
  customRange?: StatsCustomRange | null
}

export function StatsUsersTab({
  data,
  insights,
  timeseries,
  period,
  customRange,
}: StatsUsersTabProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'

  const refPeriod = snapshotFallbackPeriod(period)
  const refSlice = getStatsPeriodSlice(data, refPeriod)
  const refPeriodLabel = statsPeriodLabel(t, refPeriod, { locale })

  const lifetime = insights?.lifetime
  const lifetimeMonths = lifetime ? lifetime.avg_lifetime_days / 30.44 : 0

  const bucketItems: StatsGroupItem[] = [
    {
      icon: Zap,
      label: t('admin.stats.trialActive'),
      value: data.trial_active.toLocaleString(numberLocale),
    },
    {
      icon: Wallet,
      label: t('admin.stats.paidActive'),
      value: data.paid_active.toLocaleString(numberLocale),
    },
    {
      icon: UserMinus,
      label: t('admin.stats.inactive'),
      value: data.inactive.toLocaleString(numberLocale),
      hint: t('admin.stats.inactivePaidOf', { count: data.inactive_paid }),
    },
  ]

  const lifetimeItems: StatsGroupItem[] = lifetime
    ? [
        {
          icon: Hourglass,
          label: t('admin.stats.avgLifetime'),
          value: t('admin.stats.monthsValue', { value: lifetimeMonths.toFixed(1) }),
          hint: t('admin.stats.daysValue', { value: Math.round(lifetime.avg_lifetime_days) }),
        },
        {
          icon: CalendarClock,
          label: t('admin.stats.avgPaidMonths'),
          value: lifetime.avg_paid_months.toFixed(1),
        },
        {
          icon: Repeat,
          label: t('admin.stats.avgPurchases'),
          value: lifetime.avg_purchases.toFixed(1),
          hint: t('admin.stats.payingCustomers', { count: lifetime.paying_customers }),
        },
      ]
    : []

  const referralItems: StatsGroupItem[] = [
    {
      icon: Users,
      label: t('admin.stats.distinctReferrers'),
      value: data.distinct_referrers.toLocaleString(numberLocale),
    },
    {
      icon: UserRoundCheck,
      label: t('admin.stats.activeReferrers'),
      value: data.active_referrers.toLocaleString(numberLocale),
      hint: t('admin.stats.ofTotalPct', {
        pct: pctOf(data.active_referrers, data.distinct_referrers),
      }),
    },
    {
      icon: CalendarPlus,
      label: t('admin.stats.bonusDaysPeriod', { period: refPeriodLabel }),
      value: refSlice.refBonus.toLocaleString(numberLocale),
      hint: t('admin.stats.bonusDaysAllValue', {
        value: data.ref_bonus_days_all.toLocaleString(numberLocale),
      }),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <UsersStatsWidget
          data={data}
          period={period}
          timeseries={timeseries}
          customRange={customRange}
        />
        <StatsGroupCard
          icon={Zap}
          title={t('admin.stats.subscriptions')}
          accent="emerald"
          gradient="bg-gradient-to-r from-emerald-500 to-teal-500"
          items={bucketItems}
        />
      </div>

      {lifetimeItems.length > 0 && (
        <StatsGroupCard
          icon={Hourglass}
          title={t('admin.stats.lifetimeTitle')}
          accent="indigo"
          gradient="bg-gradient-to-r from-indigo-500 to-violet-500"
          items={lifetimeItems}
          footer={
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {t('admin.stats.lifetimeHint')}
            </p>
          }
        />
      )}

      <StatsGroupCard
        icon={Link2}
        title={t('admin.stats.referrals')}
        accent="pink"
        gradient="bg-gradient-to-r from-pink-500 to-rose-500"
        items={referralItems}
      />

      <TopReferrersTable rows={data.top_referrers} />
    </div>
  )
}
