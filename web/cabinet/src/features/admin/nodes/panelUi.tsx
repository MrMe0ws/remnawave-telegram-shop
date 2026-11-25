import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, TriangleAlert } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { AdminModal } from '../components/AdminModal'
import type { AdminSectionIconAccent } from '../utils/adminSectionIconAccents'
import type { LucideIcon } from 'lucide-react'

/**
 * Общие мелочи боковых панелей окна ноды.
 */

/** Поле ввода: тот же вид, что у полей окна ноды. */
export const PANEL_INPUT =
  'h-10 w-full min-w-0 rounded-[10px] border border-input bg-card dark:bg-background/60 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60'

export const PANEL_CAP = 'text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground'

/** Кнопка-иконка в шапке панели (обновить и т.п.). */
export function HeaderIconButton({
  label,
  onClick,
  busy,
  icon: Icon = RefreshCw,
}: {
  label: string
  onClick: () => void
  busy?: boolean
  icon?: LucideIcon
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={busy}
      className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60"
    >
      <Icon className={cn('size-4', busy && 'animate-spin')} aria-hidden />
    </button>
  )
}

/** Заглушка загрузки: несколько мерцающих строк. */
export function PanelSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl border border-border/60 bg-muted/40" />
      ))}
    </div>
  )
}

export function PanelError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <p className="text-sm text-muted-foreground">{message ?? t('admin.nodes.panels.loadError')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-secondary"
      >
        <RefreshCw className="size-4" aria-hidden />
        {t('admin.nodes.panels.retry')}
      </button>
    </div>
  )
}

export function PanelEmpty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm font-semibold text-muted-foreground">
      <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-5" aria-hidden />
      </span>
      {children}
    </div>
  )
}

/**
 * Небольшое окно поверх боковой панели. Панель стоит на z-[210], обычный AdminModal — на z-[200]
 * и спрятался бы под ней, поэтому поднимаем его выше.
 */
export function PanelDialog({
  open,
  onClose,
  title,
  icon,
  iconAccent,
  footer,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  icon?: LucideIcon
  iconAccent?: AdminSectionIconAccent
  footer?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      icon={icon}
      iconAccent={iconAccent}
      className="z-[230]"
      size={wide ? 'md' : 'sm'}
      footer={footer}
    >
      {children}
    </AdminModal>
  )
}

/** Подтверждение поверх боковой панели (аналог AdminConfirmModal). */
export function PanelConfirm({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  loading?: boolean
}) {
  return (
    <PanelDialog
      open={open}
      onClose={onClose}
      title={title}
      icon={TriangleAlert}
      iconAccent={destructive ? 'rose' : 'amber'}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50',
              destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
              loading && '!opacity-100',
            )}
          >
            {loading && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
    </PanelDialog>
  )
}
