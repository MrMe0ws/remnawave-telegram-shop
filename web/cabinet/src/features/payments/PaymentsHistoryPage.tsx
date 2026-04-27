import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatRub } from '@/lib/utils'
import { useTranslationWithLang } from '@/hooks/useTranslationWithLang'

function invoiceLabel(t: (k: string) => string, invoiceType: string): string {
  switch (invoiceType) {
    case 'yookasa':
      return t('payments.methodCard')
    case 'crypto':
      return t('payments.methodCrypto')
    case 'telegram':
      return t('payments.methodTelegram')
    case 'tribute':
      return t('payments.methodTribute')
    default:
      return invoiceType
  }
}

function kindLabel(t: (k: string) => string, kind: string): string {
  switch (kind) {
    case 'subscription':
      return t('payments.kindSubscription')
    case 'tariff_upgrade':
      return t('payments.kindUpgrade')
    case 'extra_hwid':
      return t('payments.kindExtraHwid')
    default:
      return kind || '—'
  }
}

export default function PaymentsHistoryPage() {
  const { t } = useTranslation()
  const { lang } = useTranslationWithLang()

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.purchases({ limit: 100 }),
    staleTime: 30_000,
    retry: 1,
  })

  const items = data?.items ?? []

  function formatPaid(iso?: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatMoney(amount: number, currency: string) {
    const c = (currency || '').toUpperCase()
    if (c === 'STARS' || c === 'XTR') {
      return `${amount} ⭐`
    }
    if (c === 'RUB' || c === 'RUR' || c === '') {
      return formatRub(Math.round(amount))
    }
    return `${amount} ${currency}`
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold">{t('payments.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('payments.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('payments.historyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : error ? (
              <p className="text-sm text-destructive">{t('errors.unknown')}</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('payments.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">{t('payments.colPaidAt')}</th>
                      <th className="pb-2 pr-3 font-medium">{t('payments.colAmount')}</th>
                      <th className="pb-2 pr-3 font-medium">{t('payments.colMethod')}</th>
                      <th className="pb-2 font-medium">{t('payments.colKind')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 whitespace-nowrap">{formatPaid(p.paid_at)}</td>
                        <td className="py-2.5 pr-3 font-medium">{formatMoney(p.amount, p.currency)}</td>
                        <td className="py-2.5 pr-3">{invoiceLabel(t, p.invoice_type)}</td>
                        <td className="py-2.5 text-muted-foreground">{kindLabel(t, p.purchase_kind)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
