import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Server, UserCheck, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { surface } from './Surface'
import { AdminModal } from './AdminModal'
import { AdminConfirmModal } from './AdminConfirmModal'
import {
  useAdminTariffSquads,
  useAdminTariffSquadsApply,
  type AdminSquadItem,
} from '../hooks/useAdminTariffs'

/** Режим применения состава к тем, кто уже на тарифе. */
type ApplyMode = 'add' | 'strict'

function squadNames(uuids: string[], squads: AdminSquadItem[]): string[] {
  return uuids.map((u) => squads.find((s) => s.uuid === u)?.name ?? u)
}

function SquadChips({ uuids, squads, tone }: { uuids: string[]; squads: AdminSquadItem[]; tone: 'add' | 'remove' }) {
  if (uuids.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {squadNames(uuids, squads).map((name) => (
        <span
          key={name}
          className={cn(
            'rounded-md px-2 py-0.5 text-xs',
            tone === 'add'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
          )}
        >
          {tone === 'add' ? '+ ' : '− '}
          {name}
        </span>
      ))}
    </div>
  )
}

interface ApplyPanelProps {
  tariffId: number
  squads: AdminSquadItem[]
  /** Форма изменена: применять сохранённый состав в этот момент — обманывать админа. */
  dirty: boolean
}

/**
 * Блок «применить состав к действующим» во вкладке «Серверы».
 *
 * Отдельная кнопка, а не только диалог при сохранении: если применение упало
 * на середине (панель отвалилась), состояние чинится повторным запуском, а не
 * ожиданием, пока все продлятся.
 */
export function AdminTariffSquadsApplyPanel({ tariffId, squads, dirty }: ApplyPanelProps) {
  const { t } = useTranslation()
  const [confirmMode, setConfirmMode] = useState<ApplyMode | null>(null)

  const { data } = useAdminTariffSquads(tariffId, true)
  const apply = useAdminTariffSquadsApply()
  const run = data?.run ?? null
  const running = run?.status === 'running'
  const tariffSquads = data?.tariff_squads ?? []
  const strictRemove = squads.map((s) => s.uuid).filter((u) => !tariffSquads.includes(u))

  const submit = (mode: ApplyMode) => {
    apply.mutate({
      id: tariffId,
      add: tariffSquads,
      remove: mode === 'strict' ? strictRemove : [],
    })
    setConfirmMode(null)
  }

  const busy = running || apply.isPending
  const disabled = dirty || busy || tariffSquads.length === 0

  return (
    <div className={surface('raised', 'mt-4 rounded-xl p-3')}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4 text-muted-foreground" />
        {t('admin.tariffs.squadsApply.title')}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {data
          ? data.active_count > 0
            ? t('admin.tariffs.squadsApply.activeCount', { count: data.active_count })
            : t('admin.tariffs.squadsApply.noActive')
          : t('admin.loading')}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirmMode('add')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
          {t('admin.tariffs.squadsApply.addMissing')}
        </button>
        <button
          type="button"
          disabled={disabled || strictRemove.length === 0}
          onClick={() => setConfirmMode('strict')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <Server className="h-3.5 w-3.5" />
          {t('admin.tariffs.squadsApply.strict')}
        </button>
      </div>

      {dirty && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{t('admin.tariffs.squadsApply.dirtyHint')}</p>}

      {apply.isError && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{(apply.error as Error).message}</p>
      )}

      {run && (
        <div className="mt-3 space-y-1 text-xs">
          {running ? (
            <p className="text-muted-foreground">
              {t('admin.tariffs.squadsApply.running', { processed: run.processed, total: run.total })}
            </p>
          ) : (
            <p className={run.status === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}>
              {run.status === 'failed'
                ? t('admin.tariffs.squadsApply.runFailed', { error: run.error ?? '' })
                : t('admin.tariffs.squadsApply.runDone', {
                    changed: run.changed,
                    already: run.already_ok,
                  })}
            </p>
          )}
          {(run.not_found > 0 || run.failed > 0) && (
            <p className="text-amber-600 dark:text-amber-400">
              {t('admin.tariffs.squadsApply.runProblems', { notFound: run.not_found, failed: run.failed })}
            </p>
          )}
        </div>
      )}

      <AdminConfirmModal
        open={confirmMode !== null}
        onClose={() => setConfirmMode(null)}
        onConfirm={() => confirmMode && submit(confirmMode)}
        title={t('admin.tariffs.squadsApply.title')}
        variant={confirmMode === 'strict' ? 'destructive' : 'default'}
        confirmLabel={t('admin.tariffs.squadsApply.confirmButton')}
        message={
          <div className="space-y-2">
            <p>
              {confirmMode === 'strict'
                ? t('admin.tariffs.squadsApply.confirmStrict', { count: data?.active_count ?? 0 })
                : t('admin.tariffs.squadsApply.confirmAdd', { count: data?.active_count ?? 0 })}
            </p>
            <SquadChips uuids={tariffSquads} squads={squads} tone="add" />
            {confirmMode === 'strict' && <SquadChips uuids={strictRemove} squads={squads} tone="remove" />}
          </div>
        }
      />
    </div>
  )
}

interface SaveDialogProps {
  open: boolean
  onClose: () => void
  /** Сохранить и применить дифф всем, кто уже на тарифе. */
  onApplyAll: () => void
  /** Сохранить, ничего не трогая: действующие получат состав при продлении. */
  onOnlyNew: () => void
  added: string[]
  removed: string[]
  squads: AdminSquadItem[]
  activeCount: number
  loading: boolean
}

/**
 * Диалог при сохранении тарифа с изменённым составом сквадов.
 *
 * Выбор осознанно отдан админу: добавление сервера почти всегда хотят раздать
 * сразу, а снятие — оставить до конца оплаченного периода.
 */
export function AdminTariffSquadsSaveDialog({
  open,
  onClose,
  onApplyAll,
  onOnlyNew,
  added,
  removed,
  squads,
  activeCount,
  loading,
}: SaveDialogProps) {
  const { t } = useTranslation()

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={t('admin.tariffs.squadsApply.saveTitle')}
      description={t('admin.tariffs.squadsApply.activeCount', { count: activeCount })}
      icon={Users}
      iconAccent="amber"
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {t('admin.cancel')}
          </button>
          <button
            type="button"
            onClick={onOnlyNew}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t('admin.tariffs.squadsApply.onlyNew')}
          </button>
          <button
            type="button"
            onClick={onApplyAll}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('admin.tariffs.squadsApply.applyAll', { count: activeCount })}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <SquadChips uuids={added} squads={squads} tone="add" />
        <SquadChips uuids={removed} squads={squads} tone="remove" />
        <p className="text-xs text-muted-foreground">{t('admin.tariffs.squadsApply.saveHint')}</p>
      </div>
    </AdminModal>
  )
}
