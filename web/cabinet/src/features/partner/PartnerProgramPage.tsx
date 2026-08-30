import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Clock, FileText, ListChecks, XCircle, PenLine, Megaphone, Users, RefreshCw } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { PageReveal, RevealItem } from '@/components/PageReveal'
import { PageTitleWithBack } from '@/components/PageTitleWithBack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { PARTNER_SURFACE } from './surface'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type PartnerStateResponse } from '@/lib/api'

import { PartnerDashboard } from './PartnerDashboard'
import { formatMoney, formatPercent } from './format'

export const PARTNER_STATE_KEY = ['partner-state']

export default function PartnerProgramPage() {
  const { t } = useTranslation()

  const { data, isLoading, error } = useQuery({
    queryKey: PARTNER_STATE_KEY,
    queryFn: () => api.partnerState(),
    staleTime: 30_000,
    retry: 1,
  })

  return (
    <AppLayout>
      <PageReveal className="mx-auto w-full max-w-2xl space-y-6">
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

/** Оффер и форма заявки — для тех, кто ещё не партнёр либо получил отказ. */
function PartnerLanding({ state }: { state: PartnerStateResponse }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const rejected = state.status === 'rejected'

  const [about, setAbout] = useState(state.application?.about ?? '')
  const [channels, setChannels] = useState(state.application?.channels ?? '')
  const [expected, setExpected] = useState(state.application?.expected ?? '')
  const [error, setError] = useState<string | null>(null)
  // После отказа форма прячется за кнопкой: отказ — это ответ, который надо
  // прочитать, а не поле для новой попытки, подсунутое сразу под ним.
  const [formOpen, setFormOpen] = useState(!rejected)

  const apply = useMutation({
    mutationFn: () => api.partnerApply({ about: about.trim(), channels: channels.trim(), expected: expected.trim() }),
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: PARTNER_STATE_KEY })
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const raw = e.body || ''
        if (raw.includes('already_partner')) return setError(t('partnerPage.errors.alreadyPartner'))
        if (raw.includes('already_pending')) return setError(t('partnerPage.errors.alreadyPending'))
        if (raw.includes('about_required')) return setError(t('partnerPage.errors.aboutRequired'))
        if (raw.includes('too_long')) return setError(t('partnerPage.errors.tooLong'))
      }
      setError(t('partnerPage.errors.generic'))
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!about.trim()) {
      setError(t('partnerPage.errors.aboutRequired'))
      return
    }
    setError(null)
    apply.mutate()
  }

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
                  {state.applications_enabled && !formOpen ? (
                    <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setFormOpen(true)}>
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
        <Card className="border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold">{t('partnerPage.landing.title')}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t('partnerPage.landing.subtitle')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TermTile label={t('partnerPage.landing.firstPayment')} value={formatPercent(state.terms.first_percent)} />
              <TermTile label={t('partnerPage.landing.renewals')} value={formatPercent(state.terms.renewal_percent)} />
            </div>
          </CardContent>
        </Card>
      </RevealItem>

      <RevealItem>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <ListChecks size={18} className="text-primary" />
              {t('partnerPage.landing.howTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Нумерованные шаги: порядок здесь настоящий — ссылка, оплата,
                холд, вывод, — поэтому номера несут смысл, а не украшают. */}
            <ol className="space-y-3">
              <Step n={1} text={t('partnerPage.landing.step1')} />
              <Step n={2} text={t('partnerPage.landing.step2')} />
              <Step n={3} text={t('partnerPage.landing.step3', { days: state.terms.hold_days })} />
              <Step n={4} text={t('partnerPage.landing.step4', { min: formatMoney(state.terms.min_payout) })} />
            </ol>
          </CardContent>
        </Card>
      </RevealItem>

      {state.applications_enabled && formOpen ? (
        <RevealItem>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <FileText size={18} className="text-primary" />
                {rejected ? t('partnerPage.form.titleAgain') : t('partnerPage.form.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={onSubmit}>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="partner-about" icon={<PenLine size={14} />}>
                    {t('partnerPage.form.about')}
                  </FieldLabel>
                  <textarea
                    id="partner-about"
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder={t('partnerPage.form.aboutPlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="partner-channels" icon={<Megaphone size={14} />}>
                    {t('partnerPage.form.channels')}
                  </FieldLabel>
                  <Input
                    id="partner-channels"
                    value={channels}
                    onChange={(e) => setChannels(e.target.value)}
                    maxLength={1000}
                    placeholder={t('partnerPage.form.channelsPlaceholder')}
                    className="bg-secondary"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="partner-expected" icon={<Users size={14} />}>
                    {t('partnerPage.form.expected')}
                  </FieldLabel>
                  <Input
                    id="partner-expected"
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    maxLength={200}
                    placeholder={t('partnerPage.form.expectedPlaceholder')}
                    className="bg-secondary"
                  />
                </div>

                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <p className="text-xs text-muted-foreground">{t('partnerPage.form.note')}</p>
                <Button type="submit" className="w-full" disabled={apply.isPending}>
                  {apply.isPending ? t('partnerPage.form.submitting') : t('partnerPage.form.submit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </RevealItem>
      ) : null}

      {!state.applications_enabled ? (
        <RevealItem>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              {t('partnerPage.applicationsClosed')}
            </CardContent>
          </Card>
        </RevealItem>
      ) : null}
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
              <dl className={cn('divide-y divide-border rounded-lg text-sm', PARTNER_SURFACE)}>
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

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
        {n}
      </span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </li>
  )
}

/**
 * Подпись поля с иконкой.
 *
 * Иконки намеренно приглушённые и мельче заголовочной: заголовок карточки
 * задаёт раздел, а эти лишь помогают взглядом находить нужное поле. Одного
 * размера и цвета с заголовком они бы с ним конкурировали.
 */
function FieldLabel({ htmlFor, icon, children }: { htmlFor: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </Label>
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

function TermTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
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
