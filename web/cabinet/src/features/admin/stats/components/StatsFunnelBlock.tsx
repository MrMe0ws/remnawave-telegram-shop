import { useTranslation } from 'react-i18next'
import { CreditCard, Filter, UserPlus, Wallet } from 'lucide-react'

import type { AdminStatsInsightsDTO } from '@/lib/types/admin'
import { cn } from '@/lib/utils'

import { statsNumberLocale } from '../utils/statsFormat'
import { StatsWidgetCard } from './StatsWidgetCard'

interface StatsFunnelBlockProps {
  funnel: AdminStatsInsightsDTO['funnel']
  className?: string
}

const STEP_COLOR = 'hsl(var(--primary))'

/**
 * Воронка «зарегистрировался → выставил счёт → оплатил».
 *
 * Шага «зашёл на сайт» здесь нет и не будет, пока визиты не начнут писаться:
 * рисовать первый шаг «на глаз» — значит выдумывать конверсию.
 */
export function StatsFunnelBlock({ funnel, className }: StatsFunnelBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const steps = [
    { icon: UserPlus, label: t('admin.stats.funnelRegistered'), value: funnel.registered },
    { icon: CreditCard, label: t('admin.stats.funnelInvoiced'), value: funnel.invoiced },
    { icon: Wallet, label: t('admin.stats.funnelPaid'), value: funnel.paid },
  ]
  const base = Math.max(funnel.registered, 1)

  const invoiceConv =
    funnel.invoices_created > 0
      ? Math.round((funnel.invoices_paid * 100) / funnel.invoices_created)
      : 0

  return (
    <StatsWidgetCard
      icon={Filter}
      title={t('admin.stats.funnelTitle')}
      gradient="bg-gradient-to-r from-sky-500 to-blue-500"
      accent="blue"
      className={className}
    >
      <div className="flex flex-1 flex-col gap-3">
        <ul className="space-y-2">
          {steps.map((step, i) => {
            const StepIcon = step.icon
            const width = Math.max((step.value * 100) / base, step.value > 0 ? 4 : 0)
            const prev = i === 0 ? null : steps[i - 1].value
            const conv = prev && prev > 0 ? Math.round((step.value * 100) / prev) : null
            return (
              <li key={step.label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <StepIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{step.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold text-foreground">
                      {step.value.toLocaleString(numberLocale)}
                    </span>
                    {conv !== null && (
                      <span className="ml-1.5 text-muted-foreground">{conv}%</span>
                    )}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${width}%`,
                      backgroundColor: STEP_COLOR,
                      opacity: 1 - i * 0.22,
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        <p className="text-[11px] leading-snug text-muted-foreground">
          {t('admin.stats.funnelCohortHint')}
        </p>

        <div className={cn('mt-auto rounded-lg border border-border/50 bg-muted/20 px-3 py-2')}>
          <p className="text-xs text-muted-foreground">{t('admin.stats.funnelInvoiceConv')}</p>
          <p className="font-semibold tabular-nums">
            {funnel.invoices_paid.toLocaleString(numberLocale)}
            <span className="text-muted-foreground">
              {' / '}
              {funnel.invoices_created.toLocaleString(numberLocale)}
            </span>
            <span className="ml-2 text-sm font-medium text-primary">{invoiceConv}%</span>
          </p>
        </div>
      </div>
    </StatsWidgetCard>
  )
}
