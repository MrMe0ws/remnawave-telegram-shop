import { cn } from '@/lib/utils'

interface LegendItem {
  label: string
  color: string
  value?: string | number
}

interface StatsChartLegendProps {
  items: LegendItem[]
  className?: string
  compact?: boolean
}

export function StatsChartLegend({ items, className, compact }: StatsChartLegendProps) {
  return (
    <ul
      className={cn(
        'flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground',
        compact ? 'justify-center' : 'justify-start',
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span>
            {item.label}
            {item.value !== undefined && (
              <>
                {': '}
                <span className="font-medium text-foreground">{item.value}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
