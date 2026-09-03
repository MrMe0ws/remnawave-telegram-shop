import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ConfirmModalProps = {
  open: boolean
  title: string
  /** Пояснение под заголовком: чем именно закончится действие. */
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** danger — красная кнопка подтверждения и красный бейдж иконки. */
  tone?: 'danger' | 'default'
  icon?: LucideIcon
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Общая модалка подтверждения кабинета: портал, фейд оверлея и подъём карточки,
 * бейдж с иконкой и пара кнопок в один ряд — подтверждение слева, отмена справа.
 * Заменяет разрозненные inline-диалоги (выход, удаление устройства, отвязка провайдера).
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  icon: Icon = AlertTriangle,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Кадр задержки: без него переход стартует с уже конечных значений.
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    return undefined
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, loading, onClose])

  useEffect(() => {
    if (visible) confirmRef.current?.focus()
  }, [visible])

  if (!mounted || typeof document === 'undefined') return null

  const danger = tone === 'danger'

  return createPortal(
    <div
      role="presentation"
      className={cn(
        'fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity duration-200 ease-out',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      onClick={() => !loading && onClose()}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !visible) setMounted(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'w-full max-w-sm rounded-2xl border border-border bg-background/95 p-5 shadow-[0_24px_60px_-24px_rgb(0_0_0_/_0.55)] backdrop-blur-sm',
          'transition-[opacity,transform] duration-200 ease-out',
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1 scale-[0.97] opacity-0',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn('flex gap-3', description ? 'items-start' : 'items-center')}>
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              danger
                ? 'bg-destructive/15 text-destructive'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-base font-semibold leading-snug text-foreground">{title}</h2>
            {description ? (
              <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
            ) : null}
          </div>
        </div>

        {/* Подтверждение слева, отмена справа — одинаковая ширина, без переноса на мобиле. */}
        <div className="mt-5 flex items-center gap-2">
          <Button
            ref={confirmRef}
            type="button"
            variant={danger ? 'destructive' : 'default'}
            className="flex-1"
            loading={loading}
            disabled={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={loading}
            onClick={onClose}
          >
            {cancelLabel ?? t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
