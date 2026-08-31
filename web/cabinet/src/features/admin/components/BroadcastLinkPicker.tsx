import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, LayoutGrid } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  BROADCAST_LINK_KEYS,
  broadcastLinkLabelKey,
  type BroadcastLinkKey,
} from '../utils/broadcastLinks'

interface BroadcastLinkPickerProps {
  selected: BroadcastLinkKey[]
  onToggle: (key: BroadcastLinkKey, checked: boolean) => void
  onClear: () => void
}

/**
 * Разделы кабинета как компактные чипы в сворачиваемом блоке: их больше десятка,
 * и списком чекбоксов они вытесняли бы со страницы всё остальное.
 */
export function BroadcastLinkPicker({ selected, onToggle, onClear }: BroadcastLinkPickerProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-border/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('admin.broadcast.linksTitle')}</p>
            <p className="truncate text-xs text-muted-foreground">
              {selected.length > 0
                ? t('admin.broadcast.linksSelected', { count: selected.length })
                : t('admin.broadcast.linksHint')}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border/50 px-3 py-3">
              <div className="flex flex-wrap gap-2">
                {BROADCAST_LINK_KEYS.map((key) => {
                  const active = selected.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onToggle(key, !active)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        active
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'border-border/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      )}
                    >
                      {t(broadcastLinkLabelKey(key))}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t('admin.broadcast.linksConfigHint')}</p>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {t('admin.broadcast.linksClear')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
