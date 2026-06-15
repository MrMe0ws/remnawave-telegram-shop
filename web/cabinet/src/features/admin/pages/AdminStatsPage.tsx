import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, CreditCard, Loader2, RefreshCw } from 'lucide-react'

import { AdminLayout } from '../layout/AdminLayout'
import { useAdminShell } from '../layout/AdminShellContext'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAdminStats } from '../hooks/useAdminStats'
import { useAdminStatsTimeSeries } from '../hooks/useAdminStatsTimeSeries'
import { useAdminFortuneStats } from '../hooks/useAdminFortuneStats'
import { FortuneStatsAccordion } from '../stats/components/FortuneStatsAccordion'
import { ReferralsStatsWidget } from '../stats/components/ReferralsStatsWidget'
import { RevenueStatsWidget } from '../stats/components/RevenueStatsWidget'
import { SalesStatsWidget } from '../stats/components/SalesStatsWidget'
import { StatsPeriodSelector } from '../stats/components/StatsPeriodSelector'
import { TariffsOverviewChart } from '../stats/components/TariffsOverviewChart'
import { TariffsStatsTable } from '../stats/components/TariffsStatsTable'
import { UsersStatsWidget } from '../stats/components/UsersStatsWidget'
import { formatPeriodRub, type StatsPeriod } from '../stats/utils/statsPeriod'
import { statsNumberLocale } from '../stats/utils/statsFormat'
import { useAdminMobileHeaderAutoHide } from '../hooks/useAdminMobileHeaderAutoHide'

export default function AdminStatsPage() {
  return (
    <AdminLayout>
      <AdminStatsPageContent />
    </AdminLayout>
  )
}

function AdminStatsPageContent() {
  const { t, i18n } = useTranslation()
  const { mobileHeaderVisible } = useAdminShell()
  useAdminMobileHeaderAutoHide(true)
  const [period, setPeriod] = useState<StatsPeriod>('month')
  const { data, isLoading, error, refetch, isFetching } = useAdminStats()
  const {
    data: timeseries,
    refetch: refetchTimeseries,
    isFetching: timeseriesFetching,
  } = useAdminStatsTimeSeries(period)
  const {
    data: fortuneData,
    isLoading: fortuneLoading,
    refetch: refetchFortune,
    isFetching: fortuneFetching,
  } = useAdminFortuneStats()

  const refreshing = isFetching || fortuneFetching || timeseriesFetching
  const numberLocale = statsNumberLocale(i18n.language)
  const tariffRows = data?.tariff_breakdown ?? []

  const handleRefresh = () => {
    void refetch()
    void refetchTimeseries()
    void refetchFortune()
  }

  const updatedLabel = useMemo(() => {
    if (!data?.captured_at) return null
    try {
      return new Date(data.captured_at).toLocaleString(numberLocale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return null
    }
  }, [data?.captured_at, numberLocale])

  const refreshButton = (iconOnly: boolean) => (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      aria-label={t('admin.stats.refresh')}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card font-medium transition-colors hover:bg-accent disabled:opacity-50',
        iconOnly ? 'size-11 p-2' : 'min-h-11 gap-2 px-3 py-2 text-sm',
      )}
    >
      <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
      {!iconOnly && t('admin.stats.refresh')}
    </button>
  )

  const paymentEntries = useMemo(
    () => Object.entries(data?.payment_rub_by_invoice ?? {}),
    [data?.payment_rub_by_invoice],
  )

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'sticky z-40 -mx-3 border-b border-border/80 bg-card/92 px-3 py-2 backdrop-blur-xl transition-[top] duration-200 ease-out sm:-mx-4 sm:px-4 dark:border-primary/12 md:hidden',
          mobileHeaderVisible ? 'top-14' : 'top-0',
        )}
      >
        <div className="flex items-center gap-2">
          <StatsPeriodSelector value={period} onChange={setPeriod} className="min-w-0 flex-1" />
          {refreshButton(true)}
        </div>
      </div>

      <AdminPageHeader
        icon={BarChart3}
        title={t('admin.stats.title')}
        subtitle={t('admin.stats.subtitle')}
        accent="blue"
        actions={
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <StatsPeriodSelector value={period} onChange={setPeriod} />
            {refreshButton(false)}
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3">
        {updatedLabel ? (
          <p className="text-xs text-muted-foreground">
            {t('admin.stats.updatedAt', { date: updatedLabel })}
          </p>
        ) : (
          <span />
        )}
      </div>

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
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <UsersStatsWidget data={data} period={period} timeseries={timeseries} />
            <RevenueStatsWidget data={data} period={period} timeseries={timeseries} />
            <ReferralsStatsWidget data={data} period={period} />
            <SalesStatsWidget data={data} period={period} timeseries={timeseries} />
          </div>

          {tariffRows.length > 0 && (
            <>
              <TariffsOverviewChart rows={tariffRows} period={period} timeseries={timeseries} />
              <TariffsStatsTable rows={tariffRows} period={period} timeseries={timeseries} />
            </>
          )}

          {paymentEntries.length > 0 && (
            <Card className="cabinet-elevated-card overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-slate-500 to-zinc-500" />
              <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-500/10 dark:bg-slate-500/20">
                  <CreditCard className="size-4 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">{t('admin.stats.paymentByInvoice')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.stats.paymentByInvoiceHint')}
                  </p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                  {paymentEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm"
                    >
                      <p className="text-xs text-muted-foreground">{key}</p>
                      <p className="font-semibold tabular-nums">
                        {formatPeriodRub(value, numberLocale)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {!fortuneLoading && fortuneData && (
            <FortuneStatsAccordion data={fortuneData} globalPeriod={period} />
          )}
        </div>
      )}
    </div>
  )
}
