import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Minus, Plus, Smartphone, Trash2 } from 'lucide-react'

import { AdminSectionCard } from './AdminSectionCard'
import { cn } from '@/lib/utils'
import type { AdminCustomerDTO, AdminDeviceDTO } from '@/lib/types/admin'
import {
  useAdminUserSetHwidLimit,
  useAdminUserExtraHwid,
  useAdminUserDeleteDevice,
} from '../hooks/useAdminUsers'
import { activeExtraHwidSlots, computeDeviceLimitBreakdown } from '../utils/deviceLimit'
import { formatAdminDateTime } from '../utils/datetime'

const MIN_TOTAL = 1
const MAX_TOTAL = 100

interface Props {
  userId: number
  customer?: AdminCustomerDTO | null
  totalLimit: number
  devices: AdminDeviceDTO[]
  devicesLoading?: boolean
  onSuccess?: (message?: string) => void
  onError?: (err: unknown) => void
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function AdminDeviceLimitEditor({
  userId,
  customer,
  totalLimit,
  devices,
  devicesLoading,
  onSuccess,
  onError,
}: Props) {
  const { t, i18n } = useTranslation()
  const setHwid = useAdminUserSetHwidLimit(userId)
  const extraHwid = useAdminUserExtraHwid(userId)
  const deleteDevice = useAdminUserDeleteDevice(userId)

  const connectedCount = devices.length
  const storedExtra = customer?.extra_hwid ?? 0
  const activeExtra = activeExtraHwidSlots(customer)
  const { baseLimit } = computeDeviceLimitBreakdown(totalLimit, customer)
  const dateLocale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'

  const [customTotal, setCustomTotal] = useState(String(totalLimit))
  const pending = setHwid.isPending || extraHwid.isPending

  useEffect(() => {
    setCustomTotal(String(totalLimit))
  }, [totalLimit])

  const applyTotal = (value: number) => {
    const clamped = Math.min(MAX_TOTAL, Math.max(MIN_TOTAL, value))
    setCustomTotal(String(clamped))
    setHwid.mutate(clamped, {
      onSuccess: () => onSuccess?.(),
      onError: (e) => onError?.(e),
    })
  }

  const commitCustomTotal = () => {
    const parsed = parseInt(customTotal, 10)
    if (Number.isNaN(parsed) || parsed === totalLimit) {
      setCustomTotal(String(totalLimit))
      return
    }
    applyTotal(parsed)
  }

  const adjustExtra = (delta: number) => {
    extraHwid.mutate(delta, {
      onSuccess: () => onSuccess?.(),
      onError: (e) => onError?.(e),
    })
  }

  return (
    <AdminSectionCard
      title={t('admin.users.subscription.devicesTitle')}
      description={t('admin.users.subscription.devicesHint')}
      icon={Smartphone}
      iconAccent="cyan"
    >
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            {t('admin.users.subscription.devicesUsage', { used: connectedCount, limit: totalLimit })}
          </p>
          {connectedCount >= totalLimit && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              {t('admin.users.subscription.devicesFull')}
            </span>
          )}
        </div>
        <UsageBar used={connectedCount} limit={totalLimit} />

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: t('admin.users.subscription.baseLimit'), value: baseLimit, accent: false },
            { label: t('admin.users.subscription.extraHwid'), value: `+${activeExtra}`, accent: activeExtra > 0 },
            { label: t('admin.users.subscription.totalLimit'), value: totalLimit, accent: true },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className={cn(
                'rounded-lg border px-3 py-2 text-center',
                accent ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-background/60',
              )}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className={cn('mt-0.5 text-lg font-semibold tabular-nums', accent && 'text-primary')}>
                {value}
              </p>
            </div>
          ))}
        </div>
        {storedExtra > 0 && activeExtra === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('admin.users.subscription.extraHwidInactive', { count: storedExtra })}
          </p>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <p className="text-sm font-medium">{t('admin.users.subscription.totalLimitTitle')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('admin.users.subscription.totalLimitHint')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyTotal(totalLimit - 1)}
            disabled={pending || totalLimit <= MIN_TOTAL}
            className="inline-flex size-10 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-40"
            aria-label={t('admin.users.subscription.decreaseLimit')}
          >
            <Minus className="size-4" />
          </button>
          <input
            type="number"
            min={MIN_TOTAL}
            max={MAX_TOTAL}
            value={customTotal}
            onChange={(e) => setCustomTotal(e.target.value)}
            onBlur={commitCustomTotal}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitCustomTotal()
              }
            }}
            className="admin-input w-20 px-3 py-2 text-center text-sm font-semibold tabular-nums"
          />
          <button
            type="button"
            onClick={() => applyTotal(totalLimit + 1)}
            disabled={pending || totalLimit >= MAX_TOTAL}
            className="inline-flex size-10 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-40"
            aria-label={t('admin.users.subscription.increaseLimit')}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-border/70 bg-muted/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t('admin.users.subscription.extraHwidTitle')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('admin.users.subscription.extraHwidHint')}
            </p>
            {customer?.extra_hwid_expires_at && activeExtra > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t('admin.users.subscription.extraHwidExpires', {
                  date: formatAdminDateTime(customer.extra_hwid_expires_at, dateLocale),
                })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustExtra(-1)}
              disabled={pending || storedExtra <= 0}
              className="inline-flex size-10 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-40"
              aria-label={t('admin.users.subscription.decreaseExtra')}
            >
              <Minus className="size-4" />
            </button>
            <span className="min-w-[2rem] text-center text-lg font-semibold tabular-nums">
              {storedExtra}
            </span>
            <button
              type="button"
              onClick={() => adjustExtra(1)}
              disabled={pending}
              className="inline-flex size-10 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-40"
              aria-label={t('admin.users.subscription.increaseExtra')}
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {extraHwid.isPending && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {t('admin.users.subscription.extraHwidSaving')}
          </p>
        )}
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-medium">
          {t('admin.users.subscription.connectedDevices', { count: connectedCount })}
        </p>
        {devicesLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {t('admin.users.subscription.noDevices')}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">{t('admin.users.subscription.deviceHwid')}</th>
                    <th className="pb-2 pr-4">{t('admin.users.subscription.devicePlatform')}</th>
                    <th className="pb-2 pr-4">{t('admin.users.subscription.deviceModel')}</th>
                    <th className="pb-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {devices.map((d) => (
                    <tr key={d.hwid}>
                      <td className="py-2 pr-4 font-mono text-xs">{d.hwid.slice(0, 20)}…</td>
                      <td className="py-2 pr-4">{d.platform ?? '—'}</td>
                      <td className="py-2 pr-4">{d.device_model ?? '—'}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('admin.users.subscription.confirmDeleteDevice'))) {
                              deleteDevice.mutate(d.hwid, {
                                onSuccess: () => onSuccess?.(t('admin.feedback.deviceDeleted')),
                                onError: (e) => onError?.(e),
                              })
                            }
                          }}
                          disabled={deleteDevice.isPending}
                          className="rounded p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          title={t('admin.delete')}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {devices.map((d) => (
                <div key={d.hwid} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-muted-foreground">{d.hwid}</p>
                    <p className="mt-1 text-sm">
                      {[d.platform, d.device_model].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {d.created_at && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatAdminDateTime(d.created_at, dateLocale)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('admin.users.subscription.confirmDeleteDevice'))) {
                        deleteDevice.mutate(d.hwid, {
                          onSuccess: () => onSuccess?.(t('admin.feedback.deviceDeleted')),
                          onError: (e) => onError?.(e),
                        })
                      }
                    }}
                    disabled={deleteDevice.isPending}
                    className="shrink-0 rounded-lg border border-destructive/30 p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminSectionCard>
  )
}
