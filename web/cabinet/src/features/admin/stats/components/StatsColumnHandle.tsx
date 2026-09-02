import { useTranslation } from 'react-i18next'

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
 * а область захвата — девять.
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
