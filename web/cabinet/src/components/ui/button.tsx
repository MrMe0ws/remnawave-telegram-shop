import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // cabinet-btn / cabinet-btn-primary — стабильные хуки для декор-тем:
  // цепляться за utility-классы Tailwind (bg-primary и т.п.) слишком хрупко.
  'cabinet-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] active:duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'cabinet-btn-primary bg-primary text-primary-foreground shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] hover:brightness-110 hover:shadow-[0_10px_26px_-10px_hsl(var(--cabinet-accent)/0.6)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow hover:brightness-110',
        outline:
          'border border-border bg-transparent hover:border-[hsl(var(--cabinet-accent)/0.5)] hover:bg-secondary hover:text-secondary-foreground hover:shadow-[0_8px_22px_-10px_hsl(var(--cabinet-accent)/0.5)] dark:bg-card/40 dark:hover:bg-secondary/80',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-[0_8px_22px_-10px_hsl(var(--cabinet-accent)/0.4)]',
        ghost:
          'hover:bg-secondary hover:text-secondary-foreground',
        link:
          'text-primary underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          /* При loading кнопка остаётся disabled, но не «серой»: виден спиннер как на активной CTA */
          loading && '!opacity-100',
        )}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span className="inline-flex w-full min-w-0 items-center justify-center gap-2">
            <span
              className="box-border inline-block h-4 w-4 shrink-0 rounded-full border-2 border-solid border-current border-t-transparent animate-spin"
              aria-hidden
            />
            {children}
          </span>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
