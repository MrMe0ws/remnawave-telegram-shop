import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api, ApiError, type MergePreviewResponse, type MergeCustomerSnapshot } from '@/lib/api'
import { newIdempotencyKey, formatDate } from '@/lib/utils'
import { useTranslationWithLang } from '@/hooks/useTranslationWithLang'
import { useAuthStore } from '@/store/auth'

export default function MergePreviewPage() {
  const { t } = useTranslation()
  const { lang } = useTranslationWithLang()
  const qc = useQueryClient()
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const accessToken = useAuthStore((s) => s.accessToken)
  const [merging, setMerging] = useState(false)
  const [force, setForce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const { data: meFresh } = useQuery({
    queryKey: ['me-merge-fresh', accessToken],
    queryFn: () => api.me(),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: preview, isLoading, error: loadErr } = useQuery({
    queryKey: ['merge-preview'],
    queryFn: () => api.mergePreview(),
    retry: false,
  })

  async function handleConfirm() {
    setError(null)
    setMerging(true)
    const key = newIdempotencyKey()
    try {
      await api.mergeConfirm(key, force)
      setDone(true)
      await fetchMe()
      await qc.invalidateQueries({ queryKey: ['merge-preview'] })
      await qc.invalidateQueries({ queryKey: ['subscription'] })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setForce(true)
        setError(t('merge.dangerous'))
      } else if (e instanceof ApiError && e.status === 202) {
        setDone(true)
      } else {
        setError(t('errors.unknown'))
      }
    } finally {
      setMerging(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t('merge.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('merge.subtitle')}</p>
        </div>

        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/accounts">{t('merge.back')}</Link>
        </Button>

        {isLoading && <p className="text-sm text-muted-foreground">{t('merge.loading')}</p>}

        {loadErr && (
          <Alert variant="destructive">
            <AlertDescription>{t('errors.unknown')}</AlertDescription>
          </Alert>
        )}

        {preview && (
          <PreviewCard
            preview={preview}
            lang={lang}
            currentMethod={formatCurrentAccountMethods(meFresh?.providers, t)}
          />
        )}

        {preview?.is_noop && (
          <Alert>
            <AlertDescription>{t('merge.noop')}</AlertDescription>
          </Alert>
        )}

        {(preview?.is_dangerous || force) && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4 shrink-0" />
            <AlertDescription>
              {t('merge.dangerous')}
              {preview?.danger_reason && (
                <span className="block text-xs mt-1 opacity-90">{t('merge.dangerReason')}: {preview.danger_reason}</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {done && (
          <Alert variant="success">
            <AlertDescription>{t('merge.success')}</AlertDescription>
          </Alert>
        )}

        {preview && !preview.is_noop && !done && (
          <Button className="w-full" size="lg" loading={merging} onClick={handleConfirm}>
            {force ? t('merge.confirmForce') : t('merge.confirm')}
          </Button>
        )}

        {done && (
          <Button asChild className="w-full" variant="outline">
            <Link to="/dashboard">{t('paymentStatus.toDashboard')}</Link>
          </Button>
        )}
      </div>
    </AppLayout>
  )
}

function PreviewCard({
  preview,
  lang,
  currentMethod,
}: {
  preview: MergePreviewResponse
  lang: string
  currentMethod: string
}) {
  const { t } = useTranslation()
  const mergedDays = useMemo(() => daysFromNow(preview.merged_expire_at ?? null), [preview.merged_expire_at])

  return (
    <div className="space-y-4">
      {preview.customer_web && (
        <SnapshotBlock
          label={t('merge.currentAccount')}
          method={currentMethod}
          s={preview.customer_web}
          lang={lang}
        />
      )}
      {preview.customer_tg && (
        <SnapshotBlock
          label={t('merge.foundAccount')}
          method={t('merge.methodTelegram')}
          s={preview.customer_tg}
          lang={lang}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('merge.afterMerge')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            <span>{t('merge.resultMethods')}</span>
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            <span>
              {t('merge.resultDays')}: <span className="text-foreground">{formatDaysLabel(mergedDays, t)}</span>
            </span>
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            <span>
              {t('merge.resultHistory')}:{' '}
              <span className="text-foreground">{preview.purchases_moved + preview.referrals_moved}</span>
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('merge.detailsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {preview.merged_expire_at != null && String(preview.merged_expire_at) !== '' && (
            <p>
              <span className="text-foreground font-medium">{t('merge.mergedExpire')}: </span>
              {formatDate(String(preview.merged_expire_at), lang)}
            </p>
          )}
          <p>
            <span className="text-foreground font-medium">{t('merge.mergedLoyalty')}: </span>
            {preview.merged_loyalty_xp}
          </p>
          <p>
            {t('merge.purchases')}: <span className="text-foreground">{preview.purchases_moved}</span>
          </p>
          <p>
            {t('merge.referrals')}: <span className="text-foreground">{preview.referrals_moved}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function daysFromNow(expireAt?: string | null): number | null {
  if (!expireAt) return null
  const ts = Date.parse(String(expireAt))
  if (!Number.isFinite(ts)) return null
  const diff = ts - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

function formatDaysLabel(days: number | null, t: (key: string, options?: any) => string): string {
  if (days == null) return t('merge.noSubscription')
  if (days <= 0) return t('merge.expired')
  return t('merge.daysLeft', { count: days })
}

function formatCurrentAccountMethods(
  providers: string[] | undefined,
  t: (key: string, options?: any) => string,
): string {
  if (!providers || providers.length === 0) return t('merge.methodUnknown')
  const labels = providers.map((p) => {
    switch (p) {
      case 'google':
        return t('merge.methodGoogle')
      case 'telegram':
        return t('merge.methodTelegram')
      case 'email':
        return t('merge.methodEmail')
      default:
        return p
    }
  })
  return labels.join(', ')
}

function SnapshotBlock({
  label,
  method,
  s,
  lang,
}: {
  label: string
  method: string
  s: MergeCustomerSnapshot
  lang: string
}) {
  const { t } = useTranslation()
  const days = useMemo(() => daysFromNow(s.expire_at ?? null), [s.expire_at])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-muted-foreground">{t('merge.signInMethod')}</p>
          <p className="font-medium">{method}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('merge.subscriptionDays')}</p>
          <p className="font-medium">{formatDaysLabel(days, t)}</p>
          {s.expire_at && (
            <p className="text-xs text-muted-foreground">
              {t('merge.expireDate')}: {formatDate(String(s.expire_at), lang)}
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">id: {s.id}</p>
      </CardContent>
    </Card>
  )
}
