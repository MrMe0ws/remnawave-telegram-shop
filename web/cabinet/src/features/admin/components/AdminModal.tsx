import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rwIconToneClassNames, type RwIconTone } from '../utils/rwStatusStyles'
import {
  adminSectionIconAccentClassNames,
  type AdminSectionIconAccent,
} from '../utils/adminSectionIconAccents'

interface AdminModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  panelClassName?: string
  bodyClassName?: string
  icon?: LucideIcon
  iconTone?: RwIconTone
  iconAccent?: AdminSectionIconAccent
}

export function AdminModal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  panelClassName,
  bodyClassName,
  icon: Icon,
  iconTone = 'default',
  iconAccent,
}: AdminModalProps) {
  const { t } = useTranslation()

  const iconStyles =
    iconTone !== 'default'
      ? rwIconToneClassNames(iconTone)
      : iconAccent
        ? adminSectionIconAccentClassNames(iconAccent)
        : rwIconToneClassNames('default')

  useEffect(() => {
    if (!open) return
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onEsc)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm',
        'sm:items-center sm:p-4',
        className,
      )}
      onClick={onClose}
    >
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'cabinet-elevated-card admin-modal-panel flex max-h-[min(92dvh,100%)] w-full flex-col overflow-hidden',
            'rounded-b-none rounded-t-2xl sm:max-w-md sm:rounded-xl',
            panelClassName,
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {Icon && (
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    iconStyles.boxClassName,
                  )}
                >
                  <Icon className={cn('size-4', iconStyles.iconClassName)} />
                </div>
              )}
              <h3 className="min-w-0 truncate text-lg font-semibold leading-tight">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-accent"
              aria-label={t('common.close')}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto p-5', bodyClassName)}>{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-border/70 bg-muted/25 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-secondary/25">
              {footer}
            </div>
          )}
        </div>
    </div>,
    document.body,
  )
}
