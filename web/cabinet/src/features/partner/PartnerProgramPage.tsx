import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Clock, FileText, RefreshCw, XCircle } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { PageReveal, RevealItem } from '@/components/PageReveal'
import { PageTitleWithBack } from '@/components/PageTitleWithBack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api, type PartnerStateResponse } from '@/lib/api'

import { PartnerDashboard } from './PartnerDashboard'
import { PartnerApplyModal } from './PartnerApplyModal'
import { PartnerOfferCalculator } from './PartnerOfferCalculator'
import { PartnerOfferFlow } from './PartnerOfferFlow'
import { PartnerOfferPreview } from './PartnerOfferPreview'
import { PARTNER_STATE_KEY } from './partnerKeys'

export default function PartnerProgramPage() {
  const { t } = useTranslation()

  const { data, isLoading, error } = useQuery({
    queryKey: PARTNER_STATE_KEY,
    queryFn: () => api.partnerState(),
    staleTime: 30_000,
    retry: 1,
  })

  /*
   * Оффер шире остальных состояний.
   *
   * Кабинет живёт в колонке max-w-2xl, и для таблиц и форм это правильно:
   * длинная строка читается хуже короткой. Но продающий экран в той же
   * колонке на десктопе выглядит вытянутым мобильным — калькулятору и схеме
   * потока нужна ширина, чтобы встать в две колонки, а не в стопку.
   * Поэтому широкая раскладка только у лендинга; дашборд и заявка на
   * рассмотрении остаются узкими.
   */
  const wide = Boolean(data?.enabled && !data.partner && data.status !== 'pending')

  return (
    <AppLayout>
      <PageReveal className={cn('mx-auto w-full space-y-6', wide ? 'max-w-5xl' : 'max-w-2xl')}>
        <RevealItem>
          <PageTitleWithBack title={t('partnerPage.title')} />
        </RevealItem>

        {isLoading ? <PartnerSkeleton /> : null}

        {error ? (
          <RevealItem>
            <Alert variant="destructive">
              <AlertDescription>{t('partnerPage.loadError')}</AlertDescription>
            </Alert>
          </RevealItem>
        ) : null}

        {data && !data.enabled ? (
          <RevealItem>
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                {t('partnerPage.disabled')}
              </CardContent>
            </Card>
          </RevealItem>
        ) : null}

        {data && data.enabled ? <PartnerBody state={data} /> : null}
      </PageReveal>
    </AppLayout>
  )
}

function PartnerBody({ state }: { state: PartnerStateResponse }) {
  // Кабинет с деньгами открыт и замороженному партнёру: начисления ему идут,
  // блокируется только вывод, и прятать от него баланс было бы обманом.
  if (state.partner && (state.status === 'active' || state.status === 'suspended')) {
    return <PartnerDashboard state={state} partner={state.partner} />
  }
  if (state.status === 'pending') {
    return <PartnerPending state={state} />
  }
  return <PartnerLanding state={state} />
}

/**
 * Оффер — для тех, кто ещё не партнёр либо получил отказ.
 *
 * Порядок блоков отвечает на вопросы в том порядке, в каком они возникают:
 * сколько я заработаю (калькулятор) → как это устроено (поток) → что я получу
 * в работу (кабинет). Форма заявки уехала в модалку: она нужна тому, кто уже
 * решил, а на странице только мешала — человек видел её раньше, чем успевал
 * понять условия.
 */
function PartnerLanding({ state }: { state: PartnerStateResponse }) {
  const { t } = useTranslation()
  const [applyOpen, setApplyOpen] = useState(false)
  const rejected = state.status === 'rejected'
  const canApply = state.applications_enabled

  return (
    <>
      {/* Отказ показывается первым: это ответ на заявку, а не сноска под
          рекламным блоком. */}
      {rejected ? (
        <RevealItem>
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="min-w-0 space-y-1.5">
                  <p className="font-semibold text-destructive">{t('partnerPage.rejectedTitle')}</p>
                  {state.application?.admin_note ? (
                    <p className="text-sm text-foreground">{state.application.admin_note}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('partnerPage.rejectedNoComment')}</p>
                  )}
                  {canApply ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2 gap-1.5"
                      onClick={() => setApplyOpen(true)}
                    >
                      <RefreshCw size={14} />
                      {t('partnerPage.form.titleAgain')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </RevealItem>
      ) : null}

      <RevealItem>
        <PartnerOfferCalculator
          terms={state.terms}
          canApply={canApply}
          onApply={() => setApplyOpen(true)}
        />
      </RevealItem>

      <RevealItem>
        <PartnerOfferFlow terms={state.terms} />
      </RevealItem>

      <RevealItem>
        <PartnerOfferPreview
          terms={state.terms}
          canApply={canApply}
          onApply={() => setApplyOpen(true)}
        />
      </RevealItem>

      {!canApply ? (
        <RevealItem>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              {t('partnerPage.applicationsClosed')}
            </CardContent>
          </Card>
        </RevealItem>
      ) : null}

      <PartnerApplyModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        application={rejected ? state.application : undefined}
      />
    </>
  )
}

/** Заявка на рассмотрении. */
function PartnerPending({ state }: { state: PartnerStateResponse }) {
  const { t } = useTranslation()
  return (
    <>
      <RevealItem>
        <Card className="border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Clock size={30} className="text-primary" />
            <h2 className="text-xl font-semibold">{t('partnerPage.pending.title')}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">{t('partnerPage.pending.subtitle')}</p>
            <Badge variant="secondary">{t('partnerPage.status.pending')}</Badge>
          </CardContent>
        </Card>
      </RevealItem>

      {state.application ? (
        <RevealItem>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <FileText size={18} className="text-muted-foreground" />
                {t('partnerPage.pending.submitted')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                <ApplicationRow label={t('partnerPage.form.about')} value={state.application.about} />
                <ApplicationRow label={t('partnerPage.form.channels')} value={state.application.channels} />
                <ApplicationRow label={t('partnerPage.form.expected')} value={state.application.expected} />
              </dl>
            </CardContent>
          </Card>
        </RevealItem>
      ) : null}
    </>
  )
}

function ApplicationRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right">{value}</dd>
    </div>
  )
}

function PartnerSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 pt-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
