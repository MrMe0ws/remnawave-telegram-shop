import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { currentLocale } from '@/lib/format'
import type { ReferralLedgerRow } from '@/lib/api'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Лента «откуда взялись дни».
 *
 * Число «43 дня бонуса» само по себе не проверяется: человек видел его и не
 * понимал, из чего оно сложилось, — а непонятное начисление читается как
 * ошибка. Здесь каждое поимённо: кто, за что и сколько.
 *
 * Источник — журнал начислений, тот же, из которого считается сумма над
 * лентой. Поэтому строки складываются ровно в неё и разойтись не могут.
 *
 * Имена приходят с сервера уже замаскированными: показывать одному
 * пользователю чужой ник или почту целиком незачем, а «@i***k» своего
 * реферала человек узнаёт.
 *
 * Карточку и заголовок держит `ReferralSection` — список сам по себе, потому
 * что на телефоне он живёт свёрнутым.
 */
export function ReferralLedgerList({ rows }: { rows: ReferralLedgerRow[] }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  /*
   * За что начислено.
   *
   * Длину оплаченного периода дописываем, только когда она больше месяца: при
   * помесячном начислении именно она объясняет, почему за одну оплату пришло
   * не три дня, а восемнадцать. У строк бэкфилла периода нет — там ноль.
   */
  const reasonText = (row: ReferralLedgerRow): string => {
    const reason = t(`referralPage.ledger.kind.${row.kind}`, {
      defaultValue: t('referralPage.ledger.kind.other'),
    })
    if (!row.months || row.months <= 1) return reason
    return `${reason} · ${t('referralPage.ledger.months', { count: row.months })}`
  }

  if (!rows.length) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t('referralPage.ledger.empty')}
      </p>
    )
  }

  return (
    <motion.ul
      className="space-y-2"
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.045 } } }}
    >
      {rows.map((row, i) => (
        <motion.li
          key={`${row.created_at}-${i}`}
          variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.35, ease: EASE }}
          className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs">{row.actor}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{reasonText(row)}</p>
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {formatShortDate(row.created_at)}
          </span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {t('referralPage.days', { n: row.days })}
          </span>
        </motion.li>
      ))}
    </motion.ul>
  )
}

/** «12 авг» — дата в строке ленты. */
function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })
}
