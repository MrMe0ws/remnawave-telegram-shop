import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AppTile, PlatformIcon, platformLabel } from './glyphs'
import type { GuideText } from './guideText'
import type { AppGuide, PlatformKey } from './types'

type Props = {
  open: boolean
  onClose: () => void
  text: GuideText
  platforms: PlatformKey[]
  platform: PlatformKey
  onPlatform: (p: PlatformKey) => void
  apps: AppGuide[]
  appId: string
  onApp: (id: string) => void
}

/**
 * Окно «Изменить»: устройство и приложение. На телефоне — шторка снизу, на ПК —
 * модалка по центру. Через портал: страница обёрнута в PageReveal с
 * transform, и fixed внутри него считался бы от карточки, а не от экрана.
 */
export function DevicePicker({ open, onClose, text, platforms, platform, onPlatform, apps, appId, onApp }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/55 backdrop-blur-[2px] animate-fade-in md:items-center md:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={text.pickerTitle}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'cg-rise flex max-h-[90dvh] w-full flex-col gap-3 overflow-y-auto border border-border bg-card p-4 pb-6 text-card-foreground shadow-2xl',
          'rounded-t-3xl md:max-w-[460px] md:rounded-3xl md:pb-4',
          'dark:border-white/10 dark:bg-[#141d2e]',
        )}
      >
        <span className="mx-auto -mt-1 mb-0.5 h-1.5 w-10 rounded-full bg-foreground/20 md:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[17px] font-bold">{text.pickerTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={text.close}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPlatform(p)}
              aria-pressed={p === platform}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-3 text-[13px] font-semibold transition-colors',
                p === platform
                  ? 'border-primary bg-primary/[0.12] text-primary'
                  : 'border-border bg-foreground/[0.04] text-foreground hover:border-primary/50 dark:border-white/10',
              )}
            >
              <PlatformIcon platform={p} size={24} />
              <span className="truncate">{platformLabel[p] || p}</span>
            </button>
          ))}
        </div>

        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{text.pickerApp}</p>
        <div className="flex flex-col gap-2">
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => onApp(app.id)}
              aria-pressed={app.id === appId}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                app.id === appId
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-foreground/[0.04] hover:border-primary/50 dark:border-white/10',
              )}
            >
              <AppTile app={app} className="size-[34px] text-[11px]" />
              <b className="min-w-0 truncate text-[15px] font-semibold">{app.name}</b>
              {app.isFeatured ? (
                <span className="ml-auto whitespace-nowrap rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  ★ {text.recommended}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <Button type="button" className="mt-1 h-11 w-full" onClick={onClose}>
          {text.pickerDone}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
