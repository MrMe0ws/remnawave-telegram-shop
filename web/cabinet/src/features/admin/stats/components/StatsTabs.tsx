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
 * Вкладки статистики.
 *
 * Не таблетки во всю ширину — те съедали целую полосу первого экрана и весили
 * больше карточек под ними. Но и не голый текст: без подложки лента вкладок
 * терялась на фоне страницы. Компромисс — своя поверхность со скруглением,
 * внутри которой активная вкладка подсвечена и подчёркнута.
 *
 * На узком экране лента прокручивается горизонтально: перенос превратил бы
 * четыре вкладки в две строки.
 */
export function StatsTabs<K extends string>({ items, value, onChange, className }: StatsTabsProps<K>) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-2xl border border-border/60 bg-card/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <div role="tablist" className="flex w-max min-w-full">
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
                'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 pb-2.5 pt-3 text-[15px] font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground',
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
