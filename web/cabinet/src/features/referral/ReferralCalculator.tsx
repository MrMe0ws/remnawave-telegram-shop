import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift } from 'lucide-react'

import { OfferGrowthChart, niceCeil, type OfferGrowthTick } from '@/components/OfferGrowthChart'
import { Card, CardContent } from '@/components/ui/card'
import { formatDecimals } from '@/lib/format'

import { ReferralTerms } from './ReferralTerms'
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
 * Итог — одно крупное число, а не набор плиток. Раньше рядом стояли «первый
 * месяц», «за год» и три плитки условий: пять чисел на блок, из которых
 * человек не понимал, какое главное. Условия ушли вниз отдельной строкой, где
 * они читаются как справка, а не спорят с результатом.
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

  // Потолок шкалы округляем вверх до круглого: подписи оси обязаны читаться,
  // а максимум ряда круглым не бывает — «111» на оси ничего не объясняет.
  const ceiling = useMemo(() => niceCeil(total), [total])
  const ticks: OfferGrowthTick[] = useMemo(
    () => [
      { label: String(ceiling), at: 1 },
      { label: String(ceiling / 2), at: 0.5 },
      { label: '0', at: 0 },
    ],
    [ceiling],
  )

  const sliderPercent = ((friends - MIN_FRIENDS) / (MAX_FRIENDS - MIN_FRIENDS)) * 100
  const recurring = rules.repeat > 0

  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
      <CardContent className="pt-4 sm:pt-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <Gift size={13} />
          {t('referralPage.calc.kicker')}
        </span>

        <h2 className="mt-2.5 text-balance text-2xl font-bold tracking-tight lg:text-3xl">
          {t('referralPage.calc.title')}
        </h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:items-center sm:gap-7">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
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
            <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
              <span>{MIN_FRIENDS}</span>
              <span>{MAX_FRIENDS}</span>
            </div>
          </div>

          <div>
            <p className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tabular-nums tracking-tight text-primary">
                {total}
              </span>
              <span className="text-sm text-muted-foreground">
                {t('referralPage.calc.payoffDays')}
              </span>
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t('referralPage.calc.payoffMonths', { months: formatDecimals(freeMonths, 1) })}
            </p>
            {rules.referee > 0 ? (
              <p className="mt-2 border-t border-dashed border-border pt-2 text-sm text-muted-foreground">
                {t('referralPage.calc.refereeGift', {
                  days: t('referralPage.days', { n: rules.referee }),
                })}
              </p>
            ) : null}
          </div>
        </div>

        <OfferGrowthChart
          values={totals}
          max={ceiling}
          ticks={ticks}
          className="relative mt-5 h-[190px] w-full"
        />

        {/* Отступ слева тот же, что жёлоб подписей: иначе «1 мес.» уезжает
            левее начала самого графика. */}
        <div className="mt-2 flex justify-between pl-8 text-[11px] text-muted-foreground">
          <span>{t('referralPage.calc.axisStart')}</span>
          <span>{t('referralPage.calc.axisMid')}</span>
          <span>{t('referralPage.calc.axisEnd', { n: REFERRAL_HORIZON_MONTHS })}</span>
        </div>

        {/* Без этой строчки прогноз читается как обещание. */}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {recurring ? t('referralPage.calc.disclaimer') : t('referralPage.calc.disclaimerOnce')}
        </p>

        <ReferralTerms rules={rules} className="mt-5" />

      </CardContent>
    </Card>
  )
}
