import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Braces, Check, ChevronDown, Pencil, Plus, Search, X } from 'lucide-react'

import { AdminCheckbox } from '../components/AdminCheckbox'
import { cn } from '@/lib/utils'
import { OPT_GROUPS, OPT_LABEL, type HostOptKey } from './hostForm'
import { PANEL_CAP, PANEL_INPUT } from './panelUi'

/**
 * Поля редактора хоста: чипы со свободным вводом, мультивыбор с поиском, кнопка JSON, меню «Добавить».
 */

/**
 * Esc закрывает только всплывающий список, а не панель под ним. Боковая панель слушает Esc на document в фазе
 * перехвата, поэтому мы встаём раньше — на window в фазе перехвата — и гасим событие.
 */
export function useEscClose(open: boolean, close: () => void) {
  const ref = useRef(close)
  ref.current = close
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      e.preventDefault()
      ref.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
}

/** Закрытие по клику вне элемента. */
function useOutside(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  const cb = useRef(close)
  cb.current = close
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open, ref])
}

/** Чип со значением и крестиком. */
export function Chip({ children, onRemove, tone = 'emerald' }: { children: ReactNode; onRemove?: () => void; tone?: 'emerald' | 'sky' | 'violet' }) {
  const { t } = useTranslation()
  const tones = {
    emerald: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    sky: 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    violet: 'border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  }
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-bold', tones[tone])}>
      <span className="min-w-0 truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('admin.nodes.panels.host.removeChip')}
          className="-mr-0.5 shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

/**
 * Список строк: чипы + ввод. Enter или запятая добавляют значение. `normalize` приводит ввод к виду панели
 * (например, заглавные буквы у тегов), `check` возвращает текст ошибки или null.
 */
export function ChipInput({
  value,
  onChange,
  placeholder,
  normalize = (s) => s,
  check,
  mono,
  tone,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
  normalize?: (s: string) => string
  check?: (s: string, current: string[]) => string | null
  mono?: boolean
  tone?: 'emerald' | 'sky' | 'violet'
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const commit = (raw: string): boolean => {
    const parts = raw
      .split(/[,\n]/)
      .map((p) => normalize(p.trim()))
      .filter(Boolean)
    if (parts.length === 0) {
      setError(null)
      return true
    }
    let next = value
    for (const p of parts) {
      if (next.includes(p)) continue
      const e = check?.(p, next) ?? null
      if (e) {
        setError(e)
        return false
      }
      next = [...next, p]
    }
    setError(null)
    setText('')
    if (next !== value) onChange(next)
    return true
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(text)
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        className={cn(
          'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[10px] border bg-background/60 px-2.5 py-1.5 transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20',
          error ? 'border-red-500/60' : 'border-input',
        )}
      >
        {value.map((v) => (
          <Chip key={v} tone={tone} onRemove={() => onChange(value.filter((x) => x !== v))}>
            <span className={mono ? 'font-mono' : undefined}>{v}</span>
          </Chip>
        ))}
        <input
          value={text}
          onChange={(e) => {
            setText(normalize(e.target.value))
            if (error) setError(null)
          }}
          onKeyDown={onKey}
          onBlur={() => {
            if (text.trim()) commit(text)
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className={cn('h-7 min-w-[7rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70', mono && 'font-mono text-[13px]')}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>
      {error && <div className="mt-1 text-[11.5px] text-red-600 dark:text-red-400">{error}</div>}
    </div>
  )
}

export type PickItem = { id: string; label: string; icon?: ReactNode }

/** Мультивыбор: чипы, а под ними раскрывающийся список с поиском. */
export function MultiPick({
  items,
  value,
  onChange,
  placeholder,
  searchable,
  tone = 'sky',
  ariaLabel,
}: {
  items: PickItem[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
  searchable?: boolean
  tone?: 'emerald' | 'sky' | 'violet'
  ariaLabel: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  useEscClose(open, () => setOpen(false))
  useOutside(open, rootRef, () => setOpen(false))

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  const needle = q.trim().toLowerCase()
  const shown = needle ? items.filter((i) => i.label.toLowerCase().includes(needle)) : items

  return (
    <div ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex min-h-10 w-full items-center gap-2 rounded-[10px] border border-input bg-card dark:bg-background/60 px-2.5 py-1.5 text-left text-sm transition-colors hover:border-primary/40"
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {value.length === 0 && <span className="px-0.5 text-muted-foreground">{placeholder}</span>}
          {value.map((id) => {
            const it = byId.get(id)
            return (
              <Chip key={id} tone={tone}>
                <span className="flex items-center gap-1.5">
                  {it?.icon}
                  <span className="truncate">{it?.label ?? id.slice(0, 8)}</span>
                </span>
              </Chip>
            )
          })}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="admin-expand mt-1.5 overflow-hidden rounded-[10px] border border-border bg-card">
          {searchable && (
            <div className="relative border-b border-border/70 p-1.5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('admin.nodes.panels.host.search')}
                aria-label={t('admin.nodes.panels.host.search')}
                className="h-8 w-full rounded-lg bg-background/60 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
          <ul className="max-h-56 overflow-y-auto p-1">
            {shown.length === 0 && <li className="px-2.5 py-2 text-sm text-muted-foreground">{t('admin.nodes.panels.host.nothingFound')}</li>}
            {shown.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => toggle(it.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <AdminCheckbox checked={value.includes(it.id)} onChange={() => toggle(it.id)} aria-label={it.label} />
                  {it.icon}
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Кнопка «Настроено ✎ / Настроить» для JSON-опций. */
export function JsonButton({ text, onClick }: { text: string; onClick: () => void }) {
  const { t } = useTranslation()
  const set = text.trim() !== ''
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-10 w-full items-center justify-between gap-2 rounded-[10px] border px-3 text-sm font-semibold transition-colors',
        set
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
          : 'border-input bg-card dark:bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      <span className="flex items-center gap-2">
        {set ? <Check className="size-4" aria-hidden /> : <Braces className="size-4" aria-hidden />}
        {set ? t('admin.nodes.panels.host.configured') : t('admin.nodes.panels.host.configure')}
      </span>
      <Pencil className="size-3.5" aria-hidden />
    </button>
  )
}

const GROUP_LABEL = {
  dest: 'groupDest',
  security: 'groupSecurity',
  transport: 'groupTransport',
  subscription: 'groupSubscription',
  advanced: 'groupAdvanced',
  clients: 'groupClients',
} as const

/** Меню «Добавить»: поиск и секции с опциями, которых ещё нет в форме. */
export function AddMenu({ available, onPick }: { available: HostOptKey[]; onPick: (k: HostOptKey) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const close = () => {
    setOpen(false)
    setQ('')
  }
  useEscClose(open, close)
  useOutside(open, ref, close)
  // Меню может открыться у нижнего края прокручиваемой панели: подкручиваем, чтобы оно было видно целиком.
  useEffect(() => {
    if (open) ref.current?.querySelector('[role="menu"]')?.scrollIntoView({ block: 'nearest' })
  }, [open])

  const L = (k: HostOptKey) => t(`admin.nodes.panels.host.${OPT_LABEL[k]}`)
  const needle = q.trim().toLowerCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-bold transition-colors hover:bg-secondary"
      >
        <Plus className="size-4" aria-hidden />
        {t('admin.nodes.panels.host.add')}
      </button>
      {open && (
        <div
          role="menu"
          className="admin-pop absolute right-0 top-full z-20 mt-1.5 w-[min(18rem,calc(100vw-3rem))] origin-top-right overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/30"
        >
          <div className="relative border-b border-border/70 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('admin.nodes.panels.host.search')}
              aria-label={t('admin.nodes.panels.host.search')}
              className={cn(PANEL_INPUT, 'h-9 pl-8')}
            />
          </div>
          <div className="max-h-[min(22rem,55vh)] overflow-y-auto p-1.5">
            {(() => {
              const sections = OPT_GROUPS.map((g) => ({
                g,
                items: g.keys.filter((k) => available.includes(k) && (!needle || L(k).toLowerCase().includes(needle))),
              })).filter((s) => s.items.length > 0)
              if (sections.length === 0) {
                return (
                  <div className="px-2.5 py-2 text-sm text-muted-foreground">
                    {available.length === 0 ? t('admin.nodes.panels.host.addEmpty') : t('admin.nodes.panels.host.nothingFound')}
                  </div>
                )
              }
              return sections.map(({ g, items }) => (
                <div key={g.id} role="group">
                  <div className="flex items-center gap-2 px-2.5 pb-1 pt-2">
                    <span className={PANEL_CAP}>{t(`admin.nodes.panels.host.${GROUP_LABEL[g.id]}`)}</span>
                    <span className="h-px flex-1 bg-border/70" />
                  </div>
                  {items.map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onPick(k)
                        close()
                      }}
                      className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      {L(k)}
                    </button>
                  ))}
                </div>
              ))
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
