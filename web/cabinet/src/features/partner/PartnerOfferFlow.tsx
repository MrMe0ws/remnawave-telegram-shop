import { useEffect, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, Coins, CreditCard, Users } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { PartnerTerms } from '@/lib/api'

import { formatMoney, formatPercent } from './format'

/**
 * Механика программы схемой, а не списком шагов.
 *
 * «Аудитория → ссылка → оплата → баланс» — это на самом деле поток, и список
 * из четырёх пунктов заставлял читать то, что можно показать. Импульсы,
 * бегущие по связям, дочитывают за текст: деньги приходят не один раз.
 *
 * Разметка одна на обе версии — направление задаёт брейкпоинт: на широком
 * экране колонки, на узком строки, и связки поворачиваются вместе с ними.
 */
export function PartnerOfferFlow({ terms }: { terms: PartnerTerms }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold tracking-tight">{t('partnerPage.flow.title')}</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          {t('partnerPage.flow.subtitle', {
            first: formatPercent(terms.first_percent),
            renewal: formatPercent(terms.renewal_percent),
          })}
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-0">
          <FlowNode
            icon={Users}
            title={t('partnerPage.flow.n1')}
            text={t('partnerPage.flow.n1sub', { max: terms.max_links })}
          />
          <Connector />
          <FlowNode icon={ArrowUpRight} title={t('partnerPage.flow.n2')} text={t('partnerPage.flow.n2sub')} />
          <Connector delay="0.5s" />
          <FlowNode
            icon={CreditCard}
            title={t('partnerPage.flow.n3')}
            text={t('partnerPage.flow.n3sub', {
              first: formatPercent(terms.first_percent),
              renewal: formatPercent(terms.renewal_percent),
            })}
          />
          <Connector delay="1s" />
          <FlowNode
            icon={Coins}
            title={t('partnerPage.flow.n4')}
            value={<BalanceTicker />}
            accent
          />
        </div>
      </CardContent>
    </Card>
  )
}

function FlowNode({
  icon: Icon,
  title,
  text,
  value,
  accent,
}: {
  icon: LucideIcon
  title: string
  text?: string
  /** Вместо пояснения — итог узла: сумма на балансе. */
  value?: ReactNode
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        accent ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-border bg-muted/40',
      )}
    >
      <div
        className={cn(
          'mb-2.5 flex size-8 items-center justify-center rounded-lg',
          accent ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-primary/12 text-primary',
        )}
      >
        <Icon size={17} />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {value ?? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>}
    </div>
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

/**
 * Связка между узлами: линия и бегущий по ней импульс.
 *
 * Смещение по времени задаётся вызывающей стороной, чтобы импульсы шли
 * очередью, а не тремя синхронными точками — синхронные читаются как мигание,
 * а не как движение.
 */
function Connector({ delay }: { delay?: string }) {
  return (
    <div className="partner-flow-link" aria-hidden>
      <span className="partner-flow-line" />
      <span className="partner-flow-pulse" style={delay ? { animationDelay: delay } : undefined} />
    </div>
  )
}
