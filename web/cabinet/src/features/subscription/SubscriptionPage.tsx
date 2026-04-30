import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Copy, Check, Wifi, RefreshCw, ChevronRight, Smartphone, Trash2, AlertTriangle, MonitorSmartphone, Zap } from 'lucide-react'
import { createPortal } from 'react-dom'

import { AppLayout } from '@/components/AppLayout'
import { LoyaltyCompactCard } from '@/features/loyalty/LoyaltyProgramPage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { daysUntil, formatDate } from '@/lib/utils'
import { useTranslationWithLang } from '@/hooks/useTranslationWithLang'

export default function SubscriptionPage() {
  const { t } = useTranslation()
  const { lang } = useTranslationWithLang()
  const [copied, setCopied] = useState(false)

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
  const hasLink = Boolean(sub?.subscription_link && String(sub.subscription_link).trim() !== '')
  const hasExpire = Boolean(sub?.expire_at && String(sub.expire_at).trim() !== '')
  const hasRecord = hasLink || hasExpire
  const connectedDevices = Math.max(0, devices?.connected ?? 0)
  const deviceLimitByPlan = sub?.tariff?.device_limit ?? 0
  const deviceLimitText =
    deviceLimitByPlan > 0
      ? t('subscriptionPage.devicesLimitLine', { used: connectedDevices, limit: deviceLimitByPlan })
      : t('subscriptionPage.devicesLimitLine', { used: connectedDevices, limit: t('subscriptionPage.unlimited') })

  async function copyLink() {
    if (!sub?.subscription_link) return
    await navigator.clipboard.writeText(sub.subscription_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t('subscriptionPage.title')}</h1>
          {!isLoading && hasRecord && (
            <Button variant="ghost" size="icon" onClick={() => refetch()} title={t('subscriptionPage.refresh')}>
              <RefreshCw size={15} />
            </Button>
          )}
        </div>

        {isLoading ? (
          <SkeletonRows n={4} />
        ) : error ? (
          <p className="text-sm text-destructive">{t('errors.unknown')}</p>
        ) : !hasRecord ? (
          <Card className="max-w-lg mx-auto">
            <CardContent className="flex flex-col items-center gap-4 px-8 py-12 text-center">
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
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-muted-foreground">
                    {t('dashboard.subscriptionLabel')}
                  </CardTitle>
                  <StatusBadge isActive={isActive} isExpired={isExpired} hasSubscription={Boolean(sub?.expire_at)} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isExpired && (
                  <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                        <AlertTriangle size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-destructive">{t('subscriptionPage.expiredBlockTitle')}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isExpiredByTraffic ? t('subscriptionPage.expiredTrafficHint') : t('subscriptionPage.expiredDateHint')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {sub?.expire_at && (
                  <InfoRow
                    label={t('subscriptionPage.expireAt')}
                    value={
                      <span className="font-medium">
                        {formatDate(sub.expire_at, lang)}
                        {days !== null && (
                          <span className={`ml-2 text-xs ${isActive ? 'text-primary' : 'text-destructive'}`}>
                            {isActive
                              ? t('subscriptionPage.daysLeft', { n: days })
                              : t('subscriptionPage.statusExpired')}
                          </span>
                        )}
                      </span>
                    }
                  />
                )}

                {sub?.tariff && (
                  <InfoRow
                    label={t('subscriptionPage.tariff')}
                    value={
                      <span className="font-medium">
                        {sub.tariff.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {sub.tariff.device_limit > 0
                            ? `${sub.tariff.device_limit} ${t('subscriptionPage.devices').toLowerCase()}`
                            : t('subscriptionPage.unlimited')}
                          {' · '}
                          {sub.tariff.traffic_gb
                            ? `${sub.tariff.traffic_gb} ${t('dashboard.gigabytes')}`
                            : t('subscriptionPage.unlimited')}
                        </span>
                      </span>
                    }
                  />
                )}
                <InfoRow
                  label={t('dashboard.trafficUsage')}
                  value={
                    <span className="font-medium">
                      {sub?.traffic_limit_gb
                        ? `${(sub?.traffic_used_gb ?? 0).toFixed(1)} / ${sub.traffic_limit_gb} ${t('dashboard.gigabytes')}`
                        : t('subscriptionPage.unlimited')}
                    </span>
                  }
                />

                <div className="space-y-2.5">
                  {sub?.subscription_link && (
                    isExpired ? (
                      <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 opacity-70">
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
                      <Link to="/connections" className="connect-device-cta group block rounded-xl">
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
                  {isExpired ? (
                    <Link to="/tariffs" className="connect-device-cta group block rounded-xl">
                      <div className="connect-device-cta-inner flex items-center gap-3 px-4 py-3 text-card-foreground">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                          <AlertTriangle size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{t('subscriptionPage.renewSubscription')}</p>
                          <p className="text-xs text-muted-foreground">{t('subscriptionPage.statusExpired')}</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Link>
                  ) : (
                    <Link
                      to="/tariffs"
                      className="group block rounded-xl border border-border bg-muted/35 px-4 py-3 transition-colors hover:bg-muted/55"
                    >
                      <div className="flex items-center gap-3 text-card-foreground">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Zap size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{t('subscriptionPage.renewSubscription')}</p>
                          <p className="text-xs text-muted-foreground">{t('dashboard.tariffsCardTitle')}</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>

            {sub?.subscription_link && (
              <Card className={isExpired ? 'opacity-60 saturate-50' : ''}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
                    <Wifi size={14} />
                    {t('subscriptionPage.subscriptionLink')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono text-muted-foreground truncate select-all">
                      {sub.subscription_link}
                    </div>
                    <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0 gap-1.5" disabled={isExpired}>
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

            <div id="cabinet-loyalty">
              <LoyaltyCompactCard />
            </div>

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
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{title}</p>
                                <p className="truncate text-xs text-muted-foreground">{subtitle || d.hwid}</p>
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
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-sm p-4">
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
      <Badge variant="success" className="gap-1.5">
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {t('subscriptionPage.statusActive')}
      </Badge>
    )
  }
  if (isExpired) {
    return <Badge variant="destructive">{t('subscriptionPage.statusExpired')}</Badge>
  }
  if (!hasSubscription) {
    return <Badge variant="outline">{t('subscriptionPage.statusNone')}</Badge>
  }
  return null
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
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
