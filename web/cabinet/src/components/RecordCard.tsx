import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Запись таблицы в виде карточки — для узких экранов.
 *
 * Таблица истории на телефоне не помещается ни в какой вёрстке: колонок семь, а
 * ширины — 360 точек. Горизонтальная прокрутка формально спасает, но читать так
 * нельзя: половина строки всегда за краем, и чтобы сверить сумму со статусом,
 * приходится возить экран туда-обратно.
 *
 * Поэтому на мобильном та же запись разворачивается вертикально: слева
 * название поля, справа значение, а итоговый статус — отдельной строкой во всю
 * ширину, потому что именно он отвечает на вопрос «чем всё кончилось».
 * Колоночная таблица остаётся там, где для неё есть место.
 */
export interface RecordRow {
  label: string
  value: ReactNode
  /** Реквизиты, чеки и коды — моноширинным: их сверяют посимвольно. */
  mono?: boolean
}

export function RecordCard({
  rows,
  footer,
  onClick,
  className,
}: {
  rows: RecordRow[]
  footer?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border border-border bg-card p-3 text-left',
        onClick && 'transition-colors hover:bg-accent/40',
        className,
      )}
    >
      <dl className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-sm">
            <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
            <dd className={cn('min-w-0 break-words text-right', row.mono ? 'font-mono text-xs' : 'font-medium')}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {footer ? <div className="mt-2.5">{footer}</div> : null}
    </Tag>
  )
}
