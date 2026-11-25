import { useState, type ReactElement, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

/**
 * Подсказка над элементом при наведении мыши — как у значков опций хоста
 * (FeatureBadge в HostsPanel) и в панели Remnawave. Рисуется в body, чтобы её
 * не обрезали прокрутка и overflow окна ноды. На касание не реагирует: на
 * телефоне подпись есть в aria-label, а всплывашка мешала бы нажатию.
 */
export function useHoverTip(label: string) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const handlers = {
    onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return
      const r = e.currentTarget.getBoundingClientRect()
      setPos({ x: r.left + r.width / 2, y: r.top })
    },
    onPointerLeave: () => setPos(null),
    // Клик открывает панель или модалку — подсказка над ней уже не нужна.
    onPointerDown: () => setPos(null),
  }
  const tip: ReactElement | null = pos
    ? createPortal(
        <span
          role="tooltip"
          style={{ left: pos.x, top: pos.y - 8 }}
          className="pointer-events-none fixed z-[260] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-lg"
        >
          {label}
        </span>,
        document.body,
      )
    : null
  return { handlers, tip }
}
