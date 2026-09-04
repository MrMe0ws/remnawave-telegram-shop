import { useTranslation } from 'react-i18next'
import { CalendarPlus, Check, Share2, Shield } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Props {
  onExtend: () => void
  onOpenActions: () => void
  copy: { available: boolean; copied: boolean; copy: () => void }
}

/**
 * Нижняя панель действий на телефоне.
 *
 * На узком экране колонка действий не помещается, а прятать продление в
 * «три точки» — значит прятать самое частое действие админа. Поэтому здесь
 * липкая панель: продление под большим пальцем, остальное — в шторке.
 */
export function AdminUserMobileActionBar({ onExtend, onOpenActions, copy }: Props) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-3 mt-1 flex gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden',
        'bg-gradient-to-t from-background from-65% to-transparent',
      )}
    >
      <button
        type="button"
        onClick={onExtend}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2.5 text-sm font-medium text-emerald-700 backdrop-blur dark:text-emerald-400"
      >
        <CalendarPlus className="size-4 shrink-0" />
        {t('admin.users.extend')}
      </button>
      {copy.available && (
        <button
          type="button"
          onClick={copy.copy}
          aria-label={t('admin.users.copySubscriptionLink')}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm shadow-sm backdrop-blur dark:shadow-none"
        >
          {copy.copied ? (
            <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Share2 className="size-4 shrink-0" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onOpenActions}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm font-medium shadow-sm backdrop-blur dark:shadow-none"
      >
        <Shield className="size-4 shrink-0" />
        {t('admin.users.overview.more')}
      </button>
    </div>
  )
}
