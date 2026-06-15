import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Minus, Plus, Smartphone, Trash2 } from 'lucide-react'

import { AdminSectionCard } from './AdminSectionCard'
import { DevicePlatformIcon } from '@/components/DevicePlatformIcon'
import { cn } from '@/lib/utils'
import type { AdminCustomerDTO, AdminDeviceDTO } from '@/lib/types/admin'
import {
  useAdminUserSetHwidLimit,
  useAdminUserExtraHwid,
  useAdminUserDeleteDevice,
} from '../hooks/useAdminUsers'
import { activeExtraHwidSlots, baseLimitFromTotal } from '../utils/deviceLimit'
import { formatAdminDateTime } from '../utils/datetime'

const MIN_TOTAL = 1
const MAX_TOTAL = 100

const stepperBtnClass =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 hover:bg-accent disabled:opacity-40'
const stepperValueClass =
  'admin-input flex h-9 w-12 shrink-0 items-center justify-center px-1 text-center text-sm font-semibold tabular-nums'

function CompactNumericStepper({
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled,
  increaseDisabled,
  decreaseLabel,
  increaseLabel,
  editable,
  onValueChange,
  onCommit,
}: {
  value: string
  onDecrease: () => void
  onIncrease: () => void
  decreaseDisabled?: boolean
  increaseDisabled?: boolean
  decreaseLabel: string
  increaseLabel: string
  editable?: boolean
  onValueChange?: (value: string) => void
  onCommit?: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={onDecrease}
        disabled={decreaseDisabled}
        className={stepperBtnClass}
        aria-label={decreaseLabel}
      >
        <Minus className="size-4" />
      </button>
      {editable ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onCommit?.()
            }
          }}
          className={cn(stepperValueClass, '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
        />
      ) : (
        <span className={stepperValueClass}>{value}</span>
      )}
      <button
        type="button"
        onClick={onIncrease}
        disabled={increaseDisabled}
        className={stepperBtnClass}
        aria-label={increaseLabel}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

interface Props {
  userId: number
  customer?: AdminCustomerDTO | null
  totalLimit: number
  devices: AdminDeviceDTO[]
  devicesLoading?: boolean
  onSuccess?: (message?: string) => void
  onError?: (err: unknown) => void
  variant?: 'card' | 'plain'
  compact?: boolean
  deferSave?: boolean
  draftBase?: number
  draftExtra?: number
  onDraftBaseChange?: (value: number) => void
  onDraftExtraChange?: (value: number) => void
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

export function AdminDeviceLimitEditor(props: Props) {
  const {
    userId,
    customer,
    totalLimit,
    devices,
    devicesLoading,
    onSuccess,
    onError,
    variant = 'card',
    deferSave = false,
    compact = false,
  } = props

  const { t, i18n } = useTranslation()
  const setHwid = useAdminUserSetHwidLimit(userId)
  const extraHwid = useAdminUserExtraHwid(userId)
  const deleteDevice = useAdminUserDeleteDevice(userId)

  const connectedCount = devices.length
  const storedExtra = customer?.extra_hwid ?? 0
  const storedActiveExtra = activeExtraHwidSlots(customer)

  const effectiveExtra = deferSave ? (props.draftExtra ?? storedExtra) : storedExtra
  const effectiveBase = deferSave
    ? (props.draftBase ?? baseLimitFromTotal(totalLimit, customer))
    : baseLimitFromTotal(totalLimit, customer)
  const effectiveTotal = deferSave ? effectiveBase + effectiveExtra : totalLimit
  const baseLimit = effectiveBase
  const activeExtra = deferSave ? effectiveExtra : storedActiveExtra

  const dateLocale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'

  const [customBase, setCustomBase] = useState(String(effectiveBase))
  const pending = !deferSave && (setHwid.isPending || extraHwid.isPending)

  useEffect(() => {
    setCustomBase(String(effectiveBase))
  }, [effectiveBase])

  const applyBase = (value: number) => {
    const maxBase = Math.max(MIN_TOTAL, MAX_TOTAL - effectiveExtra)
    const clamped = Math.min(maxBase, Math.max(MIN_TOTAL, value))
    setCustomBase(String(clamped))
    if (deferSave) {
      props.onDraftBaseChange?.(clamped)
      return
    }
    setHwid.mutate(clamped + storedActiveExtra, {
      onSuccess: () => onSuccess?.(),
      onError: (e) => onError?.(e),
    })
  }

  const commitCustomBase = () => {
    const parsed = parseInt(customBase, 10)
    if (Number.isNaN(parsed) || parsed === effectiveBase) {
      setCustomBase(String(effectiveBase))
      return
    }
    applyBase(parsed)
  }

  const adjustExtra = (delta: number) => {
    if (deferSave) {
      const maxExtra = Math.max(0, MAX_TOTAL - effectiveBase)
      const next = Math.max(0, Math.min(maxExtra, effectiveExtra + delta))
      props.onDraftExtraChange?.(next)
      return
    }
    extraHwid.mutate(delta, {
      onSuccess: () => onSuccess?.(),
      onError: (e) => onError?.(e),
    })
  }

  const content = compact ? (
    <div className="space-y-4">
      <div className="p-1">
        <div className="mb-3 flex items-center justify-center gap-2">
          <p className="text-sm font-medium">
            {t('admin.users.subscription.devicesUsage', { used: connectedCount, limit: effectiveTotal })}
          </p>
          {connectedCount >= effectiveTotal && (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
              {t('admin.users.subscription.devicesFull')}
            </span>
          )}
        </div>
        <UsageBar used={connectedCount} limit={effectiveTotal} />
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {[
            { label: t('admin.users.subscription.baseLimit'), value: String(baseLimit) },
            { label: t('admin.users.subscription.extraHwid'), value: `+${activeExtra}` },
            { label: t('admin.users.subscription.totalLimit'), value: String(effectiveTotal), accent: true },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-center',
                accent ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-background/60',
              )}
            >
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className={cn('text-sm font-semibold tabular-nums', accent && 'text-primary')}>{value}</p>
            </div>
          ))}
        </div>
        {storedExtra > 0 && storedActiveExtra === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('admin.users.subscription.extraHwidInactive', { count: storedExtra })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col rounded-xl border border-border/60 p-3 sm:p-4">
          <p className="text-xs font-medium sm:text-sm">
            {deferSave
              ? t('admin.users.subscription.baseLimitTitle')
              : t('admin.users.subscription.totalLimitTitle')}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
            {deferSave
              ? t('admin.users.subscription.baseLimitHint')
              : t('admin.users.subscription.totalLimitHint')}
          </p>
          <div className="mt-auto pt-3">
            <CompactNumericStepper
              value={customBase}
              editable
              onValueChange={setCustomBase}
              onCommit={commitCustomBase}
              onDecrease={() => applyBase(effectiveBase - 1)}
              onIncrease={() => applyBase(effectiveBase + 1)}
              decreaseDisabled={pending || effectiveBase <= MIN_TOTAL}
              increaseDisabled={pending || effectiveBase >= MAX_TOTAL - effectiveExtra}
              decreaseLabel={t('admin.users.subscription.decreaseLimit')}
              increaseLabel={t('admin.users.subscription.increaseLimit')}
            />
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-border/60 p-3 sm:p-4">
          <p className="text-xs font-medium sm:text-sm">{t('admin.users.subscription.extraHwidTitle')}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
            {t('admin.users.subscription.extraHwidHint')}
          </p>
          {customer?.extra_hwid_expires_at && activeExtra > 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
              {t('admin.users.subscription.extraHwidExpires', {
                date: formatAdminDateTime(customer.extra_hwid_expires_at, dateLocale),
              })}
            </p>
          )}
          <div className="mt-auto pt-3">
            <CompactNumericStepper
              value={String(effectiveExtra)}
              onDecrease={() => adjustExtra(-1)}
              onIncrease={() => adjustExtra(1)}
              decreaseDisabled={pending || effectiveExtra <= 0}
              increaseDisabled={pending || effectiveExtra >= MAX_TOTAL - effectiveBase}
              decreaseLabel={t('admin.users.subscription.decreaseExtra')}
              increaseLabel={t('admin.users.subscription.increaseExtra')}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {t('admin.users.subscription.connectedDevices', { count: connectedCount })}
        </p>
        {devicesLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
            {t('admin.users.subscription.noDevices')}
          </p>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d.hwid} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                    <DevicePlatformIcon platform={d.platform} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{d.hwid}</p>
                    <p className="mt-0.5 text-sm">
                      {[d.platform, d.device_model].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
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
                  className="shrink-0 rounded-lg border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : (
    <>
      <div className={cn(variant === 'card' ? 'rounded-xl border border-border/60 bg-muted/20 p-4' : '')}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            {t('admin.users.subscription.devicesUsage', { used: connectedCount, limit: effectiveTotal })}
          </p>
          {connectedCount >= effectiveTotal && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              {t('admin.users.subscription.devicesFull')}
            </span>
          )}
        </div>
        <UsageBar used={connectedCount} limit={effectiveTotal} />

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: t('admin.users.subscription.baseLimit'), value: baseLimit, accent: false },
            { label: t('admin.users.subscription.extraHwid'), value: `+${activeExtra}`, accent: activeExtra > 0 },
            { label: t('admin.users.subscription.totalLimit'), value: effectiveTotal, accent: true },
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
        {storedExtra > 0 && storedActiveExtra === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('admin.users.subscription.extraHwidInactive', { count: storedExtra })}
          </p>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <p className="text-sm font-medium">
            {deferSave
              ? t('admin.users.subscription.baseLimitTitle')
              : t('admin.users.subscription.totalLimitTitle')}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {deferSave
              ? t('admin.users.subscription.baseLimitHint')
              : t('admin.users.subscription.totalLimitHint')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyBase(effectiveBase - 1)}
            disabled={pending || effectiveBase <= MIN_TOTAL}
            className="inline-flex size-10 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-40"
            aria-label={t('admin.users.subscription.decreaseLimit')}
          >
            <Minus className="size-4" />
          </button>
          <input
            type="number"
            min={MIN_TOTAL}
            max={MAX_TOTAL - effectiveExtra}
            value={customBase}
            onChange={(e) => setCustomBase(e.target.value)}
            onBlur={commitCustomBase}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitCustomBase()
              }
            }}
            className="admin-input w-20 px-3 py-2 text-center text-sm font-semibold tabular-nums"
          />
          <button
            type="button"
            onClick={() => applyBase(effectiveBase + 1)}
            disabled={pending || effectiveBase >= MAX_TOTAL - effectiveExtra}
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
              disabled={pending || effectiveExtra <= 0}
              className="inline-flex size-10 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-40"
              aria-label={t('admin.users.subscription.decreaseExtra')}
            >
              <Minus className="size-4" />
            </button>
            <span className="min-w-[2rem] text-center text-lg font-semibold tabular-nums">
              {effectiveExtra}
            </span>
            <button
              type="button"
              onClick={() => adjustExtra(1)}
              disabled={pending || effectiveExtra >= MAX_TOTAL - effectiveBase}
              className="inline-flex size-10 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-40"
              aria-label={t('admin.users.subscription.increaseExtra')}
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {!deferSave && extraHwid.isPending && (
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
    </>
  )

  if (variant === 'plain') {
    return <div className={cn('space-y-0', compact && 'admin-device-editor--compact')}>{content}</div>
  }

  return (
    <AdminSectionCard
      title={t('admin.users.subscription.devicesTitle')}
      description={t('admin.users.subscription.devicesHint')}
      icon={Smartphone}
      iconAccent="cyan"
    >
      {content}
    </AdminSectionCard>
  )
}
