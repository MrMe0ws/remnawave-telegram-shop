import { useTranslation } from 'react-i18next'
import {
  CalendarPlus,
  Power,
  PowerOff,
  Trash2,
  Loader2,
  Shield,
  type LucideIcon,
} from 'lucide-react'

import { AdminModal } from '../AdminModal'
import { cn } from '@/lib/utils'

interface ActionItem {
  key: string
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
  pending?: boolean
  variant?: 'default' | 'success' | 'danger'
}

interface Props {
  open: boolean
  onClose: () => void
  hasRwUser: boolean
  rwStatus?: string
  onExtend: () => void
  onDisable: () => void
  onEnable: () => void
  onDelete: () => void
  disablePending?: boolean
  enablePending?: boolean
}

const variantClasses: Record<NonNullable<ActionItem['variant']>, string> = {
  default: 'border hover:bg-accent',
  success:
    'border border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
  danger:
    'border border-red-500/40 bg-red-500/10 font-medium text-red-700 hover:bg-red-500/15 dark:text-red-400',
}

export function AdminUserActionsModal({
  open,
  onClose,
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

  const actions: ActionItem[] = [
    {
      key: 'extend',
      label: t('admin.users.extend'),
      icon: CalendarPlus,
      onClick: () => {
        onClose()
        onExtend()
      },
      variant: 'success',
    },
    ...(hasRwUser
      ? isActive
        ? [{
            key: 'disable',
            label: t('admin.users.disable'),
            icon: PowerOff,
            onClick: () => {
              onClose()
              onDisable()
            },
            pending: disablePending,
            variant: 'danger' as const,
          }]
        : [{
            key: 'enable',
            label: t('admin.users.enable'),
            icon: Power,
            onClick: () => {
              onClose()
              onEnable()
            },
            pending: enablePending,
            variant: 'success' as const,
          }]
      : []),
    {
      key: 'delete',
      label: t('admin.users.delete'),
      icon: Trash2,
      onClick: () => {
        onClose()
        onDelete()
      },
      variant: 'danger',
    },
  ]

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={t('admin.users.actionsModal.title')}
      icon={Shield}
      iconAccent="indigo"
      panelClassName="sm:max-w-sm"
    >
      <div className="grid gap-2">
        {!hasRwUser && (
          <p className="mb-1 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            {t('admin.users.subscription.noRwUser')}
          </p>
        )}
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled || action.pending}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm disabled:opacity-50',
              variantClasses[action.variant ?? 'default'],
              action.variant === 'default' && '[&_svg]:text-primary',
            )}
          >
            {action.pending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
              <action.icon className="size-4 shrink-0" />
            )}
            {action.label}
          </button>
        ))}
      </div>
    </AdminModal>
  )
}
