import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { ResizableColumnsApi } from '../utils/useResizableColumns'

interface StatsColumnHandleProps {
  columnKey: string
  onResize: (key: string, event: React.PointerEvent<HTMLElement>) => void
  onReset: (key: string) => void
}

/**
 * Ручка между заголовками колонок.
 *
 * Прижата к правому краю ячейки и вынесена за её границы по вертикали, чтобы
 * попадать по ней было легко и мышью, и пальцем: сама полоска в один пиксель,
 * а область захвата — двенадцать.
 *
 * touch-none обязателен: без него на телефоне жест уводит страницу в
 * горизонтальный скролл вместо перетаскивания границы.
 */
export function StatsColumnHandle({ columnKey, onResize, onReset }: StatsColumnHandleProps) {
  const { t } = useTranslation()
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      title={t('admin.stats.columnResizeHint')}
      onPointerDown={(e) => onResize(columnKey, e)}
      onDoubleClick={() => onReset(columnKey)}
      className="absolute -right-1.5 top-1/2 z-10 h-6 w-3 -translate-y-1/2 cursor-col-resize touch-none select-none"
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/70 transition-colors hover:bg-primary" />
    </span>
  )
}

interface StatsHeaderCellProps {
  columnKey: string
  cols: ResizableColumnsApi
  icon?: LucideIcon
  align?: 'left' | 'right'
  /** Последняя колонка тянется за остатком места, границу двигать нечем. */
  last?: boolean
  children?: ReactNode
}

/** Заголовок колонки таблицы статистики вместе с ручкой ресайза. */
export function StatsHeaderCell({
  columnKey,
  cols,
  icon: Icon,
  align = 'left',
  last,
  children,
}: StatsHeaderCellProps) {
  return (
    <div className="relative min-w-0">
      <span
        className={cn(
          'flex items-center gap-1.5 text-xs text-muted-foreground',
          align === 'right' && 'justify-end',
        )}
      >
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        {children && <span className="truncate">{children}</span>}
      </span>
      {!last && (
        <StatsColumnHandle
          columnKey={columnKey}
          onResize={cols.startResize}
          onReset={cols.resetColumn}
        />
      )}
    </div>
  )
}
