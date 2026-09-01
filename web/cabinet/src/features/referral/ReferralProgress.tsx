import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Gift } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import type { ReferralsStatsResponse } from '@/lib/api'

import {
  DAYS_IN_FREE_MONTH,
  eventsToCloseMonth,
  freeMonthsFromDays,
  type ReferralBonusRules,
} from './referralModel'

/**
 * Прогресс до следующего бесплатного месяца.
 *
 * Число «43 дня бонуса» само по себе ничего не значит: человек не считает в
 * уме, много это или мало. Поэтому главное здесь — остаток до месяца, набранный
 * крупно, а всё остальное подчинено ему.
 *
 * Кольца тут больше нет, хотя оно и совпадало по языку с трафиком и
 * устройствами на главной. На типичных значениях дуга почти пустая (2 из 30) и
 * читается как «ты ничего не набрал», а число в её центре спорило с числом в
 * заголовке: «2» внутри кольца и «28 дн.» рядом — про одно и то же, но
 * человеку приходилось соображать, какое из них его. Полоса говорит ровно то
 * же самое одной строкой и экономит около 70px высоты на телефоне.
 *
 * Заодно отсюда убраны: бейдж «Всего начислено», повторявший плитку «Дней
 * бонуса» в этой же карточке, и дорожка из пяти месяцев с подписью — вместо
 * неё один чип с числом уже заработанных бесплатных месяцев.
 *
 * Никаких новых механик здесь нет: веха — это те же 30 дней, а не придуманный
 * тир с наградой, которой бэкенд не умеет выдавать.
 */
export function ReferralProgress({
  stats,
  rules,
}: {
  stats: ReferralsStatsResponse
  rules: ReferralBonusRules
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  const earned = Math.max(0, stats.earned_days_total ?? 0)
  const { months, remainder } = freeMonthsFromDays(earned)
  const remaining = DAYS_IN_FREE_MONTH - remainder
  const target = (remainder / DAYS_IN_FREE_MONTH) * 100

  /*
   * Полоса набегает от нуля: значение выставляется после монтирования, чтобы
   * сработал transition на width. При prefers-reduced-motion стартуем сразу с
   * итогового — иначе получился бы скачок вместо анимации.
   */
  const [barValue, setBarValue] = useState(reduceMotion ? target : 0)
  useEffect(() => {
    if (reduceMotion) {
      setBarValue(target)
      return
    }
    const id = window.requestAnimationFrame(() => setBarValue(target))
    return () => window.cancelAnimationFrame(id)
  }, [target, reduceMotion])

  const needFriends = eventsToCloseMonth(remaining, rules.first)
  const needRenewals = eventsToCloseMonth(remaining, rules.repeat)
  const friendsText =
    needFriends != null ? t('referralPage.progress.friends', { count: needFriends }) : null
  const renewalsText =
    needRenewals != null ? t('referralPage.progress.renewals', { count: needRenewals }) : null

  // Начисления, которых в режиме нет, в подсказке не упоминаем: обещать «ещё
  // три продления» там, где платят только за первую оплату, — это обман,
  // который человек заметит через месяц.
  let hint = ''
  if (friendsText && renewalsText) {
    hint = t('referralPage.progress.needBoth', { friends: friendsText, renewals: renewalsText })
  } else if (friendsText) {
    hint = friendsText
  } else if (renewalsText) {
    hint = renewalsText
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] text-muted-foreground sm:text-sm">
              {t('referralPage.progress.toFreeMonth')}
            </p>
            <p className="mt-1 text-3xl font-extrabold leading-none tracking-tight tabular-nums sm:text-4xl">
              {t('referralPage.progress.daysLeft', { count: remaining })}
            </p>
          </div>

          {/* Чип есть только у того, кто уже закрыл хотя бы один месяц: у
              остальных он показывал бы ноль, а ноль в награде читается как
              «не получилось». */}
          {months > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Gift size={13} />
              {t('referralPage.progress.freeMonthsEarned', { count: months })}
            </span>
          ) : null}
        </div>

        {/* aria-hidden: полоса дублирует подпись под ней, и для скринридера
            это лишний процент без единиц. */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ width: `${barValue}%` }}
          />
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3 text-[11.5px] text-muted-foreground sm:text-xs">
          <span className="shrink-0 tabular-nums">
            {t('referralPage.progress.barProgress', {
              n: remainder,
              total: DAYS_IN_FREE_MONTH,
            })}
          </span>
          {hint ? <span className="min-w-0 truncate text-right">{hint}</span> : null}
        </div>

        {/* Три в ряд и на телефоне: это одна сводка, а не три независимых
            карточки, и в столбик она занимает пол-экрана ни за чем.
            Вторых строк («активных: 1», «за месяц: 32», «оплатили: 1») здесь
            больше нет — девять чисел на сводку не читаются, а те же данные
            стоят поимённо в списках ниже. */}
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile label={t('referralPage.statTotal')} value={String(stats.total ?? 0)} />
          <StatTile label={t('referralPage.statEarnedDays')} value={String(earned)} />
          <StatTile
            label={t('referralPage.statConversion')}
            value={`${stats.conversion_pct ?? 0}%`}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-2.5 sm:p-3">
      <p className="text-xl font-semibold leading-none tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground sm:text-xs">{label}</p>
    </div>
  )
}
