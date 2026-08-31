import { useEffect, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReferralsStatsResponse } from '@/lib/api'

import {
  DAYS_IN_FREE_MONTH,
  eventsToCloseMonth,
  freeMonthsFromDays,
  type ReferralBonusRules,
} from './referralModel'

/** Сколько месяцев показывать в дорожке: закрытые, текущий и пара впереди. */
const TRACK_LENGTH = 5

/**
 * Прогресс до следующего бесплатного месяца.
 *
 * Число «43 дня бонуса» само по себе ничего не значит: человек не считает в
 * уме, много это или мало. Кольцо переводит его в единицу, в которой подписка
 * и продаётся, — в месяцы, а подпись превращает остаток в действие: «ещё два
 * друга» понятнее, чем «ещё 17 дней».
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
   * Дуга набегает от нуля: значение выставляется после монтирования, чтобы
   * сработал transition на --cabinet-ring-value. При prefers-reduced-motion
   * стартуем сразу с итогового — иначе получился бы скачок вместо анимации.
   */
  const [ringValue, setRingValue] = useState(reduceMotion ? target : 0)
  useEffect(() => {
    if (reduceMotion) {
      setRingValue(target)
      return
    }
    const id = window.requestAnimationFrame(() => setRingValue(target))
    return () => window.cancelAnimationFrame(id)
  }, [target, reduceMotion])

  const needFriends = eventsToCloseMonth(remaining, rules.first)
  const needRenewals = eventsToCloseMonth(remaining, rules.repeat)
  const friendsText =
    needFriends != null ? t('referralPage.progress.friends', { count: needFriends }) : null
  const renewalsText =
    needRenewals != null ? t('referralPage.progress.renewals', { count: needRenewals }) : null

  let hint = ''
  if (friendsText && renewalsText) {
    hint = t('referralPage.progress.hintBoth', { friends: friendsText, renewals: renewalsText })
  } else if (friendsText) {
    hint = t('referralPage.progress.hintFriends', { friends: friendsText })
  } else if (renewalsText) {
    hint = t('referralPage.progress.hintRenewals', { renewals: renewalsText })
  }

  // Дорожка едет за прогрессом: у кого закрыто восемь месяцев, первые семь
  // уже неинтересны, а текущий должен остаться в кадре.
  const trackStart = Math.max(0, months - 2)

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-7">
          <div
            className="cabinet-ring cabinet-ring--animate mx-auto shrink-0 sm:mx-0"
            style={
              {
                width: 140,
                ['--cabinet-ring-value']: ringValue,
              } as CSSProperties
            }
          >
            <div className="text-center leading-none">
              <p className="text-3xl font-bold tabular-nums">{remainder}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {t('referralPage.progress.ofDays', { n: DAYS_IN_FREE_MONTH })}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {t('referralPage.progress.earned', { n: earned })}
            </span>
            <h2 className="mt-2 text-balance text-xl font-bold tracking-tight">
              {t('referralPage.progress.title', { n: remaining })}
            </h2>
            {/* Начисления, которых в режиме нет, в подсказке не упоминаем:
                обещать «ещё три продления» там, где платят только за первую
                оплату, — это обман, который человек заметит через месяц. */}
            {hint ? <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p> : null}

            <div className="mt-4 flex gap-1.5" aria-hidden>
              {Array.from({ length: TRACK_LENGTH }, (_, i) => {
                const index = trackStart + i
                const done = index < months
                const now = index === months
                return (
                  <span
                    key={index}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center rounded-lg border text-[11px] font-semibold tabular-nums',
                      done && 'border-primary/40 bg-primary/12 text-primary',
                      now && 'border-dashed border-primary bg-transparent text-foreground',
                      !done && !now && 'border-border bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </span>
                )
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {t('referralPage.progress.trackNote')}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatTile
            label={t('referralPage.statTotal')}
            value={String(stats.total ?? 0)}
            sub={t('referralPage.statActiveSub', { n: stats.active ?? 0 })}
          />
          <StatTile
            label={t('referralPage.statEarnedDays')}
            value={String(earned)}
            sub={t('referralPage.statLastMonth', { n: stats.earned_days_last_month ?? 0 })}
          />
          <StatTile
            label={t('referralPage.statConversion')}
            value={`${stats.conversion_pct ?? 0}%`}
            sub={t('referralPage.statPaid', { n: stats.paid ?? 0 })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}
