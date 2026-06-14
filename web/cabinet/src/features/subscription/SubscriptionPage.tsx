import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Copy, Check, Wifi, RefreshCw, ChevronRight, Smartphone, Trash2, AlertTriangle, MonitorSmartphone, Zap } from 'lucide-react'
import type { TFunction } from 'i18next'
import { createPortal } from 'react-dom'

import { AppLayout } from '@/components/AppLayout'
import { SubscriptionExpireAtBlock } from '@/components/SubscriptionExpireAtBlock'
import { TrafficUsageBar } from '@/components/TrafficUsageBar'
import { LoyaltyCompactCard } from '@/features/loyalty/LoyaltyProgramPage'
import { SubscriptionExtraDevices } from '@/features/subscription/SubscriptionExtraDevices'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { daysUntil, cn } from '@/lib/utils'
import { useTranslationWithLang } from '@/hooks/useTranslationWithLang'

export default function SubscriptionPage() {
  const { t } = useTranslation()
  const { lang } = useTranslationWithLang()
  const [copied, setCopied] = useState(false)
  const [refreshDone, setRefreshDone] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: sub, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.subscription(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  })
  const { data: devices, refetch: refetchDevices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.devices(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
    enabled: Boolean(sub),
  })
  const deleteDevice = useMutation({
    mutationFn: (hwid: string) => api.deleteDevice(hwid),
    onSuccess: async () => {
      await refetchDevices()
    },
  })

  const [deleteConfirmHwid, setDeleteConfirmHwid] = useState<string | null>(null)

  const days = sub?.expire_at ? daysUntil(sub.expire_at) : null
  const isExpiredByDate = sub?.expire_at != null && sub.expire_at !== '' && days !== null && days <= 0
  const isExpiredByTraffic = Boolean(
    sub?.traffic_limit_gb != null &&
    sub.traffic_limit_gb > 0 &&
    (sub.traffic_used_gb ?? 0) >= sub.traffic_limit_gb,
  )
  const isExpired = isExpiredByDate || isExpiredByTraffic
  const isActive = !isExpired
  const showRenewCta = isActive && days !== null && days <= 7
  const renewCtaAnimated = days !== null && days <= 3
  const hasLink = Boolean(sub?.subscription_link && String(sub.subscription_link).trim() !== '')
  const hasExpire = Boolean(sub?.expire_at && String(sub.expire_at).trim() !== '')
  const hasRecord = hasLink || hasExpire
  const connectedDevices = Math.max(0, devices?.connected ?? 0)
  const deviceLimitByPlan = sub?.tariff?.device_limit ?? 0
  const deviceLimitFromDevices = Math.max(0, devices?.device_limit ?? 0)
  const deviceLimit = Math.max(deviceLimitByPlan, deviceLimitFromDevices)
  const tariffExtraFromHwid = Math.max(0, sub?.hwid_extra?.extra_active ?? 0)
  const tariffExtraFromActualLimit =
    deviceLimitByPlan > 0 && deviceLimitFromDevices > deviceLimitByPlan
      ? deviceLimitFromDevices - deviceLimitByPlan
      : 0
  const tariffExtraDevices = Math.max(tariffExtraFromHwid, tariffExtraFromActualLimit)
  const deviceLimitText =
    deviceLimit > 0
      ? t('subscriptionPage.devicesLimitLine', { used: connectedDevices, limit: deviceLimit })
      : t('subscriptionPage.devicesLimitLine', { used: connectedDevices, limit: t('subscriptionPage.unlimited') })

  async function copyLink() {
    if (!sub?.subscription_link) return
    await navigator.clipboard.writeText(sub.subscription_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRefresh() {
    if (isRefreshing) return
    setRefreshDone(false)
    setIsRefreshing(true)
    try {
      const [subResult] = await Promise.all([refetch(), refetchDevices()])
      if (subResult.isSuccess) {
        setRefreshDone(true)
        setTimeout(() => setRefreshDone(false), 2000)
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t('subscriptionPage.title')}</h1>
          {!isLoading && hasRecord && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              title={refreshDone ? t('subscriptionPage.refreshDone') : t('subscriptionPage.refresh')}
              aria-label={refreshDone ? t('subscriptionPage.refreshDone') : t('subscriptionPage.refresh')}
            >
              {refreshDone ? (
                <Check size={15} className="animate-fade-in text-emerald-500 dark:text-emerald-400" />
              ) : (
                <RefreshCw size={15} className={cn(isRefreshing && 'animate-spin')} />
              )}
            </Button>
          )}
        </div>

        {isLoading ? (
          <SkeletonRows n={4} />
        ) : error ? (
          <p className="text-sm text-destructive">{t('errors.unknown')}</p>
        ) : !hasRecord ? (
          <Card className="max-w-lg mx-auto">
            <CardContent
              id="cabinet-onboarding-step1-target"
              className="flex flex-col items-center gap-4 px-8 py-12 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <ClipboardList size={28} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold">{t('subscriptionPage.emptyTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('subscriptionPage.emptySubtitle')}</p>
              </div>
              <Button asChild className="w-full max-w-xs">
                <Link to="/tariffs">{t('subscriptionPage.buySubscription')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <Card className="subscription-feature-card">
              <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                <div className="flex flex-wrap items-start justify-between gap-3" id="cabinet-onboarding-step1-target">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
                      {t('dashboard.subscriptionLabel')}
                    </p>
                    <p className="mt-1 text-xl font-semibold">{subscriptionTariffLabel(sub, t)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {deviceLimit > 0
                        ? tariffExtraDevices > 0
                          ? t('subscriptionPage.tariffDevicesWithExtra', { base: deviceLimit - tariffExtraDevices, extra: tariffExtraDevices })
                          : `${deviceLimit} ${t('subscriptionPage.devices').toLowerCase()}`
                        : t('subscriptionPage.unlimited')}
                      {' · '}
                      {sub?.traffic_limit_gb && sub.traffic_limit_gb > 0 ? `${sub.traffic_limit_gb} ${t('dashboard.gigabytes')}` : t('subscriptionPage.unlimited')}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge isActive={isActive} isExpired={isExpired} hasSubscription={Boolean(sub?.expire_at)} />
                  </div>
                </div>

                <TrafficUsageBar
                  usedGb={sub?.traffic_used_gb}
                  limitGb={sub?.traffic_limit_gb}
                  usageTitle={t('dashboard.trafficUsage')}
                  gigabytesLabel={t('dashboard.gigabytes')}
                  unlimitedLabel={t('subscriptionPage.unlimited')}
                />

                {sub?.subscription_link && (
                  isExpired ? (
                    <div
                      id="cabinet-onboarding-step2-target"
                      className="rounded-xl border border-border bg-muted/35 px-4 py-3 opacity-70"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <MonitorSmartphone size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-muted-foreground">{t('subscriptionPage.connectDevice')}</p>
                          <p className="text-xs text-muted-foreground">{deviceLimitText}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Link
                      id="cabinet-onboarding-step2-target"
                      to="/connections"
                      className="connect-device-cta group block"
                    >
                      <div className="connect-device-cta-inner flex items-center gap-3 px-4 py-3 text-card-foreground">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <MonitorSmartphone size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium">{t('subscriptionPage.connectDevice')}</p>
                          <p className="text-xs text-muted-foreground">{deviceLimitText}</p>
                        </div>
                      </div>
                    </Link>
                  )
                )}

                {hasExpire && (
                  <SubscriptionExpireAtBlock
                    expireAt={sub?.expire_at}
                    lang={lang}
                    days={days}
                    isActive={isActive}
                  />
                )}

                {isExpired && (
                  <Link
                    to="/tariffs"
                    className="renew-subscription-cta-danger group block"
                  >
                    <div className="renew-subscription-cta-danger-inner flex items-center gap-3 px-4 py-3 text-card-foreground">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                        <AlertTriangle size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{t('subscriptionPage.renewSubscription')}</p>
                        <p className="text-xs text-muted-foreground">{t('subscriptionPage.statusExpired')}</p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>

            {sub?.subscription_link && (
              <Card className="subscription-feature-card">
                <CardContent className="px-5 py-5 sm:px-6">
                  <p className="mb-3 flex items-center gap-2 text-base font-medium text-foreground">
                    <Wifi size={14} className="text-primary" />
                    {t('subscriptionPage.subscriptionLink')}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground select-all">
                      {sub.subscription_link}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyLink}
                      className="shrink-0 gap-1.5"
                      disabled={isExpired}
                    >
                      {copied ? (
                        <>
                          <Check size={14} className="text-primary" />
                          {t('subscriptionPage.copied')}
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          {t('subscriptionPage.copyLink')}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {showRenewCta && (
              <RenewSubscriptionCta animated={renewCtaAnimated} subtitle={t('dashboard.tariffsCardTitle')} />
            )}

            <div id="cabinet-loyalty">
              <LoyaltyCompactCard />
            </div>

            {sub?.hwid_extra?.ui_visible && sub.hwid_extra.enabled && (
              <SubscriptionExtraDevices hwid={sub.hwid_extra} inactive={isExpired} onUpdated={() => void refetch()} />
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
                  <Smartphone size={14} />
                  {t('subscriptionPage.myDevices')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!devices?.enabled ? (
                  <p className="text-sm text-muted-foreground">{t('subscriptionPage.devicesUnavailable')}</p>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground">
                      {t('subscriptionPage.devicesLimitLine', {
                        used: devices.connected ?? 0,
                        limit: devices.device_limit > 0 ? devices.device_limit : t('subscriptionPage.unlimited'),
                      })}
                    </div>
                    {devicesLoading ? (
                      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                    ) : !devices.devices?.length ? (
                      <p className="text-sm text-muted-foreground">{t('subscriptionPage.noDevices')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {devices.devices.map((d) => {
                          const title = d.device_model || d.platform || d.hwid
                          const subtitle = [d.platform, d.os_version].filter(Boolean).join(' · ')
                          return (
                            <li key={d.hwid} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <DeviceCardIcon className="shrink-0" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{title}</p>
                                  <p className="truncate text-xs text-muted-foreground">{subtitle || d.hwid}</p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={deleteDevice.isPending}
                                onClick={() => setDeleteConfirmHwid(d.hwid)}
                              >
                                <Trash2 size={13} />
                                {t('subscriptionPage.deleteDevice')}
                              </Button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {deleteConfirmHwid && typeof document !== 'undefined'
              ? createPortal(
                  <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-background/95 shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] backdrop-blur-sm p-4">
                      <p className="text-base font-medium text-foreground mb-4">
                        {t('subscriptionPage.deleteDeviceConfirm')}
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={deleteDevice.isPending}
                          onClick={() => setDeleteConfirmHwid(null)}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          loading={deleteDevice.isPending}
                          disabled={deleteDevice.isPending}
                          onClick={() => {
                            const hwid = deleteConfirmHwid
                            setDeleteConfirmHwid(null)
                            deleteDevice.mutate(hwid)
                          }}
                        >
                          {t('subscriptionPage.deleteDevice')}
                        </Button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function subscriptionTariffLabel(sub: Awaited<ReturnType<typeof api.subscription>> | null | undefined, t: TFunction): string {
  if (!sub) return t('dashboard.basicPlan')
  if (sub.is_trial) return t('dashboard.trialTariffLabel')
  const raw = sub.tariff?.name
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (name) return name
  if (sub.tariff?.slug === 'classic') return t('dashboard.classicTariffFallback')
  return t('dashboard.basicPlan')
}

function RenewSubscriptionCta({ animated, subtitle }: { animated: boolean; subtitle: string }) {
  const { t } = useTranslation()

  const inner = (
    <>
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Zap size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('subscriptionPage.renewSubscription')}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </>
  )

  if (animated) {
    return (
      <Link
        to="/tariffs"
        className="connect-device-cta group block shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)]"
      >
        <div className="connect-device-cta-inner flex items-center gap-3 px-4 py-3 text-card-foreground">
          {inner}
        </div>
      </Link>
    )
  }

  return (
    <Link
      to="/tariffs"
      className="renew-subscription-cta-static group"
    >
      <div className="flex items-center gap-3 px-4 py-3 text-card-foreground">
        {inner}
      </div>
    </Link>
  )
}

function DeviceCardIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('text-muted-foreground/70 dark:text-white/40', className)}
    >
      <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  )
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

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-4 rounded-md bg-muted animate-pulse" style={{ width: `${60 + i * 10}%` }} />
      ))}
    </div>
  )
}
