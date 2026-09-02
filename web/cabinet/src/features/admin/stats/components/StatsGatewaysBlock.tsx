import { useTranslation } from 'react-i18next'
import { CreditCard } from 'lucide-react'

import { formatInvoiceType } from '../../utils/formatInvoiceType'
import { formatDecimal, formatRub, statsNumberLocale } from '../utils/statsFormat'
import { seriesColor, STATS_ACCENT } from '../utils/statsPalette'
import { StatsBar, StatsDot, StatsFootnote, StatsPanel, StatsPanelHead } from './StatsPanel'

export interface GatewayRow {
  key: string
  revenue: number
  /** null — счётчик платежей недоступен (данные из снимка за всё время). */
  payments: number | null
}

interface StatsGatewaysBlockProps {
  rows: GatewayRow[]
  /** false — показана разбивка за всё время, а не за выбранный период. */
  scoped: boolean
  className?: string
}

/** Откуда пришли деньги: сумма, доля и число платежей по каждой кассе. */
export function StatsGatewaysBlock({ rows, scoped, className }: StatsGatewaysBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const total = rows.reduce((sum, row) => sum + row.revenue, 0)

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={CreditCard}
        color={STATS_ACCENT.blue}
        title={t('admin.stats.gatewaysTitle')}
        subtitle={t('admin.stats.gatewaysSubtitle')}
      />

      <div className="flex flex-col gap-3.5">
        {rows.map((row, i) => {
          const color = seriesColor(i)
          const share = total > 0 ? (row.revenue * 100) / total : 0
          return (
            <div key={row.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <StatsDot color={color} />
                  <span className="truncate">{formatInvoiceType(row.key, t)}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatRub(row.revenue, numberLocale)}
                  <span className="ml-1.5 text-muted-foreground">
                    · {formatDecimal(share, numberLocale)}%
                    {row.payments !== null &&
                      ` · ${t('admin.stats.paymentsCount', { count: row.payments })}`}
                  </span>
                </span>
              </div>
              <StatsBar percent={share} color={color} />
            </div>
          )
        })}
      </div>

      {!scoped && <StatsFootnote>{t('admin.stats.paymentByInvoiceHint')}</StatsFootnote>}
    </StatsPanel>
  )
}
