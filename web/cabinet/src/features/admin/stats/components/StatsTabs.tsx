import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface StatsTabItem<K extends string> {
  key: K
  label: string
  icon: LucideIcon
}

interface StatsTabsProps<K extends string> {
  items: StatsTabItem<K>[]
  value: K
  onChange: (next: K) => void
  className?: string
}

/**
 * Вкладки статистики: подчёркивание активной, а не панель из таблеток.
 *
 * Таблетки во всю ширину съедали целую полосу первого экрана и спорили по весу
 * с карточками под ними — переключатель разделов не должен выглядеть тяжелее
 * самих данных. Линия снизу связывает вкладки с содержимым.
 *
 * На узком экране лента прокручивается горизонтально: перенос превратил бы
 * четыре вкладки в две строки.
 */
export function StatsTabs<K extends string>({ items, value, onChange, className }: StatsTabsProps<K>) {
  return (
    <div
      className={cn(
        '-mx-3 overflow-x-auto border-b border-border/60 px-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <div role="tablist" className="flex w-max min-w-full gap-5 sm:gap-6">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.key === value
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.key)}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-0.5 pb-3 pt-1 text-[15px] font-medium transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('size-4 shrink-0', active && 'text-primary')} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
