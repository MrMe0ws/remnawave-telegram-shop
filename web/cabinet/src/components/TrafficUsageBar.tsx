import { Infinity as InfinityIcon } from 'lucide-react'

import { cn, trafficUsagePercent } from '@/lib/utils'
import { trafficTone, type ToneLevel } from '@/lib/subscriptionTone'

type Props = {
  usedGb?: number | null
  limitGb?: number | null
  usageTitle: string
  gigabytesLabel: string
  unlimitedLabel: string
  className?: string
}

/**
 * Расход трафика.
 *
 * При безлимите **шкалы нет**. Полоса прогресса отвечает на вопрос «сколько
 * из X осталось»; без X любое её состояние сообщает неправду. Раньше здесь
 * было `fillWidth = percent ?? 100`, то есть безлимитному пользователю
 * рисовалась полностью залитая полоса — универсальный знак «лимит исчерпан»,
 * и слово «Безлимит» мелким текстом рядом эту полосу не переспоривало.
 *
 * Заодно вернулся фактический расход: прежний формат при безлимите отдавал
 * только слово «Безлимит» и выбрасывал гигабайты, хотя это единственная
 * содержательная цифра о трафике на таком тарифе.
 */
export function TrafficUsageBar({
  usedGb,
  limitGb,
  usageTitle,
  gigabytesLabel,
  unlimitedLabel,
  className,
}: Props) {
  const percent = trafficUsagePercent(usedGb, limitGb)
  const unlimited = percent === null
  const used = Math.max(0, usedGb ?? 0)
  const tone = trafficTone(percent)

  return (
    <div className={className}>
      {/* Кегль мельче основного текста: показатели — фон, а не заголовок карточки. */}
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground dark:text-slate-300">{usageTitle}</span>
        <span
          className={cn(
            'flex items-center gap-1 font-semibold tabular-nums',
            tone === 'calm' ? 'text-foreground' : TONE_TEXT[tone],
          )}
        >
          {unlimited ? (
            <>
              {used.toFixed(1)} {gigabytesLabel}
              <span className="text-muted-foreground/70">/</span>
              <InfinityIcon size={14} aria-label={unlimitedLabel} />
            </>
          ) : (
            `${used.toFixed(1)} / ${limitGb} ${gigabytesLabel}`
          )}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full bg-muted dark:bg-white/10">
          <div
            className={cn('h-full rounded-full transition-all duration-500', TONE_FILL[tone])}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}

const TONE_TEXT: Record<ToneLevel, string> = {
  calm: '',
  warn: 'font-medium text-amber-700 dark:text-amber-300',
  danger: 'font-medium text-destructive',
}

const TONE_FILL: Record<ToneLevel, string> = {
  calm: 'bg-gradient-to-r from-primary via-primary/90 to-primary/70',
  warn: 'bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600 dark:from-amber-400 dark:via-orange-400 dark:to-amber-500',
  danger:
    'bg-gradient-to-r from-red-600 via-red-500 to-rose-600 dark:from-red-500 dark:via-red-400 dark:to-[#c70000]',
}
