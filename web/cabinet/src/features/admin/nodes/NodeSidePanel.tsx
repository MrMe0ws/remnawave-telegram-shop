import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rwIconToneClassNames } from '../utils/rwStatusStyles'
import { adminSectionIconAccentClassNames, type AdminSectionIconAccent } from '../utils/adminSectionIconAccents'

const ANIM_MS = 220

/** Открытые панели в порядке открытия: Esc и затемнение относятся только к верхней. */
const openStack: symbol[] = []

/**
 * Боковая панель справа поверх окна ноды (хосты, инбаунды, статистика, сессии, профили).
 * Как в панели Remna: выезжает справа, 800 px (второй уровень) и 690 px (третий) на ПК; на телефоне — на весь экран.
 *
 * Стоит выше AdminModal (z-[210] против 200), поэтому Esc ловим в фазе перехвата и не пускаем дальше:
 * иначе первый Esc закрыл бы и панель, и окно ноды под ней. Рендерить её нужно рядом с AdminModal,
 * а не внутри его children.
 */
export function NodeSidePanel({
  open,
  onClose,
  title,
  icon: Icon,
  iconAccent = 'emerald',
  headerAction,
  children,
  footer,
  depth = 2,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  icon?: LucideIcon
  iconAccent?: AdminSectionIconAccent
  /** Кнопки в шапке слева от крестика (обновить, сохранить). */
  headerAction?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Глубина: 2 — панели окна ноды (800 px на ПК), 3 и глубже — вложенные в них (690 px). */
  depth?: 2 | 3
}) {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    setVisible(false)
    const id = window.setTimeout(() => setMounted(false), ANIM_MS + 30)
    return () => window.clearTimeout(id)
  }, [open])

  // Обработчик берём из ref, чтобы смена onClose между рендерами не переставляла панель в стеке.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const id = Symbol('side-panel')
    openStack.push(id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Реагирует только верхняя панель; нижние молчат и не гасят событие, чтобы оно дошло до верхней.
      if (openStack[openStack.length - 1] !== id) return
      e.stopImmediatePropagation()
      closeRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      const i = openStack.indexOf(id)
      if (i >= 0) openStack.splice(i, 1)
    }
  }, [open])

  // Пока панель уезжает, родитель уже мог сбросить данные: показываем то, что было на экране.
  const live = { title, children, footer, headerAction, Icon }
  const frozen = useRef(live)
  if (open) frozen.current = live
  const view = open ? live : frozen.current

  if (!mounted) return null
  const iconStyles = iconAccent ? adminSectionIconAccentClassNames(iconAccent) : rwIconToneClassNames('default')

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[210] bg-black/40 transition-opacity duration-[220ms] ease-out motion-reduce:transition-none',
        visible ? 'opacity-100' : 'opacity-0',
        !open && 'pointer-events-none',
      )}
      onClick={open ? onClose : undefined}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden rounded-none border-l border-border bg-card shadow-2xl shadow-black/40',
          depth === 2 ? 'sm:w-[800px]' : 'sm:w-[690px]',
          'transition-transform duration-[220ms] ease-out motion-reduce:transition-none',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
          {view.Icon && (
            <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconStyles.boxClassName)}>
              <view.Icon className={cn('size-4', iconStyles.iconClassName)} />
            </div>
          )}
          <div className="min-w-0 flex-1 text-lg font-semibold leading-tight">{view.title}</div>
          {view.headerAction && <div className="flex shrink-0 items-center gap-2">{view.headerAction}</div>}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{view.children}</div>
        {view.footer && <div className="shrink-0 border-t border-border/70 px-4 py-3">{view.footer}</div>}
      </aside>
    </div>,
    document.body,
  )
}
