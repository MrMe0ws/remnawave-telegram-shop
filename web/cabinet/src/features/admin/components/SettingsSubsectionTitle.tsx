import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SettingsSubsectionTitleProps {
  icon: LucideIcon
  children: ReactNode
  className?: string
}

/** Подзаголовок внутри секции настроек — с иконкой. */
export function SettingsSubsectionTitle({ icon: Icon, children, className }: SettingsSubsectionTitleProps) {
  return (
    <h3
      className={cn(
        'mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-muted/80">
        <Icon className="size-3.5" aria-hidden />
      </span>
      {children}
    </h3>
  )
}
