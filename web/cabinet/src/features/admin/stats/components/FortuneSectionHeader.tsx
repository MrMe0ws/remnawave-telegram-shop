import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface FortuneSectionHeaderProps {
  icon: LucideIcon
  title: string
  boxClassName: string
  iconClassName: string
}

export function FortuneSectionHeader({
  icon: Icon,
  title,
  boxClassName,
  iconClassName,
}: FortuneSectionHeaderProps) {
  return (
    <div className="mb-2 flex shrink-0 items-center gap-2">
      <div
        className={cn(
          'flex size-7 items-center justify-center rounded-md',
          boxClassName,
        )}
      >
        <Icon className={cn('size-3.5', iconClassName)} />
      </div>
      <h3 className="text-sm font-semibold leading-tight">{title}</h3>
    </div>
  )
}
