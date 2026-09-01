import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import type { ReferralsResponse } from '@/lib/api'

/**
 * Приглашённые: кто пришёл по ссылке, сколько принёс и с нами ли ещё.
 *
 * Дни у каждой строки — то, ради чего список вообще открывают. Без них он
 * отвечал только на «кто у меня есть», а вопрос у человека другой: «и что мне
 * с них». Сумма по строкам сходится с «дней бонуса» в сводке — считает её тот
 * же журнал начислений.
 *
 * Подписи приходят готовыми и уже замаскированными. Раньше сервер отдавал
 * полные username и email, а звёздочки дорисовывал этот компонент — то есть
 * настоящие значения всё равно лежали в ответе и читались через devtools.
 *
 * Карточку и заголовок держит `ReferralSection`.
 */
export function ReferralRefereesList({ referees }: { referees: ReferralsResponse['referees'] }) {
  const { t } = useTranslation()

  if (!referees.length) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t('referralPage.emptyList')}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {referees.map((r, i) => (
        <li
          key={`${r.telegram_id_masked}-${i}`}
          className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-xs">
            {r.name || r.telegram_id_masked}
          </span>
          {/* Нулевые дни показываем прочерком, а не «+0 дн.»: приглашённый
              без оплат — обычное дело, и ноль в столбце дней читается как
              сбой начисления. */}
          {r.earned_days > 0 ? (
            <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {t('referralPage.days', { n: r.earned_days })}
            </span>
          ) : (
            <span className="shrink-0 text-sm text-muted-foreground">—</span>
          )}
          <Badge variant={r.active ? 'default' : 'secondary'} className="shrink-0">
            {r.active ? t('referralPage.badgeActive') : t('referralPage.badgeInactive')}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
