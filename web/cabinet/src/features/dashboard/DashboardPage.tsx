import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Sparkles, Users, Zap, ChevronRight, MonitorSmartphone, AlertTriangle, Ticket, FileText } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api, type SubscriptionResponse } from '@/lib/api'
import { daysUntil, formatDate } from '@/lib/utils'
import { useTranslationWithLang } from '@/hooks/useTranslationWithLang'

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
  const deviceLimitText =
    deviceLimitByPlan > 0
      ? t('subscriptionPage.devicesLimitLine', { used: connectedDevices, limit: deviceLimitByPlan })
      : t('subscriptionPage.devicesLimitLine', { used: connectedDevices, limit: t('subscriptionPage.unlimited') })

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
          <Card className="overflow-hidden border border-border bg-card text-card-foreground shadow-md dark:border-primary/25 dark:bg-gradient-to-br dark:from-[#0e1529] dark:via-[#0b1324] dark:to-[#0a1222] dark:text-white dark:shadow-cyan-500/5">
            <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary/80 dark:text-cyan-200/80">
                    {t('dashboard.yourSubscriptionTitle')}
                  </p>
                  <p className="mt-1 text-xl font-semibold">{subscriptionTariffLabel(sub, t)}</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-semibold leading-none text-primary dark:text-white">
                    {sub?.traffic_limit_gb ? `${Math.round(((sub?.traffic_used_gb ?? 0) / sub.traffic_limit_gb) * 100)}%` : '∞'}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground dark:text-slate-300">
                    {sub?.traffic_limit_gb
                      ? `${(sub?.traffic_used_gb ?? 0).toFixed(1)} / ${sub.traffic_limit_gb.toLocaleString('ru-RU')} ${t('dashboard.gigabytes')}`
                      : t('subscriptionPage.unlimited')}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground dark:text-slate-300">{t('dashboard.trafficUsage')}</span>
                  <span className="text-muted-foreground dark:text-slate-300">
                    {sub?.traffic_limit_gb
                      ? `${Math.max(0, (sub?.traffic_used_gb ?? 0)).toFixed(1)} ${t('dashboard.gigabytes')}`
                      : t('subscriptionPage.unlimited')}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-primary/90 to-primary/70 transition-all dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-500"
                    style={{
                      width: `${sub?.traffic_limit_gb ? Math.min(100, Math.max(0, ((sub?.traffic_used_gb ?? 0) / sub.traffic_limit_gb) * 100)) : 100}%`,
                    }}
                  />
                </div>
              </div>

              {sub?.subscription_link && !isInactive && (
                <Link
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

              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  to="/subscription"
                  className={`block rounded-xl border px-4 py-3 transition-colors hover:bg-muted/70 dark:hover:bg-[#173154] ${
                    isInactive
                      ? 'border-destructive/45 bg-destructive/10 hover:bg-destructive/15'
                      : 'border-border bg-muted/50 dark:border-cyan-300/20 dark:bg-[#10223d]'
                  }`}
                >
                  <p className={`text-[11px] uppercase tracking-[0.14em] ${
                    isInactive
                      ? 'text-destructive/80'
                      : 'text-muted-foreground dark:text-cyan-200/70'
                  }`}>
                    {t('subscriptionPage.tariff')}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {subscriptionTariffLabel(sub, t)}
                  </p>
                </Link>
                <div className={`rounded-xl border px-4 py-3 ${
                  isInactive
                    ? 'border-destructive/55 bg-destructive/10'
                    : 'border-border bg-muted/50 dark:border-amber-300/20 dark:bg-[#1a2234]'
                }`}>
                  <p className={`text-[11px] uppercase tracking-[0.14em] ${
                    isInactive
                      ? 'text-destructive/80'
                      : 'text-muted-foreground dark:text-amber-200/70'
                  }`}>
                    {t('subscriptionPage.expireAt')}
                  </p>
                  <p className="mt-1 text-sm font-medium">{sub?.expire_at ? formatDate(sub.expire_at, lang) : '—'}</p>
                  <p
                    className={`mt-1 text-xs ${isActive ? 'text-emerald-600 dark:text-emerald-300' : 'text-destructive'}`}
                  >
                    {days !== null
                      ? (isActive ? t('subscriptionPage.daysLeft', { n: days }) : t('subscriptionPage.statusExpired'))
                      : t('subscriptionPage.statusNone')}
                  </p>
                </div>
              </div>

              {isInactive && (
                <div className="relative rounded-xl border border-destructive/45 bg-gradient-to-r from-destructive/15 via-destructive/10 to-destructive/5 p-4 shadow-[0_0_20px_rgba(220,38,38,0.2)]">
                  <div className="pointer-events-none absolute inset-0 rounded-xl border border-destructive/35 animate-pulse" />
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                      <AlertTriangle size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-destructive">{t('dashboard.subscriptionExpiredTitle')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isExpiredByTraffic
                          ? t('dashboard.subscriptionExpiredTrafficHint')
                          : t('dashboard.subscriptionExpiredDateHint')}
                      </p>
                      <Button asChild size="sm" className="mt-3 border border-red-300/20 bg-red-600 text-white shadow-[0_8px_24px_rgba(220,38,38,0.32)] hover:bg-red-500 hover:shadow-[0_10px_28px_rgba(220,38,38,0.38)] dark:bg-red-700 dark:hover:bg-red-600">
                        <Link to="/tariffs">{t('subscriptionPage.renewSubscription')}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border border-border bg-card text-card-foreground shadow-md dark:border-primary/25 dark:bg-gradient-to-br dark:from-[#0E1A33] dark:via-[#0D1324] dark:to-[#0A1222] dark:text-white">
            <CardContent className="space-y-5 px-6 py-7">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 dark:border-cyan-400/30 dark:bg-cyan-500/10">
                <Sparkles size={18} className="text-primary dark:text-cyan-200" />
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-semibold">{t('dashboard.trialTitle')}</h2>
                <p className="mt-1 text-sm text-muted-foreground dark:text-slate-300">{t('dashboard.trialSubtitle')}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <TrialStat value={trial?.days ?? 0} label={t('dashboard.days')} />
                <TrialStat value={trial?.traffic_gb ?? 0} label={t('dashboard.gigabytes')} />
                <TrialStat value={trial?.device_limit ?? 0} label={t('dashboard.devices')} />
              </div>

              <div className="connect-device-cta rounded-xl">
                <div className="connect-device-cta-inner rounded-[10px] p-[1px]">
                  <Button
                    className="h-11 w-full border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 dark:border-cyan-300/20 dark:bg-cyan-500/10 dark:text-white dark:hover:bg-cyan-500/20"
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
            <Card className="bg-card/70 h-full transition-shadow group-hover:shadow-md group-active:scale-[0.99]">
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
            <Card className="bg-card/70 h-full transition-shadow group-hover:shadow-md group-active:scale-[0.99]">
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
            <Card className="bg-card/70 h-full transition-shadow group-hover:shadow-md group-active:scale-[0.99]">
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
            to="/info"
            className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="bg-card/70 h-full transition-shadow group-hover:shadow-md group-active:scale-[0.99]">
              <CardContent className="flex items-center justify-between gap-2 px-3 py-4 sm:px-4">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <FileText size={16} className="shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{t('dashboard.infoCardTitle')}</span>
                </p>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              </CardContent>
            </Card>
          </Link>
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

function TrialStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold leading-none">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-300">{label}</div>
    </div>
  )
}
