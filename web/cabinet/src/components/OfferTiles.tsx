import { cn } from '@/lib/utils'

/**
 * Плитки продающих блоков: результат расчёта и условие программы.
 *
 * Общие для партнёрской и реферальной страниц — там одинаковые ряды коротких
 * «подпись / крупное число / сноска», и разъезжались бы они первым же правкой
 * размера шрифта в одной из копий.
 */

/** Результат расчёта. `highlight` — тот итог, ради которого крутят ползунок. */
export function OfferOutBox({
  label,
  value,
  note,
  highlight,
}: {
  label: string
  value: string
  note: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        highlight ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-border bg-muted',
      )}
    >
      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-xl font-bold tabular-nums tracking-tight',
          highlight && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>
    </div>
  )
}

/** Условие программы: процент, дни — то, что задано настройками, а не расчётом. */
export function OfferTermTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-3">
      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-primary">{value}</p>
    </div>
  )
}
