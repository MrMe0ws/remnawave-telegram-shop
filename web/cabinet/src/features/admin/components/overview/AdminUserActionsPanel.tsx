import { useTranslation } from 'react-i18next'
import { CalendarPlus, Check, Copy, Loader2, Power, PowerOff, Trash2 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const actionClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-50 dark:shadow-none'

interface Props {
  hasRwUser: boolean
  rwStatus?: string
  onExtend: () => void
  onDisable: () => void
  onEnable: () => void
  onDelete: () => void
  disablePending?: boolean
  enablePending?: boolean
  copy: { available: boolean; copied: boolean; failed: boolean; copy: () => void }
}

/**
 * Колонка действий.
 *
 * Порядок и вес — по риску, а не по алфавиту: продление сверху и подсвечено,
 * обратимые действия рядом, необратимое — в отдельной рамке внизу с
 * объяснением последствий. Раньше «Продлить», «Отключить» и «Удалить» стояли в
 * один ряд одинаковыми кнопками, и две из них были красными.
 */
export function AdminUserActionsPanel({
  hasRwUser,
  rwStatus,
  onExtend,
  onDisable,
  onEnable,
  onDelete,
  disablePending,
  enablePending,
  copy,
}: Props) {
  const { t } = useTranslation()
  const isActive = rwStatus?.toUpperCase() === 'ACTIVE'

  return (
    <Card className="cabinet-elevated-card p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75">
        {t('admin.actions')}
      </h2>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onExtend}
          className={cn(
            actionClass,
            'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
          )}
        >
          <CalendarPlus className="size-4 shrink-0" />
          {t('admin.users.extend')}
        </button>

        {copy.available && (
          <button type="button" onClick={copy.copy} className={actionClass}>
            {copy.copied ? (
              <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="size-4 shrink-0" />
            )}
            {copy.copied ? t('admin.users.copyLinkSuccess') : t('admin.users.copySubscriptionLink')}
          </button>
        )}

        {hasRwUser &&
          (isActive ? (
            <button type="button" onClick={onDisable} disabled={disablePending} className={actionClass}>
              {disablePending ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <PowerOff className="size-4 shrink-0" />
              )}
              {t('admin.users.disable')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnable}
              disabled={enablePending}
              className={cn(
                actionClass,
                'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
              )}
            >
              {enablePending ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <Power className="size-4 shrink-0" />
              )}
              {t('admin.users.enable')}
            </button>
          ))}
      </div>

      {copy.failed && <p className="mt-2 text-xs text-destructive">{t('admin.users.copyLinkError')}</p>}

      <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-destructive">
          {t('admin.users.overview.dangerZone')}
        </p>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          {t('admin.users.overview.dangerZoneHint')}
        </p>
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            actionClass,
            'mt-2.5 border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10',
          )}
        >
          <Trash2 className="size-4 shrink-0" />
          {t('admin.users.delete')}
        </button>
      </div>
    </Card>
  )
}
