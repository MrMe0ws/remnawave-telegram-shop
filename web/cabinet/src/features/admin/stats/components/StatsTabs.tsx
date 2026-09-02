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
 * Вкладки статистики. На узком экране лента прокручивается горизонтально, а не
 * переносится: перенос превратил бы четыре вкладки в две строки и съел бы
 * половину первого экрана.
 */
export function StatsTabs<K extends string>({ items, value, onChange, className }: StatsTabsProps<K>) {
  return (
    <div
      className={cn(
        '-mx-3 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <div
        role="tablist"
        className="inline-flex min-w-full gap-1 rounded-xl border border-border/60 bg-muted/30 p-1"
      >
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
                'flex min-h-10 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
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
