import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { statsCardAccentStyles, type StatsCardAccent } from '../utils/statsCardAccents'

interface StatsWidgetCardProps {
  icon: LucideIcon
  title: string
  gradient: string
  accent: StatsCardAccent
  className?: string
  children: ReactNode
  headerExtra?: ReactNode
}

export function StatsWidgetCard({
  icon: Icon,
  title,
  gradient,
  accent,
  className,
  children,
  headerExtra,
}: StatsWidgetCardProps) {
  const accentStyle = statsCardAccentStyles[accent]

  return (
    <Card className={cn('cabinet-elevated-card flex h-full flex-col overflow-hidden', className)}>
      <div className={cn('h-1 shrink-0', gradient)} />
      <CardHeader className="flex flex-row items-start justify-between gap-2 px-4 pb-2 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              accentStyle.boxClassName,
            )}
          >
            <Icon className={cn('size-4', accentStyle.iconClassName)} />
          </div>
          <CardTitle className="truncate text-base">{title}</CardTitle>
        </div>
        {headerExtra}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  )
}
