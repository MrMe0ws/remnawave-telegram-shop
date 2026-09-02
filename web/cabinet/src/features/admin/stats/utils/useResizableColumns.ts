import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Ширины колонок таблицы, которые тянутся мышью и запоминаются у пользователя.
 *
 * Зачем: в узких карточках статистики колонок больше, чем места, и подобрать
 * ширины «на всех» нельзя — у кого-то коды промокодов из двух символов,
 * у кого-то из пятнадцати. Вместо того чтобы гадать за админа, даём ему
 * подвинуть границу самому; выбор переживает перезагрузку.
 *
 * Хранится в localStorage, а не на сервере: это настройка вида на конкретном
 * экране конкретного человека, ради неё не стоит заводить ни таблицу, ни ручку
 * API. Недоступное хранилище (приватное окно, запрет на данные сайта) не должно
 * ломать таблицу, поэтому чтение и запись обёрнуты.
 */
export interface ResizableColumn {
  key: string
  /** Ширина по умолчанию, px. */
  width: number
  /** Ниже этого не ужимается: колонка должна оставаться читаемой. */
  min: number
  /** Колонка тянется за остатком места и не имеет ручки (обычно последняя). */
  flex?: boolean
}

const STORAGE_PREFIX = 'cabinet.stats.columns.'
const MAX_WIDTH = 640

function readStored(key: string): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Record<string, number>
  } catch {
    return null
  }
}

function writeStored(key: string, value: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    /* приватное окно или запрет на данные сайта — молча живём с умолчаниями */
  }
}

export interface ResizableColumnsApi {
  /** Готовая строка для gridTemplateColumns. */
  template: string
  /** Повесить на ручку между заголовками. */
  startResize: (key: string, event: React.PointerEvent<HTMLElement>) => void
  /** Вернуть колонку к ширине по умолчанию (двойной клик по ручке). */
  resetColumn: (key: string) => void
  /** Есть ли вообще что сбрасывать. */
  customized: boolean
  resetAll: () => void
}

export function useResizableColumns(
  storageKey: string,
  columns: ResizableColumn[],
): ResizableColumnsApi {
  const defaults = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of columns) out[c.key] = c.width
    return out
  }, [columns])

  const [widths, setWidths] = useState<Record<string, number>>(defaults)

  // Читаем после монтирования: на сервере localStorage нет, а первый кадр
  // должен совпасть с серверным.
  useEffect(() => {
    const stored = readStored(storageKey)
    if (!stored) return
    setWidths((prev) => {
      const next = { ...prev }
      for (const c of columns) {
        const v = stored[c.key]
        if (typeof v === 'number' && Number.isFinite(v)) {
          next[c.key] = Math.min(Math.max(v, c.min), MAX_WIDTH)
        }
      }
      return next
    })
    // columns приходит константой из компонента; следим только за ключом.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persist = useCallback(
    (next: Record<string, number>) => {
      setWidths(next)
      writeStored(storageKey, next)
    },
    [storageKey],
  )

  const startResize = useCallback(
    (key: string, event: React.PointerEvent<HTMLElement>) => {
      const column = columns.find((c) => c.key === key)
      if (!column) return
      event.preventDefault()

      const startX = event.clientX
      const startWidth = widths[key] ?? column.width
      const handle = event.currentTarget
      handle.setPointerCapture(event.pointerId)

      let latest = startWidth
      const onMove = (e: PointerEvent) => {
        latest = Math.min(Math.max(startWidth + (e.clientX - startX), column.min), MAX_WIDTH)
        setWidths((prev) => ({ ...prev, [key]: latest }))
      }
      const onUp = () => {
        handle.releasePointerCapture(event.pointerId)
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onUp)
        handle.removeEventListener('pointercancel', onUp)
        setWidths((prev) => {
          const next = { ...prev, [key]: latest }
          writeStored(storageKey, next)
          return next
        })
      }
      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onUp)
      handle.addEventListener('pointercancel', onUp)
    },
    [columns, widths, storageKey],
  )

  const resetColumn = useCallback(
    (key: string) => {
      const column = columns.find((c) => c.key === key)
      if (!column) return
      persist({ ...widths, [key]: column.width })
    },
    [columns, widths, persist],
  )

  const resetAll = useCallback(() => persist({ ...defaults }), [defaults, persist])

  const template = useMemo(
    () =>
      columns
        .map((c) => (c.flex ? `minmax(${c.min}px, 1fr)` : `${widths[c.key] ?? c.width}px`))
        .join(' '),
    [columns, widths],
  )

  const customized = useMemo(
    () => columns.some((c) => !c.flex && (widths[c.key] ?? c.width) !== c.width),
    [columns, widths],
  )

  return { template, startResize, resetColumn, customized, resetAll }
}
