import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CreditCard, Bitcoin, Check, AlertCircle } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api, ApiError, type TariffItem } from '@/lib/api'
import { newIdempotencyKey, cn } from '@/lib/utils'

type Provider = 'yookassa' | 'cryptopay'

export default function CheckoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const tariffSlug = searchParams.get('tariff') ?? ''
  const months = parseInt(searchParams.get('months') ?? '1', 10)

  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch tariffs to get the selected tariff details.
  const { data: tariffsData, isLoading: tariffsLoading } = useQuery({
    queryKey: ['tariffs'],
    queryFn: () => api.tariffs(),
    staleTime: 5 * 60_000,
  })

  const tariff: TariffItem | undefined = tariffsData?.tariffs.find(
    (t) => t.slug === tariffSlug && t.months === months,
  ) ?? tariffsData?.tariffs.find((t) => t.slug === tariffSlug)

  const previewTariffId =
    tariffsData?.sales_mode === 'tariffs' && tariff != null && tariff.id != null && tariff.id > 0
      ? tariff.id
      : undefined

  const { data: preview, isError: previewError } = useQuery({
    queryKey: ['paymentPreview', tariff?.months, previewTariffId, tariffsData?.sales_mode],
    queryFn: () => api.paymentPreview(tariff!.months, previewTariffId),
    enabled: Boolean(tariff) && !tariffsLoading,
    staleTime: 30_000,
  })

  const amountRub = preview?.amount_rub ?? tariff?.price_rub ?? 0
  const scenarioKey = checkoutScenarioI18nKey(preview?.scenario)

  async function handlePay() {
    if (!provider) return
    if (!tariff) { setError(t('errors.unknown')); return }
    setError(null)
    setLoading(true)

    const idempotencyKey = newIdempotencyKey()

    try {
      const tariffId =
        tariffsData?.sales_mode === 'tariffs' && tariff.id != null && tariff.id > 0 ? tariff.id : undefined
      const res = await api.checkout(
        { period: tariff.months, provider, tariffId },
        idempotencyKey,
      )
      // Redirect to payment provider URL; after payment we'll redirect to status page.
      window.location.href = res.payment_url
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(t('errors.tooManyRequests'))
        } else if (err.status === 400 || err.status === 422) {
          setError(t('checkout.notAvailable'))
        } else {
          setError(t('errors.unknown'))
        }
      } else {
        setError(t('errors.unknown'))
      }
      setLoading(false)
    }
  }

  const monthsLabel = pluralizeMonths(tariff?.months ?? months)

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Back link */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/tariffs">
            <ArrowLeft size={14} />
            {t('checkout.back')}
          </Link>
        </Button>

        <h1 className="text-2xl font-semibold">{t('checkout.title')}</h1>

        {/* Order summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">
              {t('checkout.summary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tariffsLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
              </div>
            ) : !tariff ? (
              <p className="text-sm text-destructive">{t('errors.unknown')}</p>
            ) : (
              <div className="space-y-2 text-sm">
                {preview && (
                  <SummaryRow label={t('checkout.scenario')} value={t(scenarioKey)} />
                )}
                <SummaryRow label={t('checkout.period')} value={monthsLabel} />
                {tariff.name && (
                  <SummaryRow label="Plan" value={tariff.name} />
                )}
                {tariff.device_limit > 0 && (
                  <SummaryRow label="Devices" value={String(tariff.device_limit)} />
                )}
                {preview?.is_early_downgrade && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">{t('checkout.earlyDowngradeHint')}</p>
                )}
                {previewError && (
                  <p className="text-xs text-muted-foreground">{t('checkout.previewError')}</p>
                )}
                {preview &&
                  preview.list_price_rub != null &&
                  preview.list_price_rub > 0 &&
                  preview.list_price_rub !== preview.amount_rub && (
                    <p className="text-xs text-muted-foreground">
                      {t('checkout.listPriceNote', {
                        amount: preview.list_price_rub.toLocaleString('ru-RU'),
                      })}
                    </p>
                  )}
                {preview &&
                  preview.base_amount_rub != null &&
                  preview.base_amount_rub > 0 &&
                  preview.amount_rub < preview.base_amount_rub && (
                    <div className="space-y-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      <SummaryRow
                        label={t('checkout.subtotalBeforeDiscount')}
                        value={`${preview.base_amount_rub.toLocaleString('ru-RU')} ${t('checkout.rub')}`}
                      />
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                        {(preview.loyalty_discount_pct ?? 0) > 0 && (
                          <span>{t('checkout.loyaltyDiscount', { pct: preview.loyalty_discount_pct })}</span>
                        )}
                        {(preview.promo_discount_pct ?? 0) > 0 && (
                          <span>{t('checkout.promoDiscount', { pct: preview.promo_discount_pct })}</span>
                        )}
                        {(preview.total_discount_pct ?? 0) > 0 && (
                          <span>{t('checkout.totalDiscount', { pct: preview.total_discount_pct })}</span>
                        )}
                      </div>
                      <SummaryRow
                        label={t('checkout.youSave')}
                        value={`−${(preview.base_amount_rub - preview.amount_rub).toLocaleString('ru-RU')} ${t('checkout.rub')}`}
                      />
                    </div>
                  )}
                <div className="border-t border-border pt-2 mt-2">
                  <SummaryRow
                    label={t('checkout.total')}
                    value={
                      <span className="text-lg font-bold">
                        {amountRub.toLocaleString('ru-RU')} {t('checkout.rub')}
                      </span>
                    }
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provider selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">
              {t('checkout.chooseProvider')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ProviderButton
              selected={provider === 'yookassa'}
              onClick={() => setProvider('yookassa')}
              icon={<CreditCard size={18} className="text-blue-500" />}
              label={t('checkout.card')}
              description="YooKassa"
            />
            <ProviderButton
              selected={provider === 'cryptopay'}
              onClick={() => setProvider('cryptopay')}
              icon={<Bitcoin size={18} className="text-orange-500" />}
              label={t('checkout.crypto')}
              description="CryptoPay"
            />
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle size={14} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={!provider || !tariff || loading}
          loading={loading}
          onClick={handlePay}
        >
          {t('checkout.pay')}
          {tariff ? ` ${amountRub.toLocaleString('ru-RU')} ₽` : ''}
        </Button>
      </div>
    </AppLayout>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────

function checkoutScenarioI18nKey(scenario: string | undefined): string {
  const map: Record<string, string> = {
    new: 'checkout.scenarioNew',
    renew: 'checkout.scenarioRenew',
    upgrade: 'checkout.scenarioUpgrade',
    downgrade: 'checkout.scenarioDowngrade',
    classic_new: 'checkout.scenarioClassicNew',
    classic_renew: 'checkout.scenarioClassicRenew',
    unknown: 'checkout.scenarioUnknown',
  }
  if (!scenario) return 'checkout.scenarioUnknown'
  return map[scenario] ?? 'checkout.scenarioUnknown'
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

function ProviderButton({
  selected,
  onClick,
  icon,
  label,
  description,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/40 hover:bg-secondary/50',
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {selected && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check size={12} className="text-white" />
        </div>
      )}
    </button>
  )
}

function pluralizeMonths(n: number): string {
  if (n === 1) return '1 месяц'
  if (n >= 2 && n <= 4) return `${n} месяца`
  return `${n} месяцев`
}
