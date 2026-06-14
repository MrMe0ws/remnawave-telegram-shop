import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { rwIconToneClassNames, type RwIconTone } from '../utils/rwStatusStyles'
import {
  adminSectionIconAccentClassNames,
  type AdminSectionIconAccent,
} from '../utils/adminSectionIconAccents'

interface AdminSectionCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  headerRight?: ReactNode
  /** Крупный заголовок (профиль пользователя) */
  prominentTitle?: boolean
  /** RW status coloring — overrides iconAccent when not default */
  iconTone?: RwIconTone
  iconAccent?: AdminSectionIconAccent
  /** Растянуть карточку на всю высоту родителя (сетка / flex) */
  fillHeight?: boolean
}

export function AdminSectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  headerRight,
  iconTone = 'default',
  iconAccent,
  prominentTitle = false,
  fillHeight = false,
}: AdminSectionCardProps) {
  const iconStyles =
    iconTone !== 'default'
      ? rwIconToneClassNames(iconTone)
      : iconAccent
        ? adminSectionIconAccentClassNames(iconAccent)
        : rwIconToneClassNames('default')

  return (
    <Card className={cn('cabinet-elevated-card overflow-hidden', fillHeight && 'flex h-full flex-col', className)}>
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          {Icon && (
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-lg',
                prominentTitle ? 'size-11' : 'size-8',
                iconStyles.boxClassName,
              )}
            >
              <Icon className={cn(prominentTitle ? 'size-5' : 'size-4', iconStyles.iconClassName)} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                'font-semibold leading-tight',
                prominentTitle ? 'text-lg sm:text-xl' : 'text-sm',
              )}
            >
              {title}
            </h2>
            {description && (
              <p
                className={cn(
                  'mt-1 break-all leading-snug text-muted-foreground',
                  prominentTitle ? 'text-sm' : 'text-xs',
                )}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {headerRight && <div className="shrink-0 self-start sm:self-center">{headerRight}</div>}
      </div>
      <div className={cn('min-w-0 p-4 sm:p-5', fillHeight && 'flex flex-1 flex-col')}>{children}</div>
    </Card>
  )
}
