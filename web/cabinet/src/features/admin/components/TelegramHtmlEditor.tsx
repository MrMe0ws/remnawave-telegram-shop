import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bold,
  Braces,
  Code2,
  Eraser,
  EyeOff,
  Italic,
  Link2,
  Quote,
  Strikethrough,
  Underline,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  EXPANDABLE_CLASS,
  SPOILER_CLASS,
  renderTelegramHtml,
  safeHref,
  serializeToTelegramHtml,
} from '../utils/telegramHtml'

interface TelegramHtmlEditorProps {
  /** Разметка Telegram. Наружу уходит только она, состояние DOM остаётся внутри. */
  onChange: (html: string) => void
  placeholder?: string
  /**
   * Что показать при открытии. Читается один раз на монтировании и при смене
   * resetKey: подставлять его на каждый ререндер нельзя — контролируемый
   * contenteditable роняет каретку в начало на каждом нажатии клавиши.
   */
  initialHtml?: string
  /** Меняется, когда поле надо перечитать заново: очистка после отправки, другой тариф. */
  resetKey: number
  /**
   * Какие инструменты показывать. По умолчанию все.
   *
   * Нужно там, где разметку рисует не Telegram: описание тарифа кабинет
   * прогоняет через санитайзер разметки, и часть тегов до пользователя
   * не доезжает — кнопка, которая ничего не делает, хуже отсутствующей.
   */
  tools?: TelegramHtmlCommand[]
  className?: string
}

export type TelegramHtmlCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'mono'
  | 'spoiler'
  | 'quote'
  | 'quoteExpandable'
  | 'link'
  | 'clear'

interface Tool {
  cmd: TelegramHtmlCommand
  icon: LucideIcon
  labelKey: string
  hint: string
  /** Состояние подсвечивается только у команд, о которых браузер умеет сказать. */
  queryable?: boolean
}

/**
 * Набор повторяет контекстное меню Telegram: админ пишет пост там же, где потом
 * его читают, и расхождение в возможностях каждый раз всплывает вопросом
 * «а почему тут нельзя подчеркнуть».
 */
const TOOLS: (Tool | 'sep')[] = [
  { cmd: 'bold', icon: Bold, labelKey: 'admin.broadcast.editor.bold', hint: 'Ctrl+B', queryable: true },
  { cmd: 'italic', icon: Italic, labelKey: 'admin.broadcast.editor.italic', hint: 'Ctrl+I', queryable: true },
  { cmd: 'underline', icon: Underline, labelKey: 'admin.broadcast.editor.underline', hint: 'Ctrl+U', queryable: true },
  {
    cmd: 'strikeThrough',
    icon: Strikethrough,
    labelKey: 'admin.broadcast.editor.strike',
    hint: 'Ctrl+Shift+X',
    queryable: true,
  },
  'sep',
  { cmd: 'mono', icon: Code2, labelKey: 'admin.broadcast.editor.mono', hint: 'Ctrl+Shift+M' },
  { cmd: 'spoiler', icon: EyeOff, labelKey: 'admin.broadcast.editor.spoiler', hint: 'Ctrl+Shift+P' },
  'sep',
  { cmd: 'quote', icon: Quote, labelKey: 'admin.broadcast.editor.quote', hint: 'Ctrl+Shift+.' },
  { cmd: 'quoteExpandable', icon: Braces, labelKey: 'admin.broadcast.editor.quoteExpandable', hint: '' },
  'sep',
  { cmd: 'link', icon: Link2, labelKey: 'admin.broadcast.editor.link', hint: 'Ctrl+K' },
  { cmd: 'clear', icon: Eraser, labelKey: 'admin.broadcast.editor.clear', hint: 'Ctrl+Shift+N' },
]

/**
 * Редактор разметки Telegram: что набрано, то и видно.
 *
 * Один на рассылку и на описание тарифа — текст в обоих случаях уходит в
 * Telegram с parse_mode=HTML, то есть формат ровно один. Раньше там стояли две
 * разные textarea, и админ писал теги руками: в поле было `<b>Заголовок</b>`, а
 * как это будет выглядеть, выяснялось после отправки (или во втором окне
 * предпросмотра рядом). Показать жирный текст в textarea нельзя в принципе,
 * поэтому поле стало contenteditable, а разметка собирается из его DOM.
 *
 * Компонент неуправляемый: контролируемый contenteditable на каждый ввод
 * перерисовывает содержимое и роняет каретку в начало. Наружу отдаётся готовая
 * разметка, а перечитать поле можно сменой resetKey.
 */
export function TelegramHtmlEditor({
  onChange,
  placeholder,
  initialHtml,
  resetKey,
  tools,
  className,
}: TelegramHtmlEditorProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Record<string, boolean>>({})

  /*
   * Разделители после отбора могут оказаться подряд или с краю — тогда в
   * панели видны пустые вертикальные чёрточки без кнопок между ними.
   */
  const visibleTools = useMemo(() => {
    if (!tools) return TOOLS
    const kept = TOOLS.filter((tool) => tool === 'sep' || tools.includes(tool.cmd))
    return kept.filter((tool, i) => {
      if (tool !== 'sep') return true
      const prev = kept[i - 1]
      const next = kept[i + 1]
      return prev !== undefined && prev !== 'sep' && next !== undefined && next !== 'sep'
    })
  }, [tools])

  const emit = useCallback(() => {
    const node = ref.current
    if (!node) return
    onChange(serializeToTelegramHtml(node))
  }, [onChange])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    /*
     * renderTelegramHtml здесь работает как обратное преобразование: он
     * экранирует всё и возвращает к жизни только теги Telegram, а спойлер и
     * сворачиваемую цитату отдаёт уже с теми классами, в которых их хранит
     * редактор. Отдельного разборщика для этого не нужно.
     */
    node.innerHTML = initialHtml ? renderTelegramHtml(initialHtml) : ''
    onChange(initialHtml ? serializeToTelegramHtml(node) : '')
    // initialHtml и onChange в зависимостях перечитывали бы поле на каждый
    // ререндер родителя — каретка прыгала бы в начало при вводе.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  /*
   * document.execCommand объявлен устаревшим, но замены для «применить жирный к
   * выделению с учётом всех его границ» в платформе до сих пор нет: Selection API
   * даёт только диапазон, а разбор частично выделенных узлов пришлось бы писать
   * руками. Все браузеры его поддерживают; styleWithCSS выключен, чтобы
   * получались теги <b> и <i>, а не span со стилем — их Telegram не понимает.
   */
  const exec = (command: string, value?: string) => {
    try {
      document.execCommand('styleWithCSS', false, 'false')
      document.execCommand(command, false, value)
    } catch {
      // Команда не поддержана — молча пропускаем: текст в поле не портится.
    }
  }

  /** Обернуть выделение своим тегом — execCommand такого не умеет. */
  const wrapSelection = (build: () => HTMLElement) => {
    const node = ref.current
    const sel = window.getSelection()
    if (!node || !sel || !sel.rangeCount || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    if (!node.contains(range.commonAncestorContainer)) return
    const wrapper = build()
    try {
      wrapper.appendChild(range.extractContents())
      range.insertNode(wrapper)
      range.selectNodeContents(wrapper)
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      // Выделение через границы блоков: такую разметку Telegram тоже не примет.
    }
  }

  const wrapQuote = (expandable: boolean) => {
    wrapSelection(() => {
      const quote = document.createElement('blockquote')
      if (expandable) quote.className = EXPANDABLE_CLASS
      return quote
    })
  }

  const run = (cmd: TelegramHtmlCommand) => {
    const node = ref.current
    if (!node) return
    node.focus()

    switch (cmd) {
      case 'mono':
        wrapSelection(() => document.createElement('code'))
        break
      case 'spoiler':
        wrapSelection(() => {
          const span = document.createElement('span')
          span.className = SPOILER_CLASS
          return span
        })
        break
      case 'quote':
        wrapQuote(false)
        break
      case 'quoteExpandable':
        wrapQuote(true)
        break
      case 'link': {
        const raw = window.prompt(t('admin.broadcast.editor.enterUrl') ?? 'URL', 'https://')
        if (!raw) return
        const href = safeHref(raw)
        if (!href) {
          window.alert(t('admin.broadcast.editor.badUrl'))
          return
        }
        exec('createLink', href)
        break
      }
      case 'clear':
        exec('removeFormat')
        exec('unlink')
        // removeFormat не знает про наши обёртки — снимаем их отдельно.
        node.querySelectorAll(`.${SPOILER_CLASS}, code, blockquote`).forEach((el) => {
          el.replaceWith(...Array.from(el.childNodes))
        })
        break
      default:
        exec(cmd)
    }
    emit()
    syncActive()
  }

  const syncActive = useCallback(() => {
    const next: Record<string, boolean> = {}
    for (const tool of visibleTools) {
      if (tool === 'sep' || !tool.queryable) continue
      try {
        next[tool.cmd] = document.queryCommandState(tool.cmd)
      } catch {
        next[tool.cmd] = false
      }
    }
    setActive(next)
  }, [visibleTools])

  useEffect(() => {
    const onSelection = () => {
      const node = ref.current
      const anchor = window.getSelection()?.anchorNode ?? null
      if (node && anchor && node.contains(anchor)) syncActive()
    }
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [syncActive])

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    const key = e.key.toLowerCase()
    if (e.shiftKey) {
      const map: Record<string, TelegramHtmlCommand> = { x: 'strikeThrough', m: 'mono', p: 'spoiler', n: 'clear' }
      const cmd = map[key] ?? (key === '.' || key === '>' ? 'quote' : undefined)
      if (cmd) {
        e.preventDefault()
        run(cmd)
      }
      return
    }
    if (key === 'k') {
      e.preventDefault()
      run('link')
    }
    // Ctrl+B / Ctrl+I / Ctrl+U contenteditable обрабатывает сам — перехватывать
    // их незачем, надо лишь пересобрать разметку после ввода.
  }

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/40 px-2 py-1.5"
        role="toolbar"
        aria-label={t('admin.broadcast.editor.toolbar')}
      >
        {visibleTools.map((tool, i) =>
          tool === 'sep' ? (
            <span key={`sep-${i}`} className="mx-1 h-4 w-px bg-border" aria-hidden />
          ) : (
            <ToolButton
              key={tool.cmd}
              label={t(tool.labelKey)}
              hint={tool.hint}
              active={Boolean(active[tool.cmd])}
              onRun={() => run(tool.cmd)}
            >
              <tool.icon className="size-[15px]" />
            </ToolButton>
          ),
        )}
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? t('admin.broadcast.compose')}
        data-placeholder={placeholder}
        onInput={emit}
        onKeyDown={onKeyDown}
        onBlur={emit}
        className={cn(
          'cabinet-tg-text min-h-[132px] px-3 py-3 text-sm leading-relaxed outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary/50',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground',
          className,
        )}
      />
    </div>
  )
}

function ToolButton({
  label,
  hint,
  active,
  onRun,
  children,
}: {
  label: string
  hint: string
  active: boolean
  onRun: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={hint ? `${label} · ${hint}` : label}
      aria-label={label}
      aria-pressed={active}
      // mousedown снял бы выделение в поле раньше, чем сработает команда.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className={cn(
        'grid size-7 place-items-center rounded-md border border-transparent transition-colors',
        active
          ? 'border-primary/40 bg-card text-primary'
          : 'text-muted-foreground hover:bg-card hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
