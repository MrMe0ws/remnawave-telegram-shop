import { useEffect } from 'react'

/**
 * Подсветка карточки под курсором.
 *
 * Один слушатель pointermove на документе вместо onMouseMove на каждой
 * карточке: поверхностей в кабинете десятки, и React-обработчик на каждой давал
 * бы ререндер на каждое движение мыши. Пишем координаты прямо в CSS-переменные
 * узла (--cd-mx/--cd-my), их читает radial-gradient в index.css.
 *
 * Хук глобальный (монтируется в CabinetDecorThemeSync) и работает при любой
 * теме: подсветка переехала из темы nebula в базовый слой пластики, чтобы
 * появиться на всех страницах и во всех темах разом.
 */

const CARD_SELECTOR = '.cabinet-card, .cabinet-elevated-card, .subscription-feature-card'

export function useDecorCardSpotlight(): void {
  useEffect(() => {
    // Тонкая моторика мыши — не для тех, кто просил меньше движения.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Тач без курсора: подсветке негде жить, только тратили бы события.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let current: HTMLElement | null = null

    const clear = () => {
      if (!current) return
      current.style.removeProperty('--cd-mx')
      current.style.removeProperty('--cd-my')
      current = null
    }

    const onMove = (event: PointerEvent) => {
      const target = event.target as Element | null
      const card = target?.closest?.(CARD_SELECTOR) as HTMLElement | null

      if (!card) {
        clear()
        return
      }
      if (card !== current) {
        clear()
        current = card
      }

      const rect = card.getBoundingClientRect()
      card.style.setProperty('--cd-mx', `${event.clientX - rect.left}px`)
      card.style.setProperty('--cd-my', `${event.clientY - rect.top}px`)
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    // Уводя курсор за пределы окна, гасим последнюю подсвеченную карточку.
    document.addEventListener('pointerleave', clear, { passive: true })

    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', clear)
      clear()
    }
  }, [])
}
