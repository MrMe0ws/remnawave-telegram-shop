import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ListFilter, X } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Статусы партнёра из схемы: pending / active / suspended / rejected. */
export const PARTNER_STATUSES = ['pending', 'active', 'suspended', 'rejected'] as const
export type PartnerStatus = (typeof PARTNER_STATUSES)[number]

const STORAGE_KEY = 'admin_partner_status_filter'

/**
 * По умолчанию показываем только действующих партнёров.
 *
 * Заявку может подать кто угодно, и без фильтра список забивается мусором:
 * достаточно нескольких аккаунтов, чтобы отодвинуть настоящих партнёров за
 * вторую страницу. Отклонённые и замороженные остаются доступны — они просто
 * не мешают в первом же экране.
 */
const DEFAULT_STATUSES: PartnerStatus[] = ['active']

/** Выбор админа переживает перезагрузку: это настройка рабочего места. */
export function loadPartnerStatusFilter(): PartnerStatus[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_STATUSES
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_STATUSES
    // Пустой массив — осознанный выбор «показывать всех», не потеря значения.
    return parsed.filter((v): v is PartnerStatus =>
      PARTNER_STATUSES.includes(v as PartnerStatus),
    )
  } catch {
    // Приватный режим или заблокированное хранилище — работаем без памяти.
    return DEFAULT_STATUSES
  }
}

function savePartnerStatusFilter(value: PartnerStatus[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Не сохранилось — не повод ломать фильтрацию в текущей сессии.
  }
}

/**
 * Фильтр списка партнёров по статусу.
 *
 * Отбор идёт на сервере: выдача постраничная, и фильтрация уже полученных
 * строк теряла бы совпадения со следующих страниц.
 */
export function PartnerStatusFilter({
  value,
  onChange,
}: {
  value: PartnerStatus[]
  onChange: (next: PartnerStatus[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
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

  const apply = (next: PartnerStatus[]) => {
    savePartnerStatusFilter(next)
    onChange(next)
  }

  const toggle = (status: PartnerStatus) => {
    apply(
      value.includes(status)
        ? value.filter((s) => s !== status)
        : PARTNER_STATUSES.filter((s) => s === status || value.includes(s)),
    )
  }

  const summary = value.length
    ? value.map((s) => t(`admin.partners.status.${s}`)).join(', ')
    : t('admin.partners.filter.all')

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
          value.length
            ? 'border-primary/45 bg-primary/10 text-primary'
            : 'border-border bg-secondary hover:bg-border',
        )}
      >
        <ListFilter className="size-3.5 shrink-0" />
        <span className="max-w-[9rem] truncate">{summary}</span>
        {value.length > 0 && (
          <span className="rounded-full bg-primary/20 px-1.5 text-[10px] tabular-nums">{value.length}</span>
        )}
      </button>

      {open && (
        <div
          role="group"
          aria-label={t('admin.partners.filter.title')}
          /* Фон непрозрачный: список висит над таблицей, и сквозь него не
             должно быть видно строк. */
          className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-xl"
        >
          {PARTNER_STATUSES.map((status) => {
            const checked = value.includes(status)
            return (
              <button
                key={status}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(status)}
                className="flex min-h-10 w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50"
              >
                <span
                  className={cn(
                    'grid size-4 shrink-0 place-items-center rounded border',
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {checked && <Check className="size-3" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{t(`admin.partners.status.${status}`)}</span>
              </button>
            )
          })}

          {value.length > 0 && (
            <>
              <span className="my-1 block h-px bg-border" aria-hidden />
              <button
                type="button"
                onClick={() => apply([])}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <X className="size-3.5" />
                {t('admin.partners.filter.reset')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
