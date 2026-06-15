import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { StatsMetricRow, type StatsMetricItem } from './StatsMetricRow'
import { statsCardAccentStyles, type StatsCardAccent } from '../utils/statsCardAccents'

interface StatsCardProps {
  icon: LucideIcon
  title: string
  items: StatsMetricItem[]
  gradient: string
  accent: StatsCardAccent
  footer?: ReactNode
  className?: string
}

export function StatsCard({
  icon: Icon,
  title,
  items,
  gradient,
  accent,
  footer,
  className,
}: StatsCardProps) {
  const { t } = useTranslation()
  const compactItems = items.filter((i) => i.compactHidden)
  const primaryItems = items.filter((i) => !i.compactHidden)
  const accentStyle = statsCardAccentStyles[accent]

  return (
    <Card className={cn('cabinet-elevated-card overflow-hidden', className)}>
      <div className={cn('h-1', gradient)} />
      <CardHeader className="flex flex-row items-center gap-3 px-4 pb-1 pt-4">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            accentStyle.boxClassName,
          )}
        >
          <Icon className={cn('size-4', accentStyle.iconClassName)} />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <dl className="grid gap-0.5">
          {primaryItems.map((item) => (
            <StatsMetricRow key={item.label} item={item} />
          ))}
          {compactItems.map((item) => (
            <StatsMetricRow key={item.label} item={item} className="max-md:hidden" />
          ))}
          {compactItems.length > 0 && (
            <details className="group md:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center py-2 text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-2 group-open:hidden hover:underline">
                  {t('admin.stats.showAllMetrics')}
                </span>
                <span className="hidden underline-offset-2 group-open:inline hover:underline">
                  {t('admin.stats.hideMetrics')}
                </span>
              </summary>
              <div className="grid gap-1.5 border-t border-border/50 pt-2">
                {compactItems.map((item) => (
                  <StatsMetricRow key={`mobile-${item.label}`} item={item} />
                ))}
              </div>
            </details>
          )}
        </dl>
        {footer}
      </CardContent>
    </Card>
  )
}
