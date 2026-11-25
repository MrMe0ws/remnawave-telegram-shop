import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Minus, Plus, X, type LucideIcon } from 'lucide-react'

import { Input, type InputProps } from '@/components/ui/input'

import { cn } from '@/lib/utils'
import { MULT_MAX, MULT_MIN, parseNum, stepMult } from './nodeForm'

/** Поле ввода со значком слева, как в панели Remna (лимит, день сброса, уведомление). */
export function IconInput({ icon: Icon, className, ...props }: InputProps & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input {...props} className={cn('pl-9', className)} />
    </div>
  )
}

/** Favicon провайдера: если не загрузился — прячем, а не показываем сломанную картинку. */
export function FaviconImg({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn('size-5 shrink-0 rounded object-contain', className)}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

/** Подпись, поле и ошибка под ним. */
export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 text-sm font-semibold">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </div>
      {hint && <div className="-mt-1 mb-1.5 text-[11.5px] text-muted-foreground">{hint}</div>}
      {children}
      {error && (
        <div role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}

/** Многострочное поле в стиле Input. */
export const TEXTAREA_CLASS =
  'flex min-h-[84px] w-full rounded-lg border border-input bg-card dark:bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--cabinet-accent)/0.4)] focus-visible:border-[hsl(var(--cabinet-accent)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input'

/** Множитель расхода: красная «−» слева, зелёная «+» справа, ввод посередине. */
export function MultiplierStepper({
  value,
  onChange,
  error,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  error?: boolean
  ariaLabel: string
}) {
  const v = parseNum(value)
  const btn = 'flex h-10 w-10 shrink-0 items-center justify-center border transition-colors disabled:opacity-40'
  return (
    <div className={cn('flex items-stretch overflow-hidden rounded-[10px] border', error ? 'border-destructive' : 'border-input')}>
      <button
        type="button"
        aria-label={`${ariaLabel} −`}
        disabled={Number.isFinite(v) && v <= MULT_MIN}
        onClick={() => onChange(stepMult(value, -1))}
        className={cn(btn, 'rounded-none border-0 border-r border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400')}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={() => {
          const n = parseNum(value)
          if (Number.isFinite(n)) onChange(Math.min(MULT_MAX, Math.max(MULT_MIN, n)).toFixed(1))
        }}
        className="h-10 min-w-0 flex-1 bg-background px-2 text-center font-mono text-sm font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring dark:bg-input"
      />
      <button
        type="button"
        aria-label={`${ariaLabel} +`}
        disabled={Number.isFinite(v) && v >= MULT_MAX}
        onClick={() => onChange(stepMult(value, 1))}
        className={cn(btn, 'rounded-none border-0 border-l border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400')}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}

const TAG_RE = /^[A-Z0-9_:]+$/
const TAG_MAX = 36

/** Теги: чипы + ввод. Enter, запятая, пробел и «;» добавляют чип; подсказки — известные теги нод. */
export function TagsInput({
  value,
  onChange,
  suggestions,
  placeholder,
  invalidText,
  removeLabel,
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions: string[]
  placeholder: string
  invalidText: string
  removeLabel: string
}) {
  const [text, setText] = useState('')
  const [focus, setFocus] = useState(false)
  const [bad, setBad] = useState(false)

  // Добавляет разобранные куски текста; возвращает остаток, который не прошёл проверку.
  const commit = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).filter(Boolean)
    const next = [...value]
    let rejected = ''
    for (const p of parts) {
      const tag = p.toUpperCase()
      if (!TAG_RE.test(tag) || tag.length > TAG_MAX) {
        rejected = p
        continue
      }
      if (!next.includes(tag)) next.push(tag)
    }
    if (next.length !== value.length) onChange(next)
    setBad(!!rejected)
    setText(rejected)
  }

  const free = suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(text.trim().toLowerCase())).slice(0, 8)

  return (
    <div>
      <div
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5 transition-colors dark:bg-input',
          focus ? 'border-[hsl(var(--cabinet-accent)/0.5)] ring-2 ring-ring' : 'border-input',
          bad && 'border-destructive',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 py-0.5 pl-2 pr-1 font-mono text-xs font-bold text-sky-700 dark:text-sky-300"
          >
            {tag}
            <button
              type="button"
              aria-label={`${removeLabel}: ${tag}`}
              onClick={() => onChange(value.filter((x) => x !== tag))}
              className="rounded p-0.5 hover:bg-sky-500/20"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          value={text}
          placeholder={value.length === 0 ? placeholder : ''}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false)
            if (text.trim()) commit(text)
          }}
          onChange={(e) => {
            const v = e.target.value
            setBad(false)
            if (/[\s,;]$/.test(v) && v.trim()) commit(v)
            else setText(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (text.trim()) commit(text)
            } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
              onChange(value.slice(0, -1))
            }
          }}
          className="h-6 min-w-[7rem] flex-1 border-0 bg-transparent px-1 text-sm shadow-none outline-none ring-0 placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
        />
      </div>
      {bad && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{invalidText}</div>}
      {focus && free.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {free.map((s) => (
            <button
              key={s}
              type="button"
              // mousedown, а не click: иначе поле теряет фокус раньше, и подсказка исчезает до нажатия.
              onMouseDown={(e) => {
                e.preventDefault()
                onChange([...value, s])
                setText('')
              }}
              className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
