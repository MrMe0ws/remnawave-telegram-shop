import { type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ClickableOverviewVariant = 'inline' | 'row' | 'card' | 'badge'

interface Props {
  variant?: ClickableOverviewVariant
  onClick: () => void
  children: ReactNode
  className?: string
  title?: string
  disabled?: boolean
  showIcon?: boolean
}

const variantClassNames: Record<ClickableOverviewVariant, string> = {
  inline: 'inline-flex max-w-full items-center gap-2 text-inherit',
  row: 'flex w-full items-start justify-between gap-3 text-left',
  card: cn(
    'admin-overview-clickable--surface',
    'relative block w-full rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-left',
  ),
  badge:
    'inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary',
}

function EditIcon({ className }: { className?: string }) {
  return (
    <Pencil
      className={cn(
        'size-3.5 shrink-0 text-muted-foreground/80 transition-colors',
        'group-hover:text-primary group-active:text-primary',
        className,
      )}
      aria-hidden
    />
  )
}

export function ClickableOverviewControl({
  variant = 'inline',
  onClick,
  children,
  className,
  title,
  disabled,
  showIcon = true,
}: Props) {
  const isCard = variant === 'card'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'group admin-overview-clickable',
        variantClassNames[variant],
        'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {isCard ? (
        <>
          <span className="block min-w-0 pe-6">{children}</span>
          {showIcon && (
            <span className="pointer-events-none absolute right-3 top-3">
              <EditIcon />
            </span>
          )}
        </>
      ) : variant === 'row' ? (
        <>
          <span className="min-w-0 flex-1">{children}</span>
          {showIcon && <EditIcon />}
        </>
      ) : (
        <>
          {children}
          {showIcon && <EditIcon className={variant === 'badge' ? 'size-3' : undefined} />}
        </>
      )}
    </button>
  )
}
