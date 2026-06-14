import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { AdminModal } from './AdminModal'
import type { AdminSectionIconAccent } from '../utils/adminSectionIconAccents'

interface AdminConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
  icon?: LucideIcon
  iconAccent?: AdminSectionIconAccent
}

export function AdminConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  loading = false,
  icon: Icon = AlertTriangle,
  iconAccent = 'amber',
}: AdminConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      icon={Icon}
      iconAccent={variant === 'destructive' ? 'rose' : iconAccent}
      panelClassName="sm:max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {cancelLabel ?? t('admin.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50',
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel ?? t('admin.confirm')}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
    </AdminModal>
  )
}
