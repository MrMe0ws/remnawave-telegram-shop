import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

/**
 * Плейсхолдер на время загрузки данных.
 *
 * Задача — держать высоту будущего блока, чтобы контент не «прыгал» при подстановке,
 * и не показывать нули/дефолты вместо ещё не пришедших значений. Сама анимация
 * (мягкий shimmer) живёт в `.cabinet-skeleton` в index.css и глушится
 * при prefers-reduced-motion.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return <div aria-hidden className={cn('cabinet-skeleton', className)} style={style} />
}

/** Несколько строк текста разной ширины — заглушка под абзац или описание. */
export function SkeletonText({
  lines = 3,
  className,
  lineClassName,
  widths,
}: {
  lines?: number
  className?: string
  lineClassName?: string
  /** Ширины строк в процентах; по умолчанию — убывающая «лесенка». */
  widths?: number[]
}) {
  const resolved = widths ?? defaultWidths(lines)
  return (
    <div className={cn('space-y-2', className)}>
      {resolved.slice(0, lines).map((width, i) => (
        <Skeleton key={i} className={cn('h-3.5', lineClassName)} style={{ width: `${width}%` }} />
      ))}
    </div>
  )
}

function defaultWidths(lines: number): number[] {
  return Array.from({ length: lines }, (_, i) => (i === lines - 1 ? 62 : 100 - i * 6))
}

/**
 * Заглушка карточки: обводка и радиус как у `subscription-feature-card`,
 * поэтому подмена на реальную карточку не даёт скачка вёрстки.
 */
export function SkeletonCard({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-[var(--radius)] border border-border/70 bg-card/60 px-5 py-5 sm:px-6 sm:py-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
