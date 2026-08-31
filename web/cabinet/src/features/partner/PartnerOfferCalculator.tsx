import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HandCoins } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api, type PartnerTerms } from '@/lib/api'

import { formatMoney, formatPercent } from './format'
import { PartnerIncomeChart } from './PartnerIncomeChart'

/** Горизонт расчёта: год — тот срок, на котором видно накопление продлений. */
const MONTHS = 12

/**
 * Средний чек, если витрина тарифов недоступна.
 *
 * Не «магическое число ради числа»: калькулятор без чека не считает вообще, а
 * пустой блок вместо оффера хуже, чем оценка по round-числу с честной подписью.
 */
const FALLBACK_CHECK = 500

/**
 * Оффер с калькулятором дохода.
 *
 * Проценты сами по себе не отвечают на вопрос, с которым сюда приходят:
 * «сколько это в деньгах». Ползунок переводит их в сумму, а график показывает
 * то, чего не видно из двух цифр, — 20% с продлений капают дальше, поэтому
 * доход не разовый, а накапливается вместе с базой приведённых клиентов.
 *
 * Средний чек берём из публичной витрины тарифов: цены и так открыты на
 * /tariffs, поэтому утечкой это не является. Выручку или реальные средние
 * сюда тянуть нельзя — это уже внутренние цифры.
 */
export function PartnerOfferCalculator({
  terms,
  onApply,
  canApply,
}: {
  terms: PartnerTerms
  onApply: () => void
  canApply: boolean
}) {
  const { t } = useTranslation()
  const [clients, setClients] = useState(30)

  const { data: tariffs } = useQuery({
    queryKey: ['tariffs'],
    queryFn: () => api.tariffs(),
    staleTime: 5 * 60_000,
  })

  // Медиана, а не среднее: один дорогой тариф на пять устройств утащил бы
  // среднее вверх и превратил оценку в обещание.
  const check = useMemo(() => {
    const prices = (tariffs?.tariffs ?? [])
      .map((row) => row.monthly_base_rub)
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b)
    if (!prices.length) return FALLBACK_CHECK
    return Math.round(prices[Math.floor(prices.length / 2)])
  }, [tariffs])

  const series = useMemo(() => monthlyIncome(clients, check, terms), [clients, check, terms])
  // График показывает накопленный доход: помесячный в этой модели прибавляется
  // на одну и ту же величину и рисуется прямой линией.
  const cumulative = useMemo(() => {
    let acc = 0
    return series.map((v) => (acc += v))
  }, [series])
  const total = cumulative[cumulative.length - 1]

  const sliderPercent = ((clients - 5) / 195) * 100

  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
      <CardContent className="pt-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-stretch">
          <div className="flex flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">
              {t('partnerPage.landing.kicker')}
            </p>
            <h2 className="mt-2 text-balance text-2xl font-bold tracking-tight lg:text-3xl">
              {t('partnerPage.landing.title')}
            </h2>
            <p className="mt-2.5 text-sm text-muted-foreground">
              {t('partnerPage.landing.subtitleShort', {
                first: formatPercent(terms.first_percent),
                renewal: formatPercent(terms.renewal_percent),
              })}
            </p>

            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{t('partnerPage.calc.clients')}</span>
                <span className="text-base font-bold tabular-nums">{clients}</span>
              </div>
              <input
                type="range"
                min={5}
                max={200}
                step={5}
                value={clients}
                onChange={(e) => setClients(Number(e.target.value))}
                className="partner-range"
                style={{ ['--p' as string]: `${sliderPercent}%` }}
                aria-label={t('partnerPage.calc.clients')}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <OutBox
                label={t('partnerPage.calc.firstMonth')}
                value={formatMoney(series[0])}
                note={t('partnerPage.calc.firstMonthNote')}
              />
              <OutBox
                label={t('partnerPage.calc.lastMonth', { n: MONTHS })}
                value={formatMoney(series[MONTHS - 1])}
                note={t('partnerPage.calc.lastMonthNote')}
                highlight
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <TermTile
                label={t('partnerPage.landing.firstPayment')}
                value={formatPercent(terms.first_percent)}
              />
              <TermTile
                label={t('partnerPage.landing.renewals')}
                value={formatPercent(terms.renewal_percent)}
              />
            </div>

            {canApply ? (
              <Button size="lg" className="mt-5 w-full gap-2" onClick={onApply}>
                <HandCoins size={18} />
                {t('partnerPage.landing.cta')}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{t('partnerPage.calc.chartTitle')}</span>
              <span className="text-xs text-muted-foreground">
                {t('partnerPage.calc.chartTotal', { amount: formatMoney(total) })}
              </span>
            </div>

            <PartnerIncomeChart
              values={cumulative}
              className="relative mt-3 h-[150px] w-full lg:h-auto lg:flex-1"
            />

            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{t('partnerPage.calc.axisStart')}</span>
              <span>{t('partnerPage.calc.axisMid')}</span>
              <span>{t('partnerPage.calc.axisEnd')}</span>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {t('partnerPage.calc.disclaimer', { check: formatMoney(check) })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Доход по месяцам.
 *
 * В месяце m новые клиенты дают первую оплату, а все приведённые раньше —
 * продление. Отсюда и рост: база накапливается, а процент с неё повторяется.
 * Отток не учитываем — об этом говорит подпись под графиком.
 */
function monthlyIncome(clients: number, check: number, terms: PartnerTerms): number[] {
  const first = (terms.first_percent / 100) * check * clients
  const renewal = (terms.renewal_percent / 100) * check * clients
  return Array.from({ length: MONTHS }, (_, i) => first + renewal * i)
}

function OutBox({
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
      className={
        highlight
          ? 'rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3'
          : 'rounded-xl border border-border bg-muted/40 p-3'
      }
    >
      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          highlight
            ? 'mt-0.5 text-xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400'
            : 'mt-0.5 text-xl font-bold tabular-nums tracking-tight'
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>
    </div>
  )
}

export function TermTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-primary">{value}</p>
    </div>
  )
}
