import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface AdminSelectOption<T extends string | number = string> {
  value: T
  label: string
}

interface AdminSelectProps<T extends string | number = string> {
  value: T | null
  options: AdminSelectOption<T>[]
  onChange: (value: T | null) => void
  placeholder: string
  ariaLabel: string
  className?: string
  allowEmpty?: boolean
  emptyLabel?: string
}

export function AdminSelect<T extends string | number = string>({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel,
  className,
  allowEmpty = false,
  emptyLabel,
}: AdminSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const selectedLabel =
    value == null || value === ''
      ? emptyLabel ?? placeholder
      : options.find((o) => o.value === value)?.label ?? placeholder

  const pick = (next: T | null) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'cabinet-elevated-card flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/40',
          open && 'border-primary/40 ring-1 ring-primary/20',
        )}
      >
        <span className="truncate text-left">{selectedLabel}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="cabinet-elevated-card absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-auto rounded-lg border border-border/60 bg-card py-1 shadow-lg"
        >
          {allowEmpty && (
            <li role="option" aria-selected={value == null || value === ''}>
              <button
                type="button"
                onClick={() => pick(null)}
                className={cn(
                  'flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50',
                  (value == null || value === '') && 'bg-primary/10 text-primary',
                )}
              >
                <span>{emptyLabel ?? placeholder}</span>
                {(value == null || value === '') && <Check className="size-4 shrink-0" />}
              </button>
            </li>
          )}
          {options.map((opt) => {
            const selected = opt.value === value
            return (
              <li key={String(opt.value)} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => pick(opt.value)}
                  className={cn(
                    'flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50',
                    selected && 'bg-primary/10 text-primary',
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
