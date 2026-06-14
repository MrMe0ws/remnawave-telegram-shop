import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  Gauge,
  Layers,
  FileText,
  Zap,
  Loader2,
  Save,
  RotateCcw,
} from 'lucide-react'

import { AdminSectionCard } from './AdminSectionCard'
import { AdminCheckbox } from './AdminCheckbox'
import { AdminDeviceLimitEditor } from './AdminDeviceLimitEditor'
import { AdminFeedback } from './AdminFeedback'
import { cn } from '@/lib/utils'
import { formatAdminApiError } from '../utils/formatAdminApiError'
import {
  useAdminUserPanel,
  useAdminUserDevices,
  useAdminUserSetSquads,
  useAdminUserSetTraffic,
  useAdminUserSetStrategy,
  useAdminUserSetDescription,
  useAdminUserSetTariff,
  type AdminSquadDTO,
  type AdminUserPanelResponse,
} from '../hooks/useAdminUsers'

const GB = 1024 * 1024 * 1024

const STRATEGY_KEYS: Record<string, string> = {
  DAY: 'admin.users.subscription.strategies.day',
  WEEK: 'admin.users.subscription.strategies.week',
  MONTH: 'admin.users.subscription.strategies.month',
  MONTH_ROLLING: 'admin.users.subscription.strategies.monthRolling',
  NO_RESET: 'admin.users.subscription.strategies.noReset',
}

function normalizeSquads(squads?: AdminSquadDTO[] | null): AdminSquadDTO[] {
  return squads ?? []
}

interface Props {
  userId: number
  panel?: AdminUserPanelResponse
  panelLoading?: boolean
  panelError?: boolean
}

export function AdminUserSubscriptionPanel({ userId, panel: panelProp, panelLoading, panelError }: Props) {
  const { t } = useTranslation()
  const internalPanel = useAdminUserPanel(panelProp === undefined ? userId : null)
  const panel = panelProp ?? internalPanel.data
  const isLoading = panelProp === undefined ? internalPanel.isLoading : (panelLoading ?? false)
  const isError = panelProp === undefined ? internalPanel.isError : (panelError ?? false)
  const { data: devicesData, isLoading: devicesLoading } = useAdminUserDevices(userId)

  const setSquads = useAdminUserSetSquads(userId)
  const setTraffic = useAdminUserSetTraffic(userId)
  const setStrategy = useAdminUserSetStrategy(userId)
  const setDescriptionMut = useAdminUserSetDescription(userId)
  const setTariff = useAdminUserSetTariff(userId)

  const strategyLabel = (s: string) => {
    const key = STRATEGY_KEYS[s]
    return key ? t(key) : s
  }

  const [selectedSquads, setSelectedSquads] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [customTrafficGB, setCustomTrafficGB] = useState('')

  const rw = panel?.rw
  const customer = panel?.customer

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const onMutError = (err: unknown) => {
    setActionSuccess(null)
    setActionError(formatAdminApiError(err, t))
  }

  const onMutSuccess = (message?: string) => {
    setActionError(null)
    setActionSuccess(message ?? t('admin.feedback.saved'))
  }

  useEffect(() => {
    setActionError(null)
    setActionSuccess(null)
  }, [userId])

  const squadKey = normalizeSquads(rw?.active_squads).map((s) => s.uuid).sort().join(',')

  useEffect(() => {
    if (rw) {
      setSelectedSquads(normalizeSquads(rw.active_squads).map((s) => s.uuid))
      setDescription(rw.description ?? '')
      setCustomTrafficGB(rw.traffic_limit_bytes > 0 ? String(rw.traffic_limit_bytes / GB) : '0')
    }
  }, [rw?.uuid, rw?.description, rw?.traffic_limit_bytes, squadKey])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !panel) {
    return (
      <AdminSectionCard title={t('admin.users.subscription.title')} icon={Activity}>
        <p className="text-sm text-destructive">{t('admin.users.subscription.loadError')}</p>
      </AdminSectionCard>
    )
  }

  if (!panel.has_rw_user || !rw) {
    return null
  }

  const toggleSquad = (uuid: string) => {
    setSelectedSquads((prev) =>
      prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid],
    )
  }

  const saveSquads = () => setSquads.mutate(selectedSquads, { onSuccess: () => onMutSuccess(), onError: onMutError })

  return (
    <div className="space-y-4">
      <AdminFeedback
        feedback={
          actionSuccess
            ? { type: 'success', message: actionSuccess }
            : actionError
              ? { type: 'error', message: actionError }
              : null
        }
        onDismiss={() => {
          setActionSuccess(null)
          setActionError(null)
        }}
      />

      <AdminDeviceLimitEditor
        userId={userId}
        customer={customer}
        totalLimit={rw.hwid_device_limit ?? 1}
        devices={devicesData?.items ?? []}
        devicesLoading={devicesLoading}
        onSuccess={onMutSuccess}
        onError={onMutError}
      />

      <AdminSectionCard title={t('admin.users.subscription.traffic')} icon={Gauge} iconAccent="blue">
        <div className="flex flex-wrap gap-2">
          {panel.traffic_presets_gb.map((gb) => (
            <button
              key={gb}
              onClick={() => setTraffic.mutate(gb * GB, { onSuccess: () => onMutSuccess(), onError: onMutError })}
              disabled={setTraffic.isPending}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent',
                rw.traffic_limit_bytes === gb * GB && 'border-primary bg-primary/10 text-primary',
              )}
            >
              {t('admin.users.subscription.trafficPreset', { value: gb })}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            type="number"
            min={0}
            step={0.1}
            value={customTrafficGB}
            onChange={(e) => setCustomTrafficGB(e.target.value)}
            placeholder={t('admin.users.subscription.gbUnit')}
            className="admin-input w-28 px-3 py-2"
          />
          <button
            onClick={() => setTraffic.mutate(Math.round(parseFloat(customTrafficGB || '0') * GB), { onSuccess: () => onMutSuccess(), onError: onMutError })}
            disabled={setTraffic.isPending}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-accent"
          >
            {t('admin.users.subscription.applyCustom')}
          </button>
        </div>
      </AdminSectionCard>

      <AdminSectionCard title={t('admin.users.subscription.strategy')} icon={RotateCcw} iconAccent="violet">
        <div className="flex flex-wrap gap-2">
          {panel.strategies.map((s) => (
            <button
              key={s}
              onClick={() => setStrategy.mutate(s, { onSuccess: () => onMutSuccess(), onError: onMutError })}
              disabled={setStrategy.isPending}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent',
                rw.traffic_limit_strategy === s && 'border-primary bg-primary/10 text-primary',
              )}
            >
              {strategyLabel(s)}
            </button>
          ))}
        </div>
      </AdminSectionCard>

      {panel.available_squads.length > 0 && (
        <AdminSectionCard
          title={t('admin.users.subscription.squads')}
          icon={Layers}
          iconAccent="indigo"
          headerRight={
            <button
              onClick={saveSquads}
              disabled={setSquads.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {setSquads.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {t('admin.save')}
            </button>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {panel.available_squads.map((sq: AdminSquadDTO) => (
              <label
                key={sq.uuid}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                  selectedSquads.includes(sq.uuid)
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/50 hover:bg-accent/50',
                )}
              >
                <AdminCheckbox
                  checked={selectedSquads.includes(sq.uuid)}
                  onChange={() => toggleSquad(sq.uuid)}
                  aria-label={sq.name}
                />
                <span className="truncate">{sq.name}</span>
              </label>
            ))}
          </div>
        </AdminSectionCard>
      )}

      {panel.tariffs && panel.tariffs.length > 0 && (
        <AdminSectionCard title={t('admin.users.subscription.tariff')} icon={Zap} iconAccent="teal">
          <div className="flex flex-wrap gap-2">
            {panel.tariffs.map((tariff) => (
              <button
                key={tariff.id}
                onClick={() => setTariff.mutate(tariff.id, { onSuccess: () => onMutSuccess(), onError: onMutError })}
                disabled={setTariff.isPending}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent',
                  customer?.current_tariff_id === tariff.id && 'border-primary bg-primary/10 text-primary',
                )}
              >
                {tariff.name}
              </button>
            ))}
          </div>
        </AdminSectionCard>
      )}

      <AdminSectionCard title={t('admin.users.subscription.description')} icon={FileText} iconAccent="slate">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="admin-input w-full resize-y px-3 py-2"
        />
        <button
          onClick={() => setDescriptionMut.mutate(description.trim() || null, { onSuccess: () => onMutSuccess(), onError: onMutError })}
          disabled={setDescriptionMut.isPending}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {setDescriptionMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t('admin.save')}
        </button>
      </AdminSectionCard>
    </div>
  )
}
