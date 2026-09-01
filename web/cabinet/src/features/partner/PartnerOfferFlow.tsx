import { useEffect, useState } from 'react'
import { ArrowUpRight, Coins, CreditCard, Users } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { OfferFlow } from '@/components/OfferFlow'
import { Card, CardContent } from '@/components/ui/card'
import type { PartnerTerms } from '@/lib/api'

import { formatMoney, formatPercent } from './format'

/**
 * Механика партнёрской программы схемой: аудитория → ссылка → оплата → баланс.
 *
 * Сама схема живёт в общем OfferFlow — её одинаково просят обе программы,
 * и различаются они только содержимым узлов.
 */
export function PartnerOfferFlow({ terms }: { terms: PartnerTerms }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <h2 className="text-lg font-semibold tracking-tight">{t('partnerPage.flow.title')}</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          {t('partnerPage.flow.subtitle', {
            first: formatPercent(terms.first_percent),
            renewal: formatPercent(terms.renewal_percent),
          })}
        </p>

        <OfferFlow
          className="mt-5"
          nodes={[
            {
              icon: Users,
              title: t('partnerPage.flow.n1'),
              text: t('partnerPage.flow.n1sub', { max: terms.max_links }),
            },
            {
              icon: ArrowUpRight,
              title: t('partnerPage.flow.n2'),
              text: t('partnerPage.flow.n2sub'),
            },
            {
              icon: CreditCard,
              title: t('partnerPage.flow.n3'),
              text: t('partnerPage.flow.n3sub', {
                first: formatPercent(terms.first_percent),
                renewal: formatPercent(terms.renewal_percent),
              }),
            },
            {
              icon: Coins,
              title: t('partnerPage.flow.n4'),
              value: <BalanceTicker />,
              accent: true,
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}

/** Стартовая сумма и шаг «прироста» — величины декоративные, не расчётные. */
const TICKER_START = 24_800
const TICKER_STEP_MS = 4_000

/**
 * Набегающая сумма в узле «Ваш баланс».
 *
 * Число здесь иллюстративное: это схема механики, а не чей-то настоящий
 * баланс. Живое число объясняет главное свойство программы — деньги приходят
 * не один раз, — нагляднее, чем ещё одна строка текста.
 */
function BalanceTicker() {
  const reduceMotion = useReducedMotion()
  const [amount, setAmount] = useState(TICKER_START)

  useEffect(() => {
    if (reduceMotion) return
    const id = window.setInterval(() => {
      setAmount((v) => v + 40 + Math.round(Math.random() * 260))
    }, TICKER_STEP_MS)
    return () => window.clearInterval(id)
  }, [reduceMotion])

  return (
    <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
      {formatMoney(amount)}
    </p>
  )
}
