import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gauge, RotateCcw } from 'lucide-react'

import { AdminModal } from '../AdminModal'
import { AdminModalSaveFooter } from '../AdminModalSaveFooter'
import { AdminConfirmModal } from '../AdminConfirmModal'
import { cn } from '@/lib/utils'
import { formatAdminApiError } from '../../utils/formatAdminApiError'
import {
  useAdminUserSetTraffic,
  useAdminUserSetStrategy,
  useAdminUserResetTraffic,
  type AdminUserPanelResponse,
} from '../../hooks/useAdminUsers'
import { trafficStrategyLabel } from './strategyLabels'

const GB = 1024 * 1024 * 1024

interface Props {
  open: boolean
  onClose: () => void
  userId: number
  panel: AdminUserPanelResponse
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function AdminUserTrafficModal({
  open,
  onClose,
  userId,
  panel,
  onSuccess,
  onError,
}: Props) {
  const { t } = useTranslation()
  const rw = panel.rw!
  const setTraffic = useAdminUserSetTraffic(userId)
  const setStrategy = useAdminUserSetStrategy(userId)
  const resetTraffic = useAdminUserResetTraffic(userId)

  const [draftBytes, setDraftBytes] = useState(rw.traffic_limit_bytes)
  const [draftStrategy, setDraftStrategy] = useState(rw.traffic_limit_strategy)
  const [customTrafficGB, setCustomTrafficGB] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const isPending = setTraffic.isPending || setStrategy.isPending

  useEffect(() => {
    if (open) {
      setDraftBytes(rw.traffic_limit_bytes)
      setDraftStrategy(rw.traffic_limit_strategy)
      setCustomTrafficGB(rw.traffic_limit_bytes > 0 ? String(rw.traffic_limit_bytes / GB) : '0')
      setError(null)
      setConfirmReset(false)
    }
  }, [open, rw.traffic_limit_bytes, rw.traffic_limit_strategy])

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleSave = async () => {
    setError(null)
    try {
      const trafficChanged = draftBytes !== rw.traffic_limit_bytes
      const strategyChanged = draftStrategy !== rw.traffic_limit_strategy

      if (trafficChanged) {
        await setTraffic.mutateAsync(draftBytes)
      }
      if (strategyChanged) {
        await setStrategy.mutateAsync(draftStrategy)
      }

      if (trafficChanged || strategyChanged) {
        onSuccess?.(t('admin.feedback.saved'))
      }
      handleClose()
    } catch (e) {
      const msg = formatAdminApiError(e, t)
      setError(msg)
      onError?.(msg)
    }
  }

  const handleResetTraffic = () => {
    resetTraffic.mutate(undefined, {
      onSuccess: () => {
        setConfirmReset(false)
        onSuccess?.(t('admin.feedback.resetTrafficSuccess'))
      },
      onError: (e) => {
        const msg = formatAdminApiError(e, t)
        setError(msg)
        onError?.(msg)
        setConfirmReset(false)
      },
    })
  }

  const hasChanges =
    draftBytes !== rw.traffic_limit_bytes || draftStrategy !== rw.traffic_limit_strategy

  return (
    <>
      <AdminModal
        open={open}
        onClose={handleClose}
        title={t('admin.users.subscription.traffic')}
        icon={Gauge}
        iconAccent="blue"
        panelClassName="sm:max-w-lg"
        footer={
          <AdminModalSaveFooter
            onCancel={handleClose}
            onSave={() => void handleSave()}
            isPending={isPending}
            saveDisabled={!hasChanges}
          />
        }
      >
        <div className="space-y-5">
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">{t('admin.users.subscription.traffic')}</p>
            <div className="flex flex-wrap gap-2">
              {panel.traffic_presets_gb.map((gb) => {
                const bytes = gb * GB
                return (
                  <button
                    key={gb}
                    type="button"
                    onClick={() => {
                      setDraftBytes(bytes)
                      setCustomTrafficGB(String(gb))
                    }}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent',
                      draftBytes === bytes && 'border-primary bg-primary/10 text-primary',
                    )}
                  >
                    {t('admin.users.subscription.trafficPreset', { value: gb })}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input
                type="number"
                min={0}
                step={0.1}
                value={customTrafficGB}
                onChange={(e) => {
                  setCustomTrafficGB(e.target.value)
                  const parsed = parseFloat(e.target.value)
                  if (!Number.isNaN(parsed)) {
                    setDraftBytes(Math.round(parsed * GB))
                  }
                }}
                placeholder={t('admin.users.subscription.gbUnit')}
                className="admin-input w-28 px-3 py-2"
              />
              <span className="pb-2 text-sm text-muted-foreground">{t('admin.users.subscription.gbUnit')}</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t('admin.users.subscription.strategy')}</p>
            <div className="flex flex-wrap gap-2">
              {panel.strategies.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDraftStrategy(s)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent',
                    draftStrategy === s && 'border-primary bg-primary/10 text-primary',
                  )}
                >
                  {trafficStrategyLabel(s, t)}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50 pt-4">
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={resetTraffic.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-500/15 disabled:opacity-50 dark:text-orange-400"
            >
              <RotateCcw className="size-4 shrink-0" />
              {t('admin.users.resetTraffic')}
            </button>
          </div>
        </div>
      </AdminModal>

      <AdminConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleResetTraffic}
        title={t('admin.users.resetTraffic')}
        message={t('admin.users.resetTrafficConfirm')}
        loading={resetTraffic.isPending}
        icon={RotateCcw}
        iconAccent="orange"
      />
    </>
  )
}
