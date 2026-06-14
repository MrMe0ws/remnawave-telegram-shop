import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import {
  BarChart3,
  Users,
  CreditCard,
  TrendingUp,
  UserPlus,
  Activity,
  Wallet,
  Link2,
  Loader2,
  Gift,
  RefreshCw,
  ChevronDown,
} from 'lucide-react'

import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAdminStats } from '../hooks/useAdminStats'
import { useAdminFortuneStats, type AdminFortunePeriod } from '../hooks/useAdminFortuneStats'

interface StatCardProps {
  icon: typeof BarChart3
  title: string
  items: { label: string; value: string | number }[]
  gradient: string
}

function StatCard({ icon: Icon, title, items, gradient }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${gradient}`} />
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 dark:bg-primary/20">
          <Icon className="size-4 text-primary" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-1.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="font-medium tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function formatRub(value: number): string {
  return value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

function fortunePeriodItems(period: AdminFortunePeriod, t: ReturnType<typeof useTranslation>['t']) {
  return [
    { label: t('admin.stats.distinctUsers'), value: period.distinct_users },
    { label: t('admin.stats.totalSpins'), value: period.total_spins },
    { label: t('admin.stats.freeSpins'), value: period.free_spins },
    { label: t('admin.stats.paidSpins'), value: period.paid_spins },
    { label: t('admin.stats.paidCostDays'), value: period.paid_cost_days_sum },
    { label: t('admin.stats.wonDays'), value: period.won_subs_days_sum },
    { label: t('admin.stats.wonXP'), value: period.won_loyalty_xp_sum },
    { label: t('admin.stats.wonDiscount'), value: period.won_discount_pct_sum },
  ]
}

export default function AdminStatsPage() {
  const { t } = useTranslation()
  const [fortuneExpanded, setFortuneExpanded] = useState(false)
  const { data, isLoading, error, refetch, isFetching } = useAdminStats()
  const {
    data: fortuneData,
    isLoading: fortuneLoading,
    refetch: refetchFortune,
    isFetching: fortuneFetching,
  } = useAdminFortuneStats()

  const refreshing = isFetching || fortuneFetching

  const handleRefresh = () => {
    void refetch()
    void refetchFortune()
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          icon={BarChart3}
          title={t('admin.stats.title')}
          subtitle={t('admin.stats.subtitle')}
          accent="blue"
          actions={
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
              {t('admin.stats.refresh')}
            </button>
          }
        />

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Card className="border-destructive/50 p-6 text-center text-sm text-destructive">
            {t('admin.stats.error')}
          </Card>
        )}

        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={Users}
              title={t('admin.stats.users')}
              gradient="bg-gradient-to-r from-blue-500 to-cyan-500"
              items={[
                { label: t('admin.stats.totalCustomers'), value: data.total_customers },
                { label: t('admin.stats.activeSubscriptions'), value: data.active_subscriptions },
                { label: t('admin.stats.newToday'), value: data.new_today },
                { label: t('admin.stats.newWeek'), value: data.new_week },
                { label: t('admin.stats.newMonth'), value: data.new_month },
                { label: t('admin.stats.newPrevMonth'), value: data.new_prev_month },
              ]}
            />

            <StatCard
              icon={Activity}
              title={t('admin.stats.subscriptions')}
              gradient="bg-gradient-to-r from-emerald-500 to-green-500"
              items={[
                { label: t('admin.stats.trialActive'), value: data.trial_active },
                { label: t('admin.stats.paidActive'), value: data.paid_active },
                { label: t('admin.stats.inactive'), value: data.inactive },
              ]}
            />

            <StatCard
              icon={Wallet}
              title={t('admin.stats.revenue')}
              gradient="bg-gradient-to-r from-amber-500 to-orange-500"
              items={[
                { label: t('admin.stats.revenueToday'), value: formatRub(data.revenue_today_rub) },
                { label: t('admin.stats.revenueMonth'), value: formatRub(data.revenue_month_rub) },
                { label: t('admin.stats.revenueAllTime'), value: formatRub(data.revenue_all_time_rub) },
                { label: t('admin.stats.revenueSubsMonth'), value: formatRub(data.revenue_subs_month_rub) },
                { label: t('admin.stats.uniquePayersMonth'), value: data.unique_payers_month },
              ]}
            />

            <StatCard
              icon={CreditCard}
              title={t('admin.stats.sales')}
              gradient="bg-gradient-to-r from-violet-500 to-purple-500"
              items={[
                { label: t('admin.stats.salesToday'), value: data.sales_sub_today },
                { label: t('admin.stats.salesWeek'), value: data.sales_sub_week },
                { label: t('admin.stats.salesMonth'), value: data.sales_sub_month },
                { label: t('admin.stats.salesPrevMonth'), value: data.sales_sub_prev_month },
                { label: t('admin.stats.transactionsToday'), value: data.transactions_today },
                { label: t('admin.stats.transactionsMonth'), value: data.transactions_month },
              ]}
            />

            <StatCard
              icon={Link2}
              title={t('admin.stats.referrals')}
              gradient="bg-gradient-to-r from-pink-500 to-rose-500"
              items={[
                { label: t('admin.stats.distinctReferrers'), value: data.distinct_referrers },
                { label: t('admin.stats.activeReferrers'), value: data.active_referrers },
                { label: t('admin.stats.bonusDaysAll'), value: data.ref_bonus_days_all },
                { label: t('admin.stats.bonusDaysToday'), value: data.ref_bonus_days_today },
                { label: t('admin.stats.bonusDaysWeek'), value: data.ref_bonus_days_week },
                { label: t('admin.stats.bonusDaysMonth'), value: data.ref_bonus_days_month },
              ]}
            />

            {data.top_referrers.length > 0 && (
              <StatCard
                icon={TrendingUp}
                title={t('admin.stats.topReferrers')}
                gradient="bg-gradient-to-r from-indigo-500 to-blue-500"
                items={data.top_referrers.slice(0, 5).map((r, i) => ({
                  label: `#${i + 1} — ID ${r.referrer_id}`,
                  value: `${r.paid_referees} ${t('admin.stats.paidRefs')}`,
                }))}
              />
            )}

            {Object.keys(data.payment_rub_by_invoice ?? {}).length > 0 && (
              <StatCard
                icon={CreditCard}
                title={t('admin.stats.paymentByInvoice')}
                gradient="bg-gradient-to-r from-slate-500 to-zinc-500"
                items={Object.entries(data.payment_rub_by_invoice).map(([key, value]) => ({
                  label: key,
                  value: formatRub(value),
                }))}
              />
            )}

            {!fortuneLoading && fortuneData && (
              <>
                <Card className="overflow-hidden sm:col-span-2 lg:col-span-3">
                  <button
                    type="button"
                    onClick={() => setFortuneExpanded((v) => !v)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-fuchsia-500/10 dark:bg-fuchsia-500/20">
                        <Gift className="size-4 text-fuchsia-600 dark:text-fuchsia-400" />
                      </div>
                      <div>
                        <p className="text-base font-semibold">{t('admin.stats.fortune')}</p>
                        <p className="text-xs text-muted-foreground">{t('admin.stats.fortuneExpandHint')}</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'size-5 shrink-0 text-muted-foreground transition-transform',
                        fortuneExpanded && 'rotate-180',
                      )}
                    />
                  </button>
                </Card>
                {fortuneExpanded && (
                  <>
                    <StatCard
                      icon={Gift}
                      title={`${t('admin.stats.fortune')} — ${t('admin.stats.fortuneToday')}`}
                      gradient="bg-gradient-to-r from-fuchsia-500 to-pink-500"
                      items={fortunePeriodItems(fortuneData.today, t)}
                    />
                    <StatCard
                      icon={Gift}
                      title={`${t('admin.stats.fortune')} — ${t('admin.stats.fortuneMonth')}`}
                      gradient="bg-gradient-to-r from-purple-500 to-violet-500"
                      items={fortunePeriodItems(fortuneData.month, t)}
                    />
                    <StatCard
                      icon={Gift}
                      title={`${t('admin.stats.fortune')} — ${t('admin.stats.fortuneAllTime')}`}
                      gradient="bg-gradient-to-r from-rose-500 to-orange-500"
                      items={fortunePeriodItems(fortuneData.all_time, t)}
                    />
                  </>
                )}
              </>
            )}

            {data.tariff_breakdown.length > 0 && (
              <Card className="overflow-hidden sm:col-span-2 lg:col-span-3">
                <div className="h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 dark:bg-primary/20">
                    <UserPlus className="size-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{t('admin.stats.tariffBreakdown')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">{t('admin.stats.tariffName')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('admin.stats.salesToday')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('admin.stats.salesWeek')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('admin.stats.salesMonth')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('admin.stats.revenueToday')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('admin.stats.revenueAllTime')}</th>
                          <th className="pb-2 font-medium">{t('admin.stats.activePaidUsers')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.tariff_breakdown.map((tr) => (
                          <tr key={tr.tariff_id} className="border-b border-border/50 last:border-0">
                            <td className="py-2 pr-4 font-medium">{tr.display_name}</td>
                            <td className="py-2 pr-4 tabular-nums">{tr.sales_today}</td>
                            <td className="py-2 pr-4 tabular-nums">{tr.sales_week}</td>
                            <td className="py-2 pr-4 tabular-nums">{tr.sales_month}</td>
                            <td className="py-2 pr-4 tabular-nums">{formatRub(tr.revenue_today)}</td>
                            <td className="py-2 pr-4 tabular-nums">{formatRub(tr.revenue_all)}</td>
                            <td className="py-2 tabular-nums">{tr.active_paid_users}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
