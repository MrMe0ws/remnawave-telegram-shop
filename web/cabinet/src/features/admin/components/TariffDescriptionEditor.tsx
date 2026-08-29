import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  Code,
  Quote,
  EyeOff,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

import { TariffDescription } from '@/components/TariffDescription'
import {
  applyTelegramMarkup,
  detectUnsupportedMarkdown,
  type TelegramMarkupActionId,
} from '../utils/telegramMarkup'

const TOOLBAR_ACTIONS: {
  id: TelegramMarkupActionId
  icon: LucideIcon
  labelKey: string
  shortcut?: string
}[] = [
  { id: 'bold', icon: Bold, labelKey: 'admin.tariffs.markup.bold', shortcut: 'B' },
  { id: 'italic', icon: Italic, labelKey: 'admin.tariffs.markup.italic', shortcut: 'I' },
  { id: 'underline', icon: Underline, labelKey: 'admin.tariffs.markup.underline', shortcut: 'U' },
  { id: 'strike', icon: Strikethrough, labelKey: 'admin.tariffs.markup.strike' },
  { id: 'link', icon: Link2, labelKey: 'admin.tariffs.markup.link', shortcut: 'K' },
  { id: 'code', icon: Code, labelKey: 'admin.tariffs.markup.code' },
  { id: 'quote', icon: Quote, labelKey: 'admin.tariffs.markup.quote' },
  { id: 'spoiler', icon: EyeOff, labelKey: 'admin.tariffs.markup.spoiler' },
]

const SHORTCUT_ACTIONS: Record<string, TelegramMarkupActionId> = {
  b: 'bold',
  i: 'italic',
  u: 'underline',
  k: 'link',
}

interface Props {
  value: string
  onChange: (value: string) => void
  sourceLabel: string
  previewLabel: string
  previewEmptyLabel: string
}

export function TariffDescriptionEditor({
  value,
  onChange,
  sourceLabel,
  previewLabel,
  previewEmptyLabel,
}: Props) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Выделение восстанавливаем уже после того, как React отрисует новое значение.
  const pendingSelection = useRef<[number, number] | null>(null)

  useEffect(() => {
    const selection = pendingSelection.current
    if (!selection || !textareaRef.current) return
    pendingSelection.current = null
    textareaRef.current.focus()
    textareaRef.current.setSelectionRange(selection[0], selection[1])
  })

  const runAction = (action: TelegramMarkupActionId) => {
    const el = textareaRef.current
    if (!el) return
    const result = applyTelegramMarkup(value, el.selectionStart, el.selectionEnd, action)
    pendingSelection.current = [result.selectionStart, result.selectionEnd]
    onChange(result.value)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    const action = SHORTCUT_ACTIONS[e.key.toLowerCase()]
    if (!action) return
    e.preventDefault()
    runAction(action)
  }

  const unsupported = detectUnsupportedMarkdown(value)

  return (
    <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
      <div className="flex min-h-[13.5rem] flex-col">
        <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">{sourceLabel}</label>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-input focus-within:border-primary/45">
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/30 px-1.5 py-1 dark:bg-secondary/30">
            {TOOLBAR_ACTIONS.map((action) => {
              const Icon = action.icon
              const label = action.shortcut
                ? `${t(action.labelKey)} (Ctrl+${action.shortcut})`
                : t(action.labelKey)
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => runAction(action.id)}
                  title={label}
                  aria-label={label}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="size-3.5" aria-hidden />
                </button>
              )
            })}
          </div>
          <textarea
            ref={textareaRef}
            spellCheck={false}
            onKeyDown={onKeyDown}
            className="min-h-0 flex-1 resize-none bg-transparent px-3 py-2 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        {unsupported.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {t('admin.tariffs.markup.unsupportedWarning', {
                items: unsupported.map((id) => t(`admin.tariffs.markup.unsupported.${id}`)).join(', '),
              })}
            </span>
          </p>
        )}
      </div>
      <div className="flex min-h-[13.5rem] flex-col">
        <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">{previewLabel}</label>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5">
          {value.trim() ? (
            <TariffDescription text={value} className="text-sm" />
          ) : (
            <p className="text-xs italic text-muted-foreground">{previewEmptyLabel}</p>
          )}
        </div>
      </div>
    </div>
  )
}
