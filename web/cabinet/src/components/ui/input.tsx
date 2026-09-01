import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Собственный фон обязателен: на bg-transparent поле сливалось с
          // карточкой в тёмной теме. В светлой — как в админке (bg-background
          // на белой карточке), в тёмной --input светлее --card.
          'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-input',
          'placeholder:text-muted-foreground',
          'hover:border-[hsl(var(--cabinet-accent)/0.4)]',
          'focus-visible:border-[hsl(var(--cabinet-accent)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
