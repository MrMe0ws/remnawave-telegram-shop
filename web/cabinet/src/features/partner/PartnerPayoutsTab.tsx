import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CreditCard, History } from 'lucide-react'

import { RevealItem } from '@/components/PageReveal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type PartnerAccountDTO } from '@/lib/api'

import { PARTNER_STATE_KEY } from './PartnerProgramPage'
import { formatMoney, formatDayMonth, formatDayShort } from './format'

/**
 * Тело отказа приходит JSON'ом со слагом ошибки и подробностями: минимальной
 * суммой либо датой окончания кулдауна. Разбираем, чтобы партнёр увидел
 * конкретное число, а не «попробуйте позже».
 */
function parseErrorBody(body: string): { error?: string; minimum?: number; available_at?: string } {
  try {
    return JSON.parse(body || '{}')
  } catch {
    return {}
  }
}

export function PartnerPayoutsTab({ partner }: { partner: PartnerAccountDTO }) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const [method, setMethod] = useState(partner.payout_method ?? '')
  const [details, setDetails] = useState(partner.payout_details ?? '')
  const [amount, setAmount] = useState(String(Math.floor(partner.balance)))
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [payoutError, setPayoutError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const { data: payouts, isLoading } = useQuery({
    queryKey: ['partner-payouts'],
    queryFn: () => api.partnerPayouts(),
    staleTime: 30_000,
  })

  const saveDetails = useMutation({
    mutationFn: () => api.partnerSavePayoutDetails(method.trim(), details.trim()),
    onSuccess: async () => {
      setDetailsError(null)
      setSaved(true)
      await qc.invalidateQueries({ queryKey: PARTNER_STATE_KEY })
    },
    onError: (e) => {
      setSaved(false)
      if (e instanceof ApiError && (e.body || '').includes('invalid_details')) {
        setDetailsError(t('partnerPage.payouts.errors.invalidDetails'))
        return
      }
      setDetailsError(t('partnerPage.errors.generic'))
    },
  })

  const requestPayout = useMutation({
    mutationFn: () => api.partnerRequestPayout(Number(amount.replace(',', '.'))),
    onSuccess: async () => {
      setPayoutError(null)
      await qc.invalidateQueries({ queryKey: PARTNER_STATE_KEY })
      await qc.invalidateQueries({ queryKey: ['partner-payouts'] })
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const payload = parseErrorBody(e.body)
        switch (payload.error) {
          case 'details_required':
            return setPayoutError(t('partnerPage.payouts.errors.detailsRequired'))
          case 'below_minimum':
            return setPayoutError(
              t('partnerPage.payouts.errors.belowMinimum', { min: formatMoney(payload.minimum ?? 0) }),
            )
          case 'insufficient_balance':
            return setPayoutError(t('partnerPage.payouts.errors.insufficient'))
          case 'payout_pending':
            return setPayoutError(t('partnerPage.payouts.errors.pending'))
          case 'cooldown':
            return setPayoutError(
              t('partnerPage.payouts.errors.cooldown', { date: formatDayMonth(payload.available_at) }),
            )
          case 'withdraw_blocked':
            return setPayoutError(t('partnerPage.payouts.errors.blocked'))
          case 'invalid_amount':
            return setPayoutError(t('partnerPage.payouts.errors.invalidAmount'))
        }
      }
      setPayoutError(t('partnerPage.errors.generic'))
    },
  })

  const hasDetails = Boolean(partner.payout_details)
  const cooldownActive = Boolean(partner.payout_available_at)
  const canRequest =
    partner.can_withdraw && hasDetails && !partner.has_open_payout && !cooldownActive && partner.balance > 0

  function onSaveDetails(e: FormEvent) {
    e.preventDefault()
    if (!method.trim() || !details.trim()) {
      setDetailsError(t('partnerPage.payouts.errors.invalidDetails'))
      return
    }
    setDetailsError(null)
    saveDetails.mutate()
  }

  function onRequest(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      setPayoutError(t('partnerPage.payouts.errors.invalidAmount'))
      return
    }
    setPayoutError(null)
    requestPayout.mutate()
  }

  return (
    <>
      <RevealItem>
        <Card className="border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('partnerPage.overview.available')}
            </p>
            <p className="mt-1 text-3xl font-semibold text-primary">{formatMoney(partner.balance)}</p>

            <form className="mt-4 space-y-3" onSubmit={onRequest}>
              <div className="space-y-1.5">
                <Label htmlFor="payout-amount">{t('partnerPage.payouts.amount')}</Label>
                <Input
                  id="payout-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={!canRequest}
                />
              </div>

              {payoutError ? (
                <Alert variant="destructive">
                  <AlertDescription>{payoutError}</AlertDescription>
                </Alert>
              ) : null}

              {/* Причина, по которой кнопка недоступна, показывается рядом с ней,
                  а не всплывает ошибкой после отправки формы. */}
              {partner.has_open_payout ? (
                <Alert>
                  <AlertDescription>{t('partnerPage.payouts.pendingNotice')}</AlertDescription>
                </Alert>
              ) : null}
              {cooldownActive ? (
                <Alert>
                  <AlertDescription>
                    {t('partnerPage.payouts.cooldownNotice', {
                      date: formatDayMonth(partner.payout_available_at),
                    })}
                  </AlertDescription>
                </Alert>
              ) : null}
              {!hasDetails ? (
                <Alert>
                  <AlertDescription>{t('partnerPage.payouts.detailsFirst')}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" disabled={!canRequest || requestPayout.isPending}>
                {requestPayout.isPending ? t('partnerPage.payouts.sending') : t('partnerPage.payouts.request')}
              </Button>
              <p className="text-center text-xs text-muted-foreground">{t('partnerPage.payouts.manualNotice')}</p>
            </form>
          </CardContent>
        </Card>
      </RevealItem>

      <RevealItem>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <CreditCard size={18} className="text-primary" />
              {t('partnerPage.payouts.detailsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSaveDetails}>
              <div className="space-y-1.5">
                <Label htmlFor="payout-method">{t('partnerPage.payouts.method')}</Label>
                <Input
                  id="payout-method"
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value)
                    setSaved(false)
                  }}
                  maxLength={64}
                  placeholder={t('partnerPage.payouts.methodPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payout-details">{t('partnerPage.payouts.details')}</Label>
                <Input
                  id="payout-details"
                  value={details}
                  onChange={(e) => {
                    setDetails(e.target.value)
                    setSaved(false)
                  }}
                  maxLength={512}
                  placeholder={t('partnerPage.payouts.detailsPlaceholder')}
                />
              </div>

              {detailsError ? (
                <Alert variant="destructive">
                  <AlertDescription>{detailsError}</AlertDescription>
                </Alert>
              ) : null}
              {saved ? (
                <Alert>
                  <AlertDescription>{t('partnerPage.payouts.detailsSaved')}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" variant="outline" className="w-full" disabled={saveDetails.isPending}>
                {t('partnerPage.payouts.saveDetails')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </RevealItem>

      <RevealItem>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <History size={18} className="text-muted-foreground" />
              {t('partnerPage.payouts.historyTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : null}

            {payouts && payouts.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('partnerPage.payouts.empty')}</p>
            ) : null}

            {payouts && payouts.items.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {payouts.items.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold tabular-nums">{formatMoney(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {[formatDayShort(p.requested_at), p.method].filter(Boolean).join(' · ')}
                      </p>
                      {p.admin_comment ? (
                        <p className="text-xs text-muted-foreground">{p.admin_comment}</p>
                      ) : null}
                    </div>
                    <PayoutStatus status={p.status} />
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </RevealItem>
    </>
  )
}

function PayoutStatus({ status }: { status: string }) {
  const { t } = useTranslation()
  if (status === 'paid') return <Badge className="shrink-0">{t('partnerPage.payouts.statusPaid')}</Badge>
  if (status === 'rejected')
    return (
      <Badge variant="destructive" className="shrink-0">
        {t('partnerPage.payouts.statusRejected')}
      </Badge>
    )
  if (status === 'approved')
    return (
      <Badge variant="secondary" className="shrink-0">
        {t('partnerPage.payouts.statusApproved')}
      </Badge>
    )
  return (
    <Badge variant="secondary" className="shrink-0">
      {t('partnerPage.payouts.statusPending')}
    </Badge>
  )
}
