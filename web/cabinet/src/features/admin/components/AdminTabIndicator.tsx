import { useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * Подложка выбранной вкладки, которая переезжает к новой (как `SlidingTabs` на «Инфраструктуре»).
 *
 * Кладётся первым ребёнком в контейнер вкладок (`relative`); сама находит соседа
 * с `aria-selected="true"` и встаёт под него. У вкладок фон активного состояния
 * убирается (его рисует подложка), а сами они — `relative`, чтобы быть поверх.
 * `className` — фон/рамка подложки, тот же, что раньше был у активной вкладки.
 */
export function AdminTabIndicator({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  // Первая установка — без анимации: подложка не должна выезжать из угла при загрузке.
  const [animate, setAnimate] = useState(false)

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const place = () => {
      const tab = parent.querySelector<HTMLElement>(':scope > [aria-selected="true"]')
      if (!tab) {
        setBox(null)
        return
      }
      const next = { left: tab.offsetLeft, top: tab.offsetTop, width: tab.offsetWidth, height: tab.offsetHeight }
      setBox((prev) =>
        prev && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height ? prev : next,
      )
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(parent)
    for (const child of Array.from(parent.children)) ro.observe(child)
    const mo = new MutationObserver(place)
    mo.observe(parent, { subtree: true, attributes: true, attributeFilter: ['aria-selected'], childList: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    if (box && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true))
      return () => cancelAnimationFrame(id)
    }
  }, [box, animate])

  return (
    <span
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-0 top-0 rounded-md',
        animate &&
          'transition-[left,top,width,height,background-color,border-color] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        !box && 'hidden',
        className,
      )}
      style={box ? { left: box.left, top: box.top, width: box.width, height: box.height } : undefined}
    />
  )
}
