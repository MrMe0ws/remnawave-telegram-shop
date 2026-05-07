import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronDown, ChevronRight, Cpu, CreditCard, Bitcoin, Star, X } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api, ApiError, type HwidExtraPreviewResponse, type SubscriptionHwidExtraInfo } from '@/lib/api'
import { newIdempotencyKey } from '@/lib/utils'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

type Panel = 'menu' | 'buy' | 'decrease'
type Provider = 'yookassa' | 'cryptopay' | 'telegram'

type Props = {
  hwid: SubscriptionHwidExtraInfo
  inactive: boolean
  onUpdated: () => void
}

function hwidPreviewDiscountCaption(
  t: (key: string, opts?: Record<string, string | number>) => string,
  preview: HwidExtraPreviewResponse,
  hasCut: boolean,
): string | null {
  if (!hasCut) return null
  const loy = preview.loyalty_discount_pct ?? 0
  const pro = preview.promo_discount_pct ?? 0
  const parts: string[] = []
  if (loy > 0) parts.push(t('subscriptionPage.extraDevicesPayDiscountLoyalty', { pct: loy }))
  if (pro > 0) parts.push(t('subscriptionPage.extraDevicesPayDiscountPromo', { pct: pro }))
  if (parts.length > 0) {
    return `${t('subscriptionPage.extraDevicesPayDiscountPrefix')} ${parts.join(' / ')}`
  }
  const totalPct = preview.total_discount_pct ?? 0
  if (totalPct > 0) {
    return t('subscriptionPage.extraDevicesPayDiscountCombined', { pct: totalPct })
  }
  return null
}

export function SubscriptionExtraDevices({ hwid, inactive, onUpdated }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: bootstrap } = useAuthBootstrap()
  const [panel, setPanel] = useState<Panel>('menu')
  const [buyTarget, setBuyTarget] = useState(() =>
    hwid.can_increase ? Math.min(hwid.current_limit + 1, hwid.max_limit) : hwid.current_limit,
  )
  const [decTarget, setDecTarget] = useState(() =>
    hwid.can_decrease ? hwid.current_limit - 1 : hwid.base_limit,
  )
  const [provider, setProvider] = useState<Provider>('yookassa')
  const [payError, setPayError] = useState<string | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [decreaseModalOpen, setDecreaseModalOpen] = useState(false)

  const providerEnabled = {
    yookassa: bootstrap?.payment_providers?.yookassa ?? true,
    cryptopay: bootstrap?.payment_providers?.cryptopay ?? true,
    telegram: bootstrap?.payment_providers?.telegram ?? true,
  }

  const buyOptions = useMemo(() => {
    const out: number[] = []
    if (!hwid.can_increase || hwid.max_limit <= 0) return out
    for (let n = hwid.current_limit + 1; n <= hwid.max_limit; n++) out.push(n)
    return out
  }, [hwid])

  const decOptions = useMemo(() => {
    const out: number[] = []
    if (!hwid.can_decrease) return out
    for (let n = hwid.base_limit; n < hwid.current_limit; n++) out.push(n)
    return out
  }, [hwid])

  const { data: preview, isFetching, isPending } = useQuery({
    queryKey: ['hwidExtraPreview', buyTarget, provider],
    queryFn: () => api.hwidExtraPreview(buyTarget, provider),
    enabled: panel === 'buy' && buyTarget > hwid.current_limit && buyOptions.length > 0,
    staleTime: 20_000,
  })

  const applyDec = useMutation({
    mutationFn: (target: number) => api.hwidExtraApply(target),
    onSuccess: () => {
      setDecreaseModalOpen(false)
      onUpdated()
      setPanel('menu')
    },
    onError: () => {
      setDecreaseModalOpen(false)
    },
  })

  const closeSubpanel = () => {
    setPayError(null)
    setDecreaseModalOpen(false)
    setPanel('menu')
  }

  if (!hwid.ui_visible || !hwid.enabled) return null

  const limitLine = t('subscriptionPage.extraDevicesCurrentLimit', { n: hwid.current_limit })

  const previewUnit =
    preview?.currency === 'STARS' ? t('checkout.stars') : t('checkout.rub')

  return (
    <Card className={inactive ? 'opacity-60 saturate-50 pointer-events-none' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium text-muted-foreground flex min-w-0 flex-1 items-center gap-2">
            <Cpu size={14} className="shrink-0" />
            <span className="leading-snug">{t('subscriptionPage.extraDevicesTitle')}</span>
          </CardTitle>
          {panel !== 'menu' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              aria-label={t('common.close')}
              onClick={closeSubpanel}
            >
              <X size={18} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {inactive && (
          <p className="text-sm text-muted-foreground">{t('subscriptionPage.unavailableWhileInactive')}</p>
        )}

        {!inactive && panel === 'menu' && (
          <div className="space-y-2.5">
            {hwid.can_increase && (
              <button
                type="button"
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-muted/35 px-4 py-3 text-left text-card-foreground transition-colors hover:bg-muted/55"
                onClick={() => {
                  setBuyTarget(buyOptions[0] ?? hwid.current_limit + 1)
                  setPanel('buy')
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t('subscriptionPage.extraDevicesBuyTitle')}</p>
                  <p className="text-xs text-muted-foreground">{limitLine}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            {hwid.can_decrease && (
              <button
                type="button"
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-muted/35 px-4 py-3 text-left text-card-foreground transition-colors hover:bg-muted/55"
                onClick={() => {
                  const last = decOptions[decOptions.length - 1] ?? hwid.base_limit
                  setDecTarget(last)
                  setPanel('decrease')
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t('subscriptionPage.extraDevicesDecreaseTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('subscriptionPage.extraDevicesDecreaseHint')}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            {!hwid.can_increase && !hwid.can_decrease && (
              <p className="text-sm text-muted-foreground">{t('subscriptionPage.extraDevicesNoActions')}</p>
            )}
          </div>
        )}

        {!inactive && panel === 'buy' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('subscriptionPage.extraDevicesNewLimit')}</label>
              <div className="relative mt-1.5">
                <select
                  className="w-full cursor-pointer appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm"
                  value={buyTarget}
                  onChange={(e) => setBuyTarget(parseInt(e.target.value, 10))}
                >
                  {buyOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('checkout.chooseProvider')}</p>
              <div className="flex flex-wrap gap-2">
                {providerEnabled.yookassa && (
                  <Button
                    type="button"
                    size="sm"
                    variant={provider === 'yookassa' ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => setProvider('yookassa')}
                  >
                    <CreditCard size={14} />
                    {t('checkout.card')}
                  </Button>
                )}
                {providerEnabled.cryptopay && (
                  <Button
                    type="button"
                    size="sm"
                    variant={provider === 'cryptopay' ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => setProvider('cryptopay')}
                  >
                    <Bitcoin size={14} />
                    {t('checkout.crypto')}
                  </Button>
                )}
                {providerEnabled.telegram && (
                  <Button
                    type="button"
                    size="sm"
                    variant={provider === 'telegram' ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => setProvider('telegram')}
                  >
                    <Star size={14} />
                    {t('checkout.telegramStars')}
                  </Button>
                )}
              </div>
            </div>
            {(isPending || (isFetching && !preview)) && (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            )}
            {preview && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-sm leading-snug">
                <p className="font-medium">
                  {t('subscriptionPage.extraDevicesPaySummary', {
                    count: preview.delta,
                    from: preview.current_limit,
                    to: preview.target_limit,
                    max: hwid.max_limit,
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t('subscriptionPage.extraDevicesPayPeriod', {
                    count: preview.days_left,
                    amount: preview.base_amount_rub,
                    unit: previewUnit,
                  })}
                </p>
                {(() => {
                  const hasCut = preview.base_amount_rub > preview.amount_rub
                  const disc = hwidPreviewDiscountCaption(t, preview, hasCut)
                  return (
                    <>
                      {disc != null && <p className="text-muted-foreground">{disc}</p>}
                      {hasCut && (
                        <p className="text-muted-foreground">
                          {t('subscriptionPage.extraDevicesPaySubtotal', {
                            base: preview.base_amount_rub,
                            unit: previewUnit,
                          })}
                        </p>
                      )}
                    </>
                  )
                })()}
                <p className="pt-0.5 font-semibold">
                  {t('subscriptionPage.extraDevicesPayToPay', {
                    total: preview.amount_rub,
                    unit: previewUnit,
                  })}
                </p>
              </div>
            )}
            {payError && <p className="text-sm text-destructive">{payError}</p>}
            <Button
              type="button"
              className="w-full"
              disabled={payLoading || !preview || buyTarget <= hwid.current_limit}
              onClick={async () => {
                setPayError(null)
                setPayLoading(true)
                try {
                  const idem = newIdempotencyKey()
                  const res = await api.hwidExtraCheckout(buyTarget, provider, idem)
                  window.open(res.payment_url, '_blank', 'noopener,noreferrer')
                  navigate(`/payment/status/${res.checkout_id}`)
                } catch (err) {
                  if (err instanceof ApiError) {
                    setPayError(err.status === 429 ? t('errors.tooManyRequests') : t('checkout.notAvailable'))
                  } else {
                    setPayError(t('errors.unknown'))
                  }
                } finally {
                  setPayLoading(false)
                }
              }}
            >
              {t('checkout.pay')}
            </Button>
          </div>
        )}

        {!inactive && panel === 'decrease' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('subscriptionPage.extraDevicesNewLimit')}</label>
              <div className="relative mt-1.5">
                <select
                  className="w-full cursor-pointer appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm"
                  value={decTarget}
                  onChange={(e) => setDecTarget(parseInt(e.target.value, 10))}
                >
                  {decOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('subscriptionPage.extraDevicesDecreaseNote')}</p>
            {applyDec.isError && <p className="text-sm text-destructive">{t('errors.unknown')}</p>}
            <Button
              type="button"
              className="w-full"
              variant="secondary"
              disabled={applyDec.isPending || decTarget >= hwid.current_limit || decTarget < hwid.base_limit}
              onClick={() => setDecreaseModalOpen(true)}
            >
              {t('subscriptionPage.extraDevicesConfirmDecrease')}
            </Button>
          </div>
        )}
      </CardContent>

      {decreaseModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="presentation"
              className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => !applyDec.isPending && setDecreaseModalOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="hwid-decrease-warning-title"
                className="w-full max-w-md rounded-2xl border border-border bg-background/95 p-5 shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed text-foreground">
                    <h2 id="hwid-decrease-warning-title" className="text-base font-semibold">
                      {t('subscriptionPage.extraDevicesDecreaseModalTitle')}
                    </h2>
                    <p>{t('subscriptionPage.extraDevicesDecreaseModalIntro')}</p>
                    <p className="text-muted-foreground">{t('subscriptionPage.extraDevicesDecreaseModalNoRefund')}</p>
                    <p className="text-muted-foreground">{t('subscriptionPage.extraDevicesDecreaseModalIrreversible')}</p>
                    <p>{t('subscriptionPage.extraDevicesDecreaseModalEnsure')}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={applyDec.isPending}
                    onClick={() => setDecreaseModalOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full sm:w-auto"
                    loading={applyDec.isPending}
                    disabled={applyDec.isPending || decTarget >= hwid.current_limit || decTarget < hwid.base_limit}
                    onClick={() => applyDec.mutate(decTarget)}
                  >
                    {t('subscriptionPage.extraDevicesDecreaseModalConfirm')}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </Card>
  )
}
