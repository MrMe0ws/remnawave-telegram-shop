import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Sparkles, Users, Zap, ChevronRight, MonitorSmartphone, AlertTriangle, Ticket, FileText, Newspaper, Star } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { SubscriptionExpireAtBlock } from '@/components/SubscriptionExpireAtBlock'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'
import { TrafficUsageBar } from '@/components/TrafficUsageBar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api, type SubscriptionResponse } from '@/lib/api'
import { daysUntil } from '@/lib/utils'
import { useTranslationWithLang } from '@/hooks/useTranslationWithLang'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { lang } = useTranslationWithLang()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: sub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.subscription(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  })

  const { data: trial } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => api.trialInfo(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  })

  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.devices(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
    enabled: Boolean(sub),
  })
  const { data: bootstrap } = useAuthBootstrap()

  const hasSubscription = hasSubscriptionData(sub)
  const days = sub?.expire_at ? daysUntil(sub.expire_at) : null
  const isExpiredByDate = days !== null && days <= 0
  const isExpiredByTraffic = Boolean(
    sub?.traffic_limit_gb != null &&
    sub.traffic_limit_gb > 0 &&
    (sub.traffic_used_gb ?? 0) >= sub.traffic_limit_gb,
  )
  const isInactive = isExpiredByDate || isExpiredByTraffic
  const isActive = !isInactive
  const connectedDevices = Math.max(0, devices?.connected ?? 0)
  const deviceLimitByPlan = sub?.tariff?.device_limit ?? 0
  const deviceLimitFromDevices = Math.max(0, devices?.device_limit ?? 0)
  const deviceLimit = Math.max(deviceLimitByPlan, deviceLimitFromDevices)
  const deviceLimitText =
    deviceLimit > 0
      ? t('subscriptionPage.devicesLimitLine', { used: connectedDevices, limit: deviceLimit })
      : t('subscriptionPage.devicesLimitLine', { used: connectedDevices, limit: t('subscriptionPage.unlimited') })
  const newsUrl = bootstrap?.site_links?.channel?.trim()
  const feedbackUrl = bootstrap?.site_links?.feedback?.trim()

  const activateTrial = useMutation({
    mutationFn: () => api.activateTrial(),
    onSuccess: async () => {
      await Promise.all([
        qc.refetchQueries({ queryKey: ['subscription'] }),
        qc.refetchQueries({ queryKey: ['trial-info'] }),
      ])
      navigate('/subscription', { replace: true })
    },
  })

  const trialButtonLabel = (() => {
    if (activateTrial.isPending) return t('dashboard.activatingTrial')
    if (!trial?.enabled) return t('dashboard.trialUnavailable')
    if (trial.can_activate) return t('dashboard.activateTrial')
    return t('dashboard.trialUnavailable')
  })()

  return (
    <AppLayout>
      <PWAInstallPrompt />
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('dashboard.welcomeTitle')}</h1>
        </div>

        {hasSubscription ? (
          <Card className="overflow-hidden border border-border bg-card text-card-foreground dark:border-primary/25 dark:bg-gradient-to-br dark:from-[#0e1529] dark:via-[#0b1324] dark:to-[#0a1222] dark:text-white dark:shadow-cyan-500/5">
            <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-3" id="cabinet-onboarding-step1-target">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary/80 dark:text-cyan-200/80">
                    {t('dashboard.yourSubscriptionTitle')}
                  </p>
                  <p className="mt-1 text-xl font-semibold">{subscriptionTariffLabel(sub, t)}</p>
                </div>
                <div className="text-right">
                  <StatusBadge isActive={isActive} isExpired={isInactive} hasSubscription={Boolean(sub?.expire_at)} />
                </div>
              </div>

              <TrafficUsageBar
                usedGb={sub?.traffic_used_gb}
                limitGb={sub?.traffic_limit_gb}
                usageTitle={t('dashboard.trafficUsage')}
                gigabytesLabel={t('dashboard.gigabytes')}
                unlimitedLabel={t('subscriptionPage.unlimited')}
              />

              {sub?.subscription_link && !isInactive && (
                <Link
                  id="cabinet-onboarding-step2-target"
                  to="/connections"
                  className="connect-device-cta group block rounded-xl"
                >
                  <div className="connect-device-cta-inner flex items-center gap-3 px-4 py-3 text-card-foreground dark:text-white">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary dark:bg-cyan-500/15 dark:text-cyan-200">
                      <MonitorSmartphone size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{t('subscriptionPage.connectDevice')}</p>
                            <p className="text-xs text-muted-foreground dark:text-slate-300">{deviceLimitText}</p>
                    </div>
                  </div>
                </Link>
              )}

              <SubscriptionExpireAtBlock
                expireAt={sub?.expire_at}
                lang={lang}
                days={days}
                isActive={isActive}
              />

              {isInactive && (
                <Link
                  id="cabinet-onboarding-step2-target"
                  to="/tariffs"
                  className="renew-subscription-cta-danger group block rounded-xl"
                >
                  <div className="renew-subscription-cta-danger-inner flex items-start gap-3 px-4 py-3 text-card-foreground">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                      <AlertTriangle size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t('subscriptionPage.renewSubscription')}</p>
                      <p className="text-xs text-muted-foreground">{t('subscriptionPage.statusExpired')}</p>
                    </div>
                    <ChevronRight size={16} className="mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border border-border bg-card text-card-foreground dark:border-primary/25 dark:bg-gradient-to-br dark:from-[#0E1A33] dark:via-[#0D1324] dark:to-[#0A1222] dark:text-white">
            <CardContent className="space-y-5 px-6 py-7">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 dark:border-cyan-400/30 dark:bg-cyan-500/10">
                <Sparkles size={18} className="text-primary dark:text-cyan-200" />
              </div>

              <div className="text-center" id="cabinet-onboarding-step1-target">
                <h2 className="text-2xl font-semibold">{t('dashboard.trialTitle')}</h2>
                <p className="mt-1 text-sm text-muted-foreground dark:text-slate-300">{t('dashboard.trialSubtitle')}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <TrialStat value={trial?.days ?? 0} label={t('dashboard.days')} />
                <TrialStat value={trial?.traffic_gb ?? 0} label={t('dashboard.gigabytes')} />
                <TrialStat value={trial?.device_limit ?? 0} label={t('dashboard.devices')} />
              </div>

              <div className="connect-device-cta trial-activate-cta rounded-full" id="cabinet-onboarding-step2-target">
                <div className="connect-device-cta-inner trial-activate-cta-inner p-[1px]">
                  <Button
                    className="trial-activate-btn h-11 w-full rounded-full border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 dark:border-cyan-300/20 dark:bg-cyan-500/10 dark:text-white dark:hover:bg-cyan-500/20"
                    onClick={() => activateTrial.mutate()}
                    disabled={!trial?.enabled || !trial?.can_activate || activateTrial.isPending}
                  >
                    {trialButtonLabel}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/tariffs"
            className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="bg-card/70 h-full transition-shadow group-active:scale-[0.99]">
              <CardContent className="flex items-center justify-between gap-2 px-3 py-4 sm:px-4">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Zap size={16} className="shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{t('dashboard.tariffsCardTitle')}</span>
                </p>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              </CardContent>
            </Card>
          </Link>

          <Link
            to="/referral"
            className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="bg-card/70 h-full transition-shadow group-active:scale-[0.99]">
              <CardContent className="flex items-center justify-between gap-2 px-3 py-4 sm:px-4">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Users size={16} className="shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{t('dashboard.referralsCardTitle')}</span>
                </p>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              </CardContent>
            </Card>
          </Link>

          <Link
            to="/promocodes"
            className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="bg-card/70 h-full transition-shadow group-active:scale-[0.99]">
              <CardContent className="flex items-center justify-between gap-2 px-3 py-4 sm:px-4">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Ticket size={16} className="shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{t('dashboard.promocodesCardTitle')}</span>
                </p>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              </CardContent>
            </Card>
          </Link>

          <Link
            to="/support#cabinet-info"
            className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="bg-card/70 h-full transition-shadow group-active:scale-[0.99]">
              <CardContent className="flex items-center justify-between gap-2 px-3 py-4 sm:px-4">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <FileText size={16} className="shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{t('dashboard.infoCardTitle')}</span>
                </p>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              </CardContent>
            </Card>
          </Link>

          {newsUrl && (
            <a
              href={newsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="bg-card/70 h-full transition-shadow group-active:scale-[0.99]">
                <CardContent className="flex items-center justify-between gap-2 px-3 py-4 sm:px-4">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <Newspaper size={16} className="shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{t('dashboard.newsCardTitle')}</span>
                  </p>
                  <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
                </CardContent>
              </Card>
            </a>
          )}

          {feedbackUrl && (
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="bg-card/70 h-full transition-shadow group-active:scale-[0.99]">
                <CardContent className="flex items-center justify-between gap-2 px-3 py-4 sm:px-4">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <Star size={16} className="shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{t('dashboard.feedbackCardTitle')}</span>
                  </p>
                  <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
                </CardContent>
              </Card>
            </a>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function subscriptionTariffLabel(sub: SubscriptionResponse | null | undefined, t: TFunction): string {
  if (!sub) return t('dashboard.basicPlan')
  if (sub.is_trial) return t('dashboard.trialTariffLabel')
  const raw = sub.tariff?.name
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (name) return name
  if (sub.tariff?.slug === 'classic') return t('dashboard.classicTariffFallback')
  return t('dashboard.basicPlan')
}

function hasSubscriptionData(sub?: SubscriptionResponse | null): boolean {
  if (!sub) return false
  if (sub.subscription_link && String(sub.subscription_link).trim() !== '') return true
  if (sub.expire_at && String(sub.expire_at).trim() !== '') return true
  return false
}

function StatusBadge({
  isActive,
  isExpired,
  hasSubscription,
}: {
  isActive: boolean
  isExpired: boolean
  hasSubscription: boolean
}) {
  const { t } = useTranslation()

  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200">
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {t('subscriptionPage.statusActive')}
      </span>
    )
  }
  if (isExpired) {
    return (
      <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
        {t('subscriptionPage.statusExpired')}
      </span>
    )
  }
  if (!hasSubscription) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {t('subscriptionPage.statusNone')}
      </span>
    )
  }
  return null
}

function TrialStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold leading-none">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-300">{label}</div>
    </div>
  )
}
