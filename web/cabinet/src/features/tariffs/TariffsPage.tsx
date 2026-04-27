import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Zap } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, type SubscriptionResponse, type TariffItem } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

export default function TariffsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const planSlug = (searchParams.get('plan') ?? '').trim()
  const { user } = useAuthStore()
  const verified = user?.email_verified ?? false

  const { data, isLoading, error } = useQuery({
    queryKey: ['tariffs'],
    queryFn: () => api.tariffs(),
    staleTime: 5 * 60_000,
  })

  const { data: sub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.subscription(),
    staleTime: 60_000,
    enabled: verified,
  })

  function setPlan(slug: string) {
    setSearchParams({ plan: slug })
  }

  function clearPlan() {
    setSearchParams({})
  }

  function handleCheckout(tariff: TariffItem) {
    navigate(`/checkout?tariff=${encodeURIComponent(tariff.slug)}&months=${tariff.months}`)
  }

  const classicSorted =
    data?.sales_mode !== 'tariffs' && data?.tariffs
      ? [...data.tariffs].sort((a, b) => a.months - b.months)
      : null

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t('tariffs.title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('tariffs.subtitle')}</p>
        </div>

        {isLoading && <TariffsSkeleton />}

        {error && (
          <p className="text-sm text-destructive">{t('errors.unknown')}</p>
        )}

        {data && data.sales_mode === 'tariffs' && !planSlug && (
          <TariffsGrid tariffs={data.tariffs} onChoosePlan={setPlan} sub={sub} />
        )}

        {data && data.sales_mode === 'tariffs' && planSlug && (
          <TariffPeriodStep
            slug={planSlug}
            tariffs={data.tariffs}
            onBack={clearPlan}
            onSelect={handleCheckout}
          />
        )}

        {data && data.sales_mode !== 'tariffs' && classicSorted && !planSlug && (
          <ClassicIntro sorted={classicSorted} onContinue={() => setPlan('classic')} />
        )}

        {data && data.sales_mode !== 'tariffs' && classicSorted && planSlug === 'classic' && (
          <ClassicPeriodStep
            sorted={classicSorted}
            sub={sub}
            onBack={clearPlan}
            onSelect={handleCheckout}
          />
        )}
      </div>
    </AppLayout>
  )
}

// ── Tariffs mode: шаг 1 — только карточки планов ────────────────────────────

function TariffsGrid({
  tariffs,
  onChoosePlan,
  sub,
}: {
  tariffs: TariffItem[]
  onChoosePlan: (slug: string) => void
  sub?: SubscriptionResponse
}) {
  const bySlug = new Map<string, TariffItem[]>()
  for (const item of tariffs) {
    const list = bySlug.get(item.slug) ?? []
    list.push(item)
    bySlug.set(item.slug, list)
  }
  const cardPeriods = Array.from(bySlug.values()).map((list) => {
    list.sort((a, b) => a.months - b.months)
    return list
  })

  return (
    <div className={cn(
      'grid gap-4',
      cardPeriods.length === 1 ? 'max-w-xs' : cardPeriods.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    )}>
      {cardPeriods.map((periods) => (
        <TariffPlanCard key={periods[0].slug} periods={periods} onChoosePlan={onChoosePlan} sub={sub} />
      ))}
    </div>
  )
}

function TariffPlanCard({
  periods,
  onChoosePlan,
  sub,
}: {
  periods: TariffItem[]
  onChoosePlan: (slug: string) => void
  sub?: SubscriptionResponse
}) {
  const { t } = useTranslation()
  const head = periods[0]
  const active = isSubscriptionActive(sub?.expire_at)
  const isCurrent = Boolean(active && sub?.tariff?.slug === head.slug)
  const ctaLabel = !active ? t('tariffs.select') : isCurrent ? t('tariffs.ctaRenew') : t('tariffs.ctaChange')

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-shadow hover:shadow-xl',
        head.is_popular && 'border-primary/50 shadow-primary/10 shadow-lg',
      )}
    >
      {head.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1 shadow-md">
            <Zap size={10} />
            {t('tariffs.popular')}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2 pt-5">
        <CardTitle className="text-lg">{head.name}</CardTitle>
        {isCurrent && (
          <Badge variant="secondary" className="w-fit mt-2 text-xs font-normal">
            {t('tariffs.currentBadge')}
          </Badge>
        )}
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-3xl font-bold">{head.monthly_base_rub.toLocaleString('ru-RU')}</span>
          <span className="text-sm text-muted-foreground">₽{t('tariffs.perMonth')}</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-4 mt-auto">
        <ul className="space-y-1.5 text-sm flex-1">
          <FeatureLine>
            {head.traffic_gb
              ? t('tariffs.traffic', { n: head.traffic_gb })
              : t('tariffs.trafficUnlimited')}
          </FeatureLine>
          <FeatureLine>
            {head.device_limit > 0
              ? t('tariffs.devices', { n: head.device_limit })
              : t('tariffs.devicesUnlimited')}
          </FeatureLine>
        </ul>
        {head.description ? (
          <TariffDescription text={head.description} className="text-xs text-muted-foreground leading-relaxed" />
        ) : null}

        <Button
          className="w-full"
          variant={head.is_popular ? 'default' : 'outline'}
          type="button"
          onClick={() => onChoosePlan(head.slug)}
        >
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Шаг 2 — выбор срока (режим tariffs) ────────────────────────────────────

function TariffPeriodStep({
  slug,
  tariffs,
  onBack,
  onSelect,
}: {
  slug: string
  tariffs: TariffItem[]
  onBack: () => void
  onSelect: (t: TariffItem) => void
}) {
  const { t } = useTranslation()
  const periods = [...tariffs].filter((x) => x.slug === slug).sort((a, b) => a.months - b.months)
  const head = periods[0]

  useEffect(() => {
    if (periods.length === 0) onBack()
  }, [periods.length, onBack])

  if (!head) return null

  return (
    <div className="space-y-4 max-w-lg mx-auto w-full">
      <Button type="button" variant="ghost" size="sm" className="gap-1 -ml-2" onClick={onBack}>
        <ArrowLeft className="size-4" />
        {t('tariffs.backToPlans')}
      </Button>
      <div>
        <h2 className="text-xl font-semibold">{head.name}</h2>
        {head.description ? (
          <TariffDescription text={head.description} className="text-sm text-muted-foreground mt-1 leading-relaxed" />
        ) : null}
        <p className="text-sm text-muted-foreground mt-3">{t('tariffs.choosePeriodHint')}</p>
      </div>
      <div
        className={cn(
          'grid gap-2',
          periods.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2',
        )}
      >
        {periods.map((p) => (
          <Button
            key={p.months}
            type="button"
            variant="outline"
            className="h-auto min-h-11 flex-col gap-0.5 py-2.5"
            onClick={() => onSelect(p)}
          >
            <span className="font-medium tabular-nums">
              {p.months} {t('tariffs.moAbbr')}
            </span>
            <span className="text-xs font-normal opacity-90 tabular-nums">
              {p.price_rub.toLocaleString('ru-RU')} ₽
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}

// ── Classic: шаг 1 — вводная, шаг 2 — сроки ───────────────────────────────

function ClassicIntro({
  sorted,
  onContinue,
}: {
  sorted: TariffItem[]
  onContinue: () => void
}) {
  const { t } = useTranslation()
  const head = sorted[0]
  if (!head) return null

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Check size={14} className="text-primary" />
          {head.traffic_gb
            ? t('tariffs.traffic', { n: head.traffic_gb })
            : t('tariffs.trafficUnlimited')}
        </span>
        <span className="flex items-center gap-1.5">
          <Check size={14} className="text-primary" />
          {head.device_limit > 0
            ? t('tariffs.devices', { n: head.device_limit })
            : t('tariffs.devicesUnlimited')}
        </span>
      </div>
      <Card>
        <CardContent className="px-5 py-6 space-y-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{head.monthly_base_rub.toLocaleString('ru-RU')}</span>
            <span className="text-sm text-muted-foreground">₽{t('tariffs.perMonth')}</span>
          </div>
          {head.description ? (
            <TariffDescription text={head.description} className="text-sm text-muted-foreground leading-relaxed" />
          ) : null}
          <Button type="button" className="w-full" onClick={onContinue}>
            {t('tariffs.classicChoosePeriod')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ClassicPeriodStep({
  sorted,
  sub,
  onBack,
  onSelect,
}: {
  sorted: TariffItem[]
  sub?: SubscriptionResponse
  onBack: () => void
  onSelect: (t: TariffItem) => void
}) {
  const { t } = useTranslation()
  const baseMonthlyRub = sorted[0]?.monthly_base_rub ?? sorted[0]?.price_rub ?? 0

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" className="gap-1 -ml-2" onClick={onBack}>
        <ArrowLeft className="size-4" />
        {t('tariffs.backToPlans')}
      </Button>
      <p className="text-sm text-muted-foreground">{t('tariffs.choosePeriodHint')}</p>
      <div className={cn(
        'grid gap-3',
        sorted.length <= 2
          ? 'grid-cols-1 sm:grid-cols-2 max-w-xl'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      )}>
        {sorted.map((tariff) => (
          <PeriodCard
            key={tariff.slug + tariff.months}
            tariff={tariff}
            baseMonthlyRub={baseMonthlyRub}
            onSelect={onSelect}
            sub={sub}
          />
        ))}
      </div>
    </div>
  )
}

function PeriodCard({
  tariff,
  baseMonthlyRub,
  onSelect,
  sub,
}: {
  tariff: TariffItem
  baseMonthlyRub: number
  onSelect: (t: TariffItem) => void
  sub?: SubscriptionResponse
}) {
  const { t } = useTranslation()
  const active = isSubscriptionActive(sub?.expire_at)
  const monthsMatch =
    sub?.subscription_period_months == null || sub.subscription_period_months === tariff.months
  const isCurrent = Boolean(active && sub?.tariff?.slug === tariff.slug && monthsMatch)
  const ctaLabel = !active ? t('tariffs.select') : isCurrent ? t('tariffs.ctaRenew') : t('tariffs.ctaChange')

  const savingPct =
    tariff.monthly_base_rub < baseMonthlyRub
      ? Math.round((1 - tariff.monthly_base_rub / baseMonthlyRub) * 100)
      : 0

  const monthLabel = pluralizeMonths(tariff.months)

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-shadow hover:shadow-xl',
        tariff.is_popular && 'border-primary/50 shadow-primary/10 shadow-lg',
      )}
    >
      {tariff.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1 shadow-md">
            <Zap size={10} />
            {t('tariffs.popular')}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2 pt-5">
        <CardTitle className="text-base">{monthLabel}</CardTitle>
        {isCurrent && (
          <Badge variant="secondary" className="w-fit text-xs mt-1 font-normal">
            {t('tariffs.currentBadge')}
          </Badge>
        )}
        {savingPct > 0 && (
          <Badge variant="success" className="w-fit text-xs mt-1">
            {t('tariffs.saving', { pct: savingPct })}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-3">
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{tariff.price_rub.toLocaleString('ru-RU')}</span>
            <span className="text-sm text-muted-foreground">₽</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tariff.monthly_base_rub.toLocaleString('ru-RU')} ₽{t('tariffs.perMonth')}
          </p>
        </div>

        <Button
          className="w-full"
          variant={tariff.is_popular ? 'default' : 'outline'}
          size="sm"
          type="button"
          onClick={() => onSelect(tariff)}
        >
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-muted-foreground">
      <Check size={14} className="text-primary shrink-0" />
      {children}
    </li>
  )
}

function decodeHtmlEntities(input: string): string {
  if (typeof document === 'undefined') return input
  const el = document.createElement('textarea')
  el.innerHTML = input
  return el.value
}

function TariffDescription({ text, className }: { text: string; className?: string }) {
  const decoded = decodeHtmlEntities(String(text))
  return (
    <div className={cn(
      '[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-1 [&_p]:whitespace-pre-line [&_li]:whitespace-pre-line',
      className,
    )}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
        {decoded}
      </ReactMarkdown>
    </div>
  )
}

function pluralizeMonths(n: number): string {
  if (n === 1) return '1 месяц'
  if (n >= 2 && n <= 4) return `${n} месяца`
  return `${n} месяцев`
}

function isSubscriptionActive(expireAt: string | null | undefined): boolean {
  if (expireAt == null || expireAt === '') return false
  const t = Date.parse(expireAt)
  if (Number.isNaN(t)) return false
  return t > Date.now()
}

function TariffsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-5 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded w-2/3 mt-2" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-3 bg-muted rounded" />
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-9 bg-muted rounded mt-4" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
