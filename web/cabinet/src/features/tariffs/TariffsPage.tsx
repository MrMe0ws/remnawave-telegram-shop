import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Cloud, Smartphone, Zap, type LucideIcon } from 'lucide-react'
import { AppLayout } from '@/components/AppLayout'
import { TariffDescription } from '@/components/TariffDescription'
import { PageTitleWithBack } from '@/components/PageTitleWithBack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, type SubscriptionResponse, type TariffItem } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  formatRubInteger,
  formatShowcasePriceRub,
  showAnnualPriceFootnote,
  showcaseMonthlyRub,
  type TariffPriceDisplayMode,
} from '@/features/tariffs/tariffShowcasePrice'

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
        <div className={cn(planSlug && 'mx-auto w-full max-w-lg')}>
          <PageTitleWithBack
            title={t('tariffs.title')}
            subtitle={t('tariffs.subtitle')}
          />
        </div>

        {isLoading && <TariffsSkeleton />}

        {error && (
          <p className="text-sm text-destructive">{t('errors.unknown')}</p>
        )}

        {data && data.sales_mode === 'tariffs' && !planSlug && (
          <TariffsGrid
            tariffs={data.tariffs}
            priceDisplay={data.price_display ?? 'monthly'}
            onChoosePlan={setPlan}
            sub={sub}
          />
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

function buildCardPeriodsBySlug(tariffs: TariffItem[]): TariffItem[][] {
  const bySlug = new Map<string, TariffItem[]>()
  for (const item of tariffs) {
    const list = bySlug.get(item.slug) ?? []
    list.push(item)
    bySlug.set(item.slug, list)
  }
  return Array.from(bySlug.values()).map((list) => {
    list.sort((a, b) => a.months - b.months)
    return list
  })
}

/** Порядок «текущий тариф первым» — только для мобильной карусели (≤500px); сетка на ПК использует исходный порядок API. */
function orderCardPeriodsCurrentFirst(periods: TariffItem[][], sub?: SubscriptionResponse): TariffItem[][] {
  if (periods.length <= 1) return periods
  const active = isSubscriptionActive(sub?.expire_at)
  const slug = sub?.tariff?.slug
  if (!active || !slug) return periods
  const idx = periods.findIndex((p) => p[0]?.slug === slug)
  if (idx <= 0) return periods
  const next = [...periods]
  const [item] = next.splice(idx, 1)
  return [item, ...next]
}

function TariffsGrid({
  tariffs,
  priceDisplay,
  onChoosePlan,
  sub,
}: {
  tariffs: TariffItem[]
  priceDisplay: TariffPriceDisplayMode
  onChoosePlan: (slug: string) => void
  sub?: SubscriptionResponse
}) {
  const { t } = useTranslation()
  const cardPeriods = useMemo(() => buildCardPeriodsBySlug(tariffs), [tariffs])
  const showFootnote = showAnnualPriceFootnote(priceDisplay, cardPeriods)

  const carouselPeriods = useMemo(
    () => orderCardPeriodsCurrentFirst([...cardPeriods], sub),
    [cardPeriods, sub],
  )

  const singleGridClass = cn('grid max-w-xs gap-4 mx-auto')
  const desktopMaxWidth = cardPeriods.length === 2 ? 'max-w-2xl' : 'max-w-4xl'
  const desktopGridClass = cn(
    'gap-4',
    cardPeriods.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2',
  )

  if (cardPeriods.length === 1) {
    return (
      <div className="space-y-3">
        <div className={singleGridClass}>
          {cardPeriods.map((periods) => (
            <TariffPlanCard
              key={periods[0].slug}
              periods={periods}
              priceDisplay={priceDisplay}
              onChoosePlan={onChoosePlan}
              sub={sub}
            />
          ))}
        </div>
        {showFootnote && (
          <p className="text-center text-xs text-muted-foreground">{t('tariffs.annualPriceFootnote')}</p>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="max-[500px]:block min-[501px]:hidden">
        <TariffsMobileCarousel
          cardPeriods={carouselPeriods}
          priceDisplay={priceDisplay}
          onChoosePlan={onChoosePlan}
          sub={sub}
        />
        {showFootnote && (
          <p className="mt-3 text-center text-xs text-muted-foreground">{t('tariffs.annualPriceFootnote')}</p>
        )}
      </div>
      <div className={cn('hidden min-[501px]:block mx-auto w-full', desktopMaxWidth)}>
        <div className={cn('grid', desktopGridClass)}>
          {cardPeriods.map((periods) => (
            <TariffPlanCard
              key={periods[0].slug}
              periods={periods}
              priceDisplay={priceDisplay}
              onChoosePlan={onChoosePlan}
              sub={sub}
            />
          ))}
          {showFootnote && (
            <p className="col-span-full text-center text-xs text-muted-foreground pt-1">
              {t('tariffs.annualPriceFootnote')}
            </p>
          )}
        </div>
      </div>
    </>
  )
}

type TariffCarouselGesture = {
  anchor: number
  startX: number
  minScrollLeft: number
  maxScrollLeft: number
  intendedIndex: number | null
}

const TARIFF_CAROUSEL_SWIPE_THRESHOLD_PX = 40

function getTariffCarouselActiveIndex(root: HTMLElement): number {
  const slides = root.querySelectorAll<HTMLElement>('[data-tariff-slide]')
  if (!slides.length) return 0
  const rootRect = root.getBoundingClientRect()
  let best = 0
  let bestOverlap = -1
  slides.forEach((el, i) => {
    const r = el.getBoundingClientRect()
    const overlap = Math.min(r.right, rootRect.right) - Math.max(r.left, rootRect.left)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = i
    }
  })
  return best
}

function getTariffCarouselScrollBounds(root: HTMLElement, startIndex: number) {
  const slides = root.querySelectorAll<HTMLElement>('[data-tariff-slide]')
  const startSlide = slides[startIndex]
  if (!startSlide) return null
  return {
    minScrollLeft: startIndex > 0 ? slides[startIndex - 1].offsetLeft : startSlide.offsetLeft,
    maxScrollLeft:
      startIndex < slides.length - 1 ? slides[startIndex + 1].offsetLeft : startSlide.offsetLeft,
  }
}

/** Карусель ≤500px: один тариф за свайп; точки навигации — прямой переход. */
function TariffsMobileCarousel({
  cardPeriods,
  priceDisplay,
  onChoosePlan,
  sub,
}: {
  cardPeriods: TariffItem[][]
  priceDisplay: TariffPriceDisplayMode
  onChoosePlan: (slug: string) => void
  sub?: SubscriptionResponse
}) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const skipOneStepClampRef = useRef(false)
  const gestureRef = useRef<TariffCarouselGesture | null>(null)

  const updateActiveFromScroll = useCallback(() => {
    const root = scrollRef.current
    if (!root) return
    const best = getTariffCarouselActiveIndex(root)
    setActive((prev) => (prev === best ? prev : best))
  }, [])

  const orderKey = cardPeriods.map((p) => p[0].slug).join(',')

  useLayoutEffect(() => {
    const root = scrollRef.current
    if (root) root.scrollLeft = 0
    setActive(0)
    requestAnimationFrame(() => updateActiveFromScroll())
  }, [orderKey, updateActiveFromScroll])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(updateActiveFromScroll)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => updateActiveFromScroll())
    ro.observe(root)
    return () => {
      cancelAnimationFrame(raf)
      root.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [updateActiveFromScroll])

  const scrollToIndex = useCallback(
    (i: number, behavior: ScrollBehavior = 'smooth', fromNav = false) => {
      const root = scrollRef.current
      if (!root) return
      const slide = root.querySelectorAll<HTMLElement>('[data-tariff-slide]')[i]
      if (!slide) return
      if (fromNav) skipOneStepClampRef.current = true
      slide.scrollIntoView({ behavior, inline: 'start', block: 'nearest' })
    },
    [],
  )

  const clampScrollToAdjacentSlide = useCallback(() => {
    if (skipOneStepClampRef.current) {
      skipOneStepClampRef.current = false
      return
    }
    const root = scrollRef.current
    const gesture = gestureRef.current
    if (!root || !gesture || gesture.intendedIndex === null) return

    const current = getTariffCarouselActiveIndex(root)
    if (gesture.intendedIndex !== current) scrollToIndex(gesture.intendedIndex, 'auto')
    gestureRef.current = null
  }, [scrollToIndex])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    let scrollEndFallbackTimer = 0
    const scheduleScrollEndFallback = () => {
      window.clearTimeout(scrollEndFallbackTimer)
      scrollEndFallbackTimer = window.setTimeout(() => clampScrollToAdjacentSlide(), 320)
    }

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      const anchor = getTariffCarouselActiveIndex(root)
      const bounds = getTariffCarouselScrollBounds(root, anchor)
      if (!bounds) return
      skipOneStepClampRef.current = false
      gestureRef.current = {
        anchor,
        startX: touch.clientX,
        minScrollLeft: bounds.minScrollLeft,
        maxScrollLeft: bounds.maxScrollLeft,
        intendedIndex: null,
      }
    }

    const onTouchMove = () => {
      const gesture = gestureRef.current
      if (!gesture) return
      if (root.scrollLeft < gesture.minScrollLeft) root.scrollLeft = gesture.minScrollLeft
      if (root.scrollLeft > gesture.maxScrollLeft) root.scrollLeft = gesture.maxScrollLeft
    }

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0]
      const gesture = gestureRef.current
      if (!touch || !gesture) return

      const n = root.querySelectorAll('[data-tariff-slide]').length
      const dx = gesture.startX - touch.clientX
      let target = gesture.anchor
      if (Math.abs(dx) >= TARIFF_CAROUSEL_SWIPE_THRESHOLD_PX) {
        target = dx > 0 ? gesture.anchor + 1 : gesture.anchor - 1
      }
      target = Math.max(0, Math.min(n - 1, target))
      gestureRef.current = { ...gesture, intendedIndex: target }
      scrollToIndex(target, 'auto')
      scheduleScrollEndFallback()
    }

    const onScrollEnd = () => {
      window.clearTimeout(scrollEndFallbackTimer)
      clampScrollToAdjacentSlide()
    }

    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: true })
    root.addEventListener('touchend', onTouchEnd, { passive: true })
    root.addEventListener('touchcancel', onTouchEnd, { passive: true })
    root.addEventListener('scrollend', onScrollEnd, { passive: true })

    return () => {
      window.clearTimeout(scrollEndFallbackTimer)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchEnd)
      root.removeEventListener('scrollend', onScrollEnd)
    }
  }, [clampScrollToAdjacentSlide, scrollToIndex])

  const scrollToIndexFromNav = (i: number) => {
    gestureRef.current = null
    scrollToIndex(i, 'smooth', true)
  }

  const n = cardPeriods.length

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        className={cn(
          'flex min-w-0 w-full items-stretch gap-2 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x',
          'scroll-pl-3 scroll-pr-3 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none]',
          '[&::-webkit-scrollbar]:hidden',
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {cardPeriods.map((periods) => (
          <div
            key={periods[0].slug}
            data-tariff-slide
            className="flex min-h-0 w-[min(22rem,calc(100%-1.9rem))] shrink-0 snap-always snap-start flex-col self-stretch"
          >
            <TariffPlanCard
              layout="carousel"
              periods={periods}
              priceDisplay={priceDisplay}
              onChoosePlan={onChoosePlan}
              sub={sub}
            />
          </div>
        ))}
      </div>
      <nav
        className="mt-4 flex justify-center gap-2"
        aria-label={t('tariffs.carouselListLabel')}
      >
        {cardPeriods.map((periods, i) => (
          <button
            key={periods[0].slug}
            type="button"
            aria-label={t('tariffs.carouselGoTo', { n: i + 1, total: n })}
            aria-current={i === active ? 'true' : undefined}
            className={cn(
              'h-2 rounded-full transition-[width,background-color] duration-200',
              i === active ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/35 hover:bg-muted-foreground/55',
            )}
            onClick={() => scrollToIndexFromNav(i)}
          />
        ))}
      </nav>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {t('tariffs.carouselTotal', { count: n })}
      </p>
    </div>
  )
}

function TariffPlanCard({
  periods,
  priceDisplay,
  onChoosePlan,
  sub,
  layout = 'grid',
}: {
  periods: TariffItem[]
  priceDisplay: TariffPriceDisplayMode
  onChoosePlan: (slug: string) => void
  sub?: SubscriptionResponse
  layout?: 'grid' | 'carousel'
}) {
  const { t } = useTranslation()
  const head = periods[0]
  const showcaseMonthly = showcaseMonthlyRub(periods, priceDisplay)
  const active = isSubscriptionActive(sub?.expire_at)
  const isCurrent = Boolean(active && sub?.tariff?.slug === head.slug)
  const ctaLabel = !active ? t('tariffs.select') : isCurrent ? t('tariffs.ctaRenew') : t('tariffs.ctaChange')
  const isCarousel = layout === 'carousel'

  return (
    <Card
      role="button"
      tabIndex={0}
      data-tariff-card
      onClick={() => onChoosePlan(head.slug)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onChoosePlan(head.slug)
        }
      }}
      className={cn(
        'relative flex flex-col transition-[border-color,box-shadow,transform,filter] duration-200 cursor-pointer',
        isCarousel && 'min-h-0 w-full flex-1',
        isCurrent
          ? cn(tariffCurrentCardClassName, 'active:scale-[0.98]')
          : cn(
              tariffOtherCardHoverClassName,
              'active:scale-[0.98] hover:brightness-[1.02]',
            ),
        head.is_popular && !isCurrent && 'border-primary/50',
      )}
    >
      {head.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1">
            <Zap size={10} />
            {t('tariffs.popular')}
          </Badge>
        </div>
      )}

      <CardHeader className="px-4 pb-2 pt-5">
        <CardTitle className="text-lg">{head.name}</CardTitle>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-[2.5rem] font-bold leading-none tabular-nums">
            {formatShowcasePriceRub(showcaseMonthly, priceDisplay)}
          </span>
          <span className="text-sm text-muted-foreground">₽{t('tariffs.perMonth')}</span>
        </div>
      </CardHeader>

      {isCurrent && (
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className={cn('w-fit text-xs font-normal', tariffCurrentBadgeClassName)}>
            {t('tariffs.currentBadge')}
          </Badge>
        </div>
      )}

      <CardContent
        className={cn(
          'flex flex-col gap-4 p-4 pt-0',
          isCarousel ? 'min-h-0 flex-1' : 'mt-auto flex-1',
        )}
      >
        {isCarousel ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
              {head.description ? (
                <TariffDescription
                  text={head.description}
                  className="text-[0.875rem] text-muted-foreground leading-relaxed"
                />
              ) : null}
              <ul className="space-y-1.5 text-sm shrink-0">
                <FeatureLine icon={Cloud}>
                  {head.traffic_gb
                    ? t('tariffs.traffic', { n: head.traffic_gb })
                    : t('tariffs.trafficUnlimited')}
                </FeatureLine>
                <FeatureLine icon={Smartphone}>
                  {head.device_limit > 0
                    ? t('tariffs.devices', { n: head.device_limit })
                    : t('tariffs.devicesUnlimited')}
                </FeatureLine>
              </ul>
            </div>
            <Button
              className={cn(
                'mt-auto w-full shrink-0 transition-[background-color,box-shadow,transform,filter] duration-200',
                isCurrent ? tariffRenewButtonClassName : tariffChangeCtaButtonClassName,
              )}
              variant="default"
              type="button"
            >
              {ctaLabel}
            </Button>
          </>
        ) : (
          <>
            {head.description ? (
              <TariffDescription text={head.description} className="text-[0.875rem] text-muted-foreground leading-relaxed" />
            ) : null}

            <ul className="space-y-1.5 text-sm flex-1">
              <FeatureLine icon={Cloud}>
                {head.traffic_gb
                  ? t('tariffs.traffic', { n: head.traffic_gb })
                  : t('tariffs.trafficUnlimited')}
              </FeatureLine>
              <FeatureLine icon={Smartphone}>
                {head.device_limit > 0
                  ? t('tariffs.devices', { n: head.device_limit })
                  : t('tariffs.devicesUnlimited')}
              </FeatureLine>
            </ul>

            <Button
              className={cn(
                'w-full transition-[background-color,box-shadow,transform,filter] duration-200',
                isCurrent ? tariffRenewButtonClassName : tariffChangeCtaButtonClassName,
              )}
              variant="default"
              type="button"
            >
              {ctaLabel}
            </Button>
          </>
        )}
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

  const formatRub2 = (n: number) =>
    n.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  // Период изначально НЕ выбран — подсветка появляется только после клика.
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null)

  const detailText =
    (head.description_detail?.trim() || head.description?.trim()) ?? ''

  return (
    <div className="space-y-4 max-w-lg mx-auto w-full">
      <div>
        <h2 className="text-xl font-semibold">{head.name}</h2>
        {detailText ? (
          <TariffDescription
            text={detailText}
            className="text-sm text-muted-foreground mt-1 leading-relaxed"
          />
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
            className={cn(
              'h-auto min-h-[88px] flex-col items-start justify-start gap-0 px-4 py-3 rounded-[var(--radius)] backdrop-blur-[2px] border transition-[background-color,box-shadow,border-color,filter] duration-200',
              tariffCardShadowClassName,
              p.months === selectedMonths
                ? cn(
                    'border-primary bg-primary/10 dark:bg-primary/15',
                    tariffOtherCardHoverClassName,
                    'hover:brightness-[1.02]',
                  )
                : cn(
                    'border-border bg-card dark:bg-[hsl(var(--card))]',
                    tariffOtherCardHoverClassName,
                    'hover:brightness-[1.02]',
                  ),
            )}
            onClick={() => {
              setSelectedMonths(p.months)
              onSelect(p)
            }}
          >
            {(() => {
              const perMonthRub = p.months > 0 ? p.price_rub / p.months : 0
              return (
                <>
                  <span
                    className="text-lg leading-7 font-medium tabular-nums text-foreground dark:text-[rgb(241,245,249)]"
                  >
                    {pluralizeMonths(p.months)}
                  </span>
                  <span
                    className="text-[0.95rem] leading-5 font-semibold tabular-nums text-primary"
                  >
                    {formatRubInteger(p.price_rub)} ₽
                  </span>
                  <span
                    className="mt-1 text-[0.7rem] leading-4 font-normal tabular-nums text-muted-foreground dark:text-[rgb(101,114,134)] tracking-[-1px]"
                  >
                    {formatRub2(perMonthRub)} ₽{t('tariffs.perMonth')}
                  </span>
                </>
              )
            })()}
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
          <Cloud size={14} className="text-primary shrink-0" />
          {head.traffic_gb
            ? t('tariffs.traffic', { n: head.traffic_gb })
            : t('tariffs.trafficUnlimited')}
        </span>
        <span className="flex items-center gap-1.5">
          <Smartphone size={14} className="text-primary shrink-0" />
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
      data-tariff-card
      className={cn(
        'relative flex flex-col transition-[border-color,box-shadow] duration-200',
        isCurrent
          ? tariffCurrentCardClassName
          : cn(tariffOtherCardHoverClassName, 'hover:brightness-[1.01]'),
        tariff.is_popular && !isCurrent && 'border-primary/50',
      )}
    >
      {tariff.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1">
            <Zap size={10} />
            {t('tariffs.popular')}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2 pt-5">
        <CardTitle className="text-base">{monthLabel}</CardTitle>
        {isCurrent && (
          <Badge
            variant="secondary"
            className={cn('w-fit text-xs mt-1 font-normal', tariffCurrentBadgeClassName)}
          >
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
          className={cn(
            'w-full transition-[background-color,box-shadow,transform,filter] duration-200',
            isCurrent ? tariffRenewButtonClassName : tariffChangeCtaButtonClassName,
          )}
          variant="default"
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

function FeatureLine({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-2 text-muted-foreground">
      <Icon size={14} className="text-primary shrink-0" strokeWidth={2} />
      {children}
    </li>
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

/** Бейдж «Текущий»: бордер и фон от --primary пресета. */
const tariffCurrentBadgeClassName =
  'border border-primary bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary shadow-none'

/**
 * Текущий тариф: inset primary + те же «плавающие» тени, что у Card (иначе в dark побеждает dark:shadow карточки).
 */
const tariffCurrentCardClassName =
  'border-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)),0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] dark:shadow-[inset_0_0_0_1px_hsl(var(--primary)),0_12px_30px_rgba(3,10,24,0.42),inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-0.5 hover:border-primary hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)),0_10px_32px_-8px_hsl(var(--primary)/0.42),0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] dark:hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)),0_14px_40px_-6px_hsl(var(--primary)/0.38),0_12px_30px_rgba(3,10,24,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]'

/** Карточки остальных тарифов — ховер без смены яркости всей карточки. */
const tariffOtherCardHoverClassName =
  'hover:border-primary/35 hover:shadow-[0_10px_28px_-12px_hsl(var(--foreground)/0.12)] dark:hover:shadow-[0_12px_32px_-10px_hsl(var(--primary)/0.22)]'

/** Базовая тень как у `Card` (карточки тарифов на сетке). */
const tariffCardShadowClassName =
  'shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] dark:shadow-[0_12px_30px_rgba(3,10,24,0.42),inset_0_1px_0_rgba(255,255,255,0.03)]'

/** Кнопка «Продлить»: явный primary (тема уже задаёт --primary в :root / .dark). */
const tariffRenewButtonClassName =
  'bg-primary text-primary-foreground shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] hover:brightness-110 hover:shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.55)] active:scale-[0.98]'

/** Кнопки «Сменить тариф» / «Выбрать»: тот же акцент, что и «Продлить» (--primary пресета). */
const tariffChangeCtaButtonClassName =
  'bg-primary text-primary-foreground shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] hover:brightness-110 hover:shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.55)] active:scale-[0.98]'

function TariffsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
