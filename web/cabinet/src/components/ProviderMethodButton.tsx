import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export function ProviderMethodButton({
  selected,
  onClick,
  icon,
  label,
  description,
  trailing,
}: {
  selected: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  description: string
  /** Например ChevronDown у родителя Platega */
  trailing?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/40 hover:bg-secondary/50',
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {trailing != null ? (
        <div className="flex shrink-0 items-center">{trailing}</div>
      ) : (
        selected && (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
            <Check size={12} className="text-white" />
          </div>
        )
      )}
    </button>
  )
}
