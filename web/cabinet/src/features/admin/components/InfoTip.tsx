import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Значок «i» с подсказкой: при наведении мыши, фокусе и нажатии (на телефоне закрывается касанием вне). align — к какому краю прижата подсказка. */
export function InfoTip({ text, label, align = 'right', className }: { text: string; label: string; align?: 'left' | 'right' | 'center'; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  return (
    <span ref={ref} className={cn('pointer-events-auto relative inline-flex', className)} onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)} onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        // Только «открыть»: на телефоне касание сначала даёт фокус (он уже открыл подсказку), и переключатель закрывал её обратно — приходилось нажимать дважды.
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {open && (
        <span role="tooltip" className={cn('admin-fade absolute top-full z-30 w-60 max-w-[70vw] pt-1.5', align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0')}>
          <span className="block rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-normal leading-snug text-foreground shadow-lg">{text}</span>
        </span>
      )}
    </span>
  )
}
