import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { OfferGrowthChart } from '@/components/OfferGrowthChart'
import { OfferOutBox, OfferTermTile } from '@/components/OfferTiles'
import { Card, CardContent } from '@/components/ui/card'
import { formatDecimals } from '@/lib/format'

import {
  cumulative,
  DAYS_IN_FREE_MONTH,
  REFERRAL_HORIZON_MONTHS,
  referralMonthlyDays,
  type ReferralBonusRules,
} from './referralModel'

/** Границы ползунка. Верхняя равна горизонту: по модели друзья приходят по одному в месяц. */
const MIN_FRIENDS = 1
const MAX_FRIENDS = 10
const DEFAULT_FRIENDS = 3

/**
 * Калькулятор бонусных дней.
 *
 * Правила программы отвечают на вопрос «сколько мне начислят», но не на тот,
 * с которым сюда приходят, — «и что мне с этого». Ползунок переводит дни в
 * месяцы подписки, которые не придётся оплачивать.
 *
 * График показывает второе, чего не видно из списка правил: в прогрессивном
 * режиме бонус не разовый. Продления капают каждый месяц, поэтому кривая
 * продолжает расти и после того, как новых друзей уже нет.
 *
 * Считать в деньгах здесь нельзя, в отличие от партнёрской программы: средний
 * чек — внутренняя цифра, а рефералка и так платит днями. Дни человек проверит
 * по своей же статистике, и расхождения не будет.
 */
export function ReferralCalculator({ rules }: { rules: ReferralBonusRules }) {
  const { t } = useTranslation()
  const [friends, setFriends] = useState(DEFAULT_FRIENDS)

  const monthly = useMemo(() => referralMonthlyDays(friends, rules), [friends, rules])
  const totals = useMemo(() => cumulative(monthly), [monthly])
  const total = totals[totals.length - 1]
  const freeMonths = total / DAYS_IN_FREE_MONTH

  const sliderPercent = ((friends - MIN_FRIENDS) / (MAX_FRIENDS - MIN_FRIENDS)) * 100
  const recurring = rules.repeat > 0

  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
      <CardContent className="pt-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-stretch">
          <div className="flex flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">
              {t('referralPage.calc.kicker')}
            </p>
            <h2 className="mt-2 text-balance text-2xl font-bold tracking-tight lg:text-3xl">
              {t('referralPage.calc.title')}
            </h2>
            <p className="mt-2.5 text-sm text-muted-foreground">
              {recurring
                ? t('referralPage.calc.subtitle', { first: rules.first, repeat: rules.repeat })
                : t('referralPage.calc.subtitleOnce', { first: rules.first })}
            </p>

            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{t('referralPage.calc.friends')}</span>
                <span className="text-base font-bold tabular-nums">
                  {t('referralPage.calc.friendsValue', { count: friends })}
                </span>
              </div>
              <input
                type="range"
                min={MIN_FRIENDS}
                max={MAX_FRIENDS}
                step={1}
                value={friends}
                onChange={(e) => setFriends(Number(e.target.value))}
                className="cabinet-range"
                style={{ ['--p' as string]: `${sliderPercent}%` }}
                aria-label={t('referralPage.calc.friends')}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <OfferOutBox
                label={t('referralPage.calc.firstMonth')}
                value={t('referralPage.days', { n: monthly[0] })}
                note={t('referralPage.calc.firstMonthNote')}
              />
              <OfferOutBox
                label={t('referralPage.calc.year')}
                value={t('referralPage.days', { n: total })}
                note={t('referralPage.calc.yearNote', { months: formatDecimals(freeMonths, 1) })}
                highlight
              />
            </div>

            <div className={`mt-4 grid gap-2.5 ${recurring ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <OfferTermTile
                label={t('referralPage.calc.termFirst')}
                value={t('referralPage.days', { n: rules.first })}
              />
              {recurring ? (
                <OfferTermTile
                  label={t('referralPage.calc.termRepeat')}
                  value={t('referralPage.days', { n: rules.repeat })}
                />
              ) : null}
              {rules.referee > 0 ? (
                <OfferTermTile
                  label={t('referralPage.calc.termReferee')}
                  value={t('referralPage.days', { n: rules.referee })}
                />
              ) : null}
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-border bg-muted p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{t('referralPage.calc.chartTitle')}</span>
              <span className="text-xs text-muted-foreground">
                {t('referralPage.calc.chartTotal', { days: total })}
              </span>
            </div>

            <OfferGrowthChart
              values={totals}
              className="relative mt-3 h-[150px] w-full lg:h-auto lg:flex-1"
            />

            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{t('referralPage.calc.axisStart')}</span>
              <span>{t('referralPage.calc.axisMid')}</span>
              <span>{t('referralPage.calc.axisEnd', { n: REFERRAL_HORIZON_MONTHS })}</span>
            </div>

            {/* Без этой строчки прогноз читается как обещание. */}
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {recurring
                ? t('referralPage.calc.disclaimer')
                : t('referralPage.calc.disclaimerOnce')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
