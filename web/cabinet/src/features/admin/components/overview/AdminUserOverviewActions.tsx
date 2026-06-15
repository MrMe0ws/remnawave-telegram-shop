import { useTranslation } from 'react-i18next'
import {
  CalendarPlus,
  Power,
  PowerOff,
  Trash2,
  Loader2,
} from 'lucide-react'

import { cn } from '@/lib/utils'

interface Props {
  hasRwUser: boolean
  rwStatus?: string
  onExtend: () => void
  onDisable: () => void
  onEnable: () => void
  onDelete: () => void
  disablePending?: boolean
  enablePending?: boolean
}

export function AdminUserOverviewActions({
  hasRwUser,
  rwStatus,
  onExtend,
  onDisable,
  onEnable,
  onDelete,
  disablePending,
  enablePending,
}: Props) {
  const { t } = useTranslation()
  const isActive = rwStatus?.toUpperCase() === 'ACTIVE'

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onExtend}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
          'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
        )}
      >
        <CalendarPlus className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        {t('admin.users.extend')}
      </button>
      {hasRwUser && (
        isActive ? (
          <button
            type="button"
            onClick={onDisable}
            disabled={disablePending}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50',
              'border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-400',
            )}
          >
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
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50',
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
        )
      )}
      {!hasRwUser && (
        <p className="w-full rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t('admin.users.subscription.noRwUser')}
        </p>
      )}
      <button
        type="button"
        onClick={onDelete}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
          'border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-400',
        )}
      >
        <Trash2 className="size-4 shrink-0" />
        {t('admin.users.delete')}
      </button>
    </div>
  )
}
