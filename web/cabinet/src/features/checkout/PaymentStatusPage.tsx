import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Copy, Check } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

export default function PaymentStatusPage() {
  const { t } = useTranslation()
  const { id: idParam } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const [copied, setCopied] = useState(false)

  // Поддерживаем /payment/status/:id и /payment/status?id=…
  const rawId = idParam ?? searchParams.get('id') ?? ''
  const paymentId = parseInt(rawId, 10)

  const { data, isLoading, error } = useQuery({
    queryKey: ['payment-status', paymentId],
    queryFn: () => api.paymentStatus(paymentId),
    enabled: !isNaN(paymentId) && paymentId > 0,
    // Polling: каждые 3 секунды пока платёж не финализирован.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'paid' || status === 'failed' || status === 'expired') return false
      return 3000
    },
    staleTime: 0,
    retry: 2,
  })

  const status = data?.status

  async function copyLink() {
    if (!data?.subscription_link) return
    await navigator.clipboard.writeText(data.subscription_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AppLayout>
      <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <h1 className="text-xl font-semibold">{t('paymentStatus.title')}</h1>

        <Card className="w-full">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5 text-center">
            {isLoading || status === 'new' || status === 'pending' ? (
              <PendingState />
            ) : status === 'paid' ? (
              <SuccessState
                link={data?.subscription_link ?? null}
                copied={copied}
                onCopy={copyLink}
              />
            ) : (
              <FailedState expired={status === 'expired'} />
            )}

            {error && (
              <p className="text-xs text-destructive">{t('errors.unknown')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

// ── States ─────────────────────────────────────────────────────────────────

function PendingState() {
  const { t } = useTranslation()
  return (
    <>
      <div className="relative flex items-center justify-center">
        <div className="h-16 w-16 rounded-full border-4 border-border border-t-primary animate-spin" />
        <div className="absolute h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
        </div>
      </div>
      <div>
        <p className="font-medium">{t('paymentStatus.pending')}</p>
        <p className="text-sm text-muted-foreground mt-1">{t('paymentStatus.pendingHint')}</p>
      </div>
    </>
  )
}

function SuccessState({
  link,
  copied,
  onCopy,
}: {
  link: string | null
  copied: boolean
  onCopy: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
        <CheckCircle2 size={36} className="text-emerald-500" strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-semibold text-lg">{t('paymentStatus.success')}</p>
        <p className="text-sm text-muted-foreground mt-1">{t('paymentStatus.successHint')}</p>
      </div>

      {link && (
        <div className="w-full space-y-2">
          <p className="text-xs text-muted-foreground text-left">{t('paymentStatus.linkLabel')}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono text-muted-foreground truncate select-all">
              {link}
            </div>
            <Button variant="outline" size="sm" onClick={onCopy} className="shrink-0 gap-1">
              {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
            </Button>
          </div>
        </div>
      )}

      <Button asChild className="w-full">
        <Link to="/subscription">{t('paymentStatus.toSubscription')}</Link>
      </Button>
    </>
  )
}

function FailedState({ expired }: { expired: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="h-16 w-16 rounded-full bg-destructive/15 flex items-center justify-center">
        <XCircle size={36} className="text-destructive" strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-semibold text-lg">
          {expired ? t('paymentStatus.expired') : t('paymentStatus.failed')}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {expired ? t('paymentStatus.failedHint') : t('paymentStatus.failedHint')}
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <Button asChild variant="outline">
          <Link to="/tariffs">{t('paymentStatus.retry')}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/subscription">{t('paymentStatus.toSubscription')}</Link>
        </Button>
      </div>
    </>
  )
}
