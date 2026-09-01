import { useTranslation } from 'react-i18next'
import { BarChart3, HandCoins } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { PartnerTerms } from '@/lib/api'

import { formatMoney } from './format'

/**
 * Витрина кабинета партнёра.
 *
 * Показывает не обещание, а инструмент: баланс с холдом, потоки под каждую
 * площадку со своей статистикой, выплаты. Это и есть отличие от обычной
 * реферальной ссылки, и словами оно передаётся хуже, чем картинкой.
 *
 * Числа здесь выдуманные и помечены как пример — иначе чужой баланс на экране
 * читается как чей-то настоящий, а таких данных партнёру видеть нельзя.
 */
export function PartnerOfferPreview({
  terms,
  onApply,
  canApply,
}: {
  terms: PartnerTerms
  onApply: () => void
  canApply: boolean
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <h2 className="text-balance text-xl font-bold tracking-tight lg:text-2xl">
              {t('partnerPage.preview.title')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t('partnerPage.preview.subtitle', {
                max: terms.max_links,
                days: terms.hold_days,
                min: formatMoney(terms.min_payout),
              })}
            </p>

            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                {t('partnerPage.preview.p1')}
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                {t('partnerPage.preview.p2')}
              </li>
            </ul>

            {canApply ? (
              <Button className="mt-5 w-full gap-2 sm:w-auto" onClick={onApply}>
                <HandCoins size={17} />
                {t('partnerPage.landing.cta')}
              </Button>
            ) : null}
          </div>

          {/* Скриншот кабинета. Отдельная заливка и рамка нужны как раз здесь:
              блок изображает другой экран, и без границы он сливается с
              карточкой, в которой лежит. */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t('partnerPage.preview.shotTitle')}</span>
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {t('partnerPage.preview.sample')}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label={t('partnerPage.overview.available')} value="18 400 ₽" money />
              <Stat label={t('partnerPage.overview.onHold')} value="3 200 ₽" />
              <Stat label={t('partnerPage.overview.paidOut')} value="96 700 ₽" />
            </div>

            <div className="mt-2 rounded-xl border border-border bg-background/70 p-3">
              <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>{t('partnerPage.preview.chartLabel')}</span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">+41%</span>
              </div>
              {/* Цвет на самом svg: currentColor в <defs> разрешается по
                  градиенту, а не по ссылающемуся на него пути. */}
              <svg
                viewBox="0 0 280 54"
                preserveAspectRatio="none"
                className="h-[54px] w-full text-primary"
                aria-hidden
              >
                <defs>
                  <linearGradient id="partner-preview-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#partner-preview-fill)"
                  d="M0,44 L47,38 L93,40 L140,28 L187,22 L233,14 L280,8 L280,54 L0,54 Z"
                />
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  d="M0,44 L47,38 L93,40 L140,28 L187,22 L233,14 L280,8"
                />
              </svg>
            </div>

            <div className="mt-2 space-y-1.5">
              <StreamRow name={t('partnerPage.preview.s1')} meta="142" amount="+8 100 ₽" />
              <StreamRow name={t('partnerPage.preview.s2')} meta="89" amount="+5 400 ₽" />
              <StreamRow name={t('partnerPage.preview.s3')} meta="31" amount="+1 900 ₽" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, money }: { label: string; value: string; money?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-2.5">
      <p className="text-[9.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          money
            ? 'mt-0.5 text-base font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400'
            : 'mt-0.5 text-base font-bold tabular-nums tracking-tight'
        }
      >
        {value}
      </p>
    </div>
  )
}

function StreamRow({ name, meta, amount }: { name: string; meta: string; amount: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-3 py-2">
      <span className="min-w-0 truncate text-xs">
        <span className="font-semibold">{name}</span>{' '}
        <span className="text-muted-foreground">· {t('partnerPage.preview.clicks', { n: meta })}</span>
      </span>
      <span className="shrink-0 text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
        {amount}
      </span>
    </div>
  )
}
