import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'

import { api, type TariffItem, type TariffsResponse } from '@/lib/api'
import { formatDecimals, formatInteger } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LANDING_POPULAR_PLAN_PATTERNS } from '../landingContent'
import { logLandingMockHint, readLandingTariffsMock } from '../landingTariffsMock'
import type { LandingBrand } from '../useLandingBrand'
import { Reveal, useCardSpotlight } from './LandingMotion'
import { SectionHeading } from './LandingPrimitives'

/**
 * Витрина тарифов.
 *
 * GET /cabinet/api/tariffs — публичный эндпоинт (см. registerAPIRoutes), поэтому
 * лендинг показывает реальные цены без авторизации. На карточке только название
 * и цена: описания и характеристики остаются в кабинете.
 *
 * Два режима подачи:
 *   section — самостоятельная секция с шапкой и якорем #tariffs;
 *   panel   — компактная ширма в колонке рядом с hero (раскладка «hero-side»).
 *
 * Блок не рендерится, если API недоступен или продавать нечего. Для локального
 * просмотра без бэкенда есть мок — см. landingTariffsMock.ts.
 */

export type LandingTariffsVariant = 'section' | 'panel'

interface TariffCardData {
  key: string
  /** Название тарифа или подпись периода («12 месяцев»). */
  name: string
  /** Крупная цена на карточке. */
  priceRub: number
  /** Мелкая строка под ценой: цена за месяц. */
  perMonthRub: number
  /** Скидка к базовой месячной цене, %. 0 — плашку не показываем. */
  savingsPct: number
  featured: boolean
}

function formatRubInteger(n: number): string {
  return formatInteger(n)
}

function formatRub2(n: number): string {
  return formatDecimals(n, 2)
}

/**
 * classic-режим: тариф один, карточки — периоды подписки.
 * Выгода считается относительно цены месяца, «популярным» помечаем самый
 * длинный период (обычно годовой) — как на витрине периодов в кабинете.
 */
function buildPeriodCards(
  tariffs: TariffItem[],
  monthLabel: (n: number) => string,
): TariffCardData[] {
  const sorted = [...tariffs].sort((a, b) => a.months - b.months)
  const baseMonthly = sorted.find((p) => p.months === 1)?.price_rub ?? 0
  const longest = sorted[sorted.length - 1]?.months ?? 0

  return sorted.map((item) => {
    const perMonth = item.months > 0 ? item.price_rub / item.months : item.price_rub
    const pct =
      baseMonthly > 0 && perMonth < baseMonthly
        ? Math.round((1 - perMonth / baseMonthly) * 100)
        : 0
    return {
      key: `${item.slug}-${item.months}`,
      name: monthLabel(item.months),
      priceRub: item.price_rub,
      perMonthRub: perMonth,
      savingsPct: pct,
      featured: sorted.length > 1 && item.months === longest,
    }
  })
}

/**
 * tariffs-режим: карточки — тарифы, крупная цена за месяц.
 * Бэкенд флага «популярный» не отдаёт (в Go его нет), поэтому определяем
 * по названию/слагу — список шаблонов лежит в landingContent.ts.
 */
function buildPlanCards(tariffs: TariffItem[]): TariffCardData[] {
  const bySlug = new Map<string, TariffItem[]>()
  for (const item of tariffs) {
    const list = bySlug.get(item.slug) ?? []
    list.push(item)
    bySlug.set(item.slug, list)
  }

  return Array.from(bySlug.entries()).map(([slug, list]) => {
    list.sort((a, b) => a.months - b.months)
    const head = list[0]
    const monthly = head.monthly_base_rub || head.price_rub
    const haystack = `${slug} ${head.name}`.toLowerCase()
    return {
      key: slug,
      name: head.name,
      priceRub: monthly,
      perMonthRub: monthly,
      savingsPct: 0,
      featured: LANDING_POPULAR_PLAN_PATTERNS.some((p) => haystack.includes(p)),
    }
  })
}

/** Данные витрины: мок в dev-сборке, иначе публичная ручка. */
function useLandingTariffs() {
  const { t } = useTranslation()

  // Мок читаем один раз при монтировании: он не меняется без перезагрузки.
  const mock = useMemo(() => readLandingTariffsMock(), [])
  useEffect(() => {
    if (!mock) logLandingMockHint()
  }, [mock])

  const query = useQuery<TariffsResponse>({
    queryKey: ['landing-tariffs'],
    queryFn: () => api.tariffs(),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: !mock,
  })

  const data = mock ?? query.data

  const cards = useMemo<TariffCardData[]>(() => {
    if (!data?.tariffs?.length) return []
    return data.sales_mode === 'tariffs'
      ? buildPlanCards(data.tariffs)
      : buildPeriodCards(data.tariffs, (n) => t('tariffs.month', { count: n }))
  }, [data, t])

  return {
    cards,
    /** true — карточки описывают периоды, значит под ценой нужна цена за месяц. */
    isPeriods: data?.sales_mode !== 'tariffs',
    loading: !mock && query.isLoading,
  }
}

function TariffCard({
  card,
  href,
  isPeriods,
  onMouseMove,
}: {
  card: TariffCardData
  href: string
  isPeriods: boolean
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => void
}) {
  const { t } = useTranslation()

  return (
    <a
      href={href}
      className={cn(
        'landing-tariff-card landing-card block h-full p-4 sm:p-5',
        card.featured && 'landing-card--featured',
      )}
      onMouseMove={onMouseMove}
    >
      {card.featured && (
        <span className="landing-tariff-ribbon" aria-hidden>
          <span>{t('tariffs.popular')}</span>
        </span>
      )}

      <span className="block pr-12 text-[0.95rem] font-medium leading-tight text-foreground sm:pr-[76px] sm:text-base">
        {card.name}
      </span>

      {card.savingsPct > 0 ? (
        <span className="mt-1 block text-xs font-semibold text-[hsl(var(--lp-cyan))] sm:text-[0.8rem]">
          {t('tariffs.saving', { pct: card.savingsPct })}
        </span>
      ) : (
        <span className="mt-1 block text-xs opacity-0" aria-hidden>
          &nbsp;
        </span>
      )}

      <span className="landing-price mt-4 block font-heading text-2xl font-extrabold leading-none sm:text-[1.75rem]">
        {formatRubInteger(card.priceRub)} ₽
      </span>

      <span className="landing-price mt-1.5 block text-[0.7rem] leading-4 text-muted-foreground sm:text-xs">
        {isPeriods
          ? `${formatRub2(card.perMonthRub)} ₽ ${t('landing.tariffs.perMonthFull')}`
          : t('landing.tariffs.perMonthFull')}
      </span>
    </a>
  )
}

export function LandingTariffs({
  brand,
  variant = 'section',
}: {
  brand: LandingBrand
  variant?: LandingTariffsVariant
}) {
  const { t } = useTranslation()
  const onMouseMove = useCardSpotlight()
  const { cards, isPeriods, loading } = useLandingTariffs()

  // Пока грузится — держим место, чтобы hero и якорь #tariffs не «прыгали».
  if (loading) {
    return variant === 'panel' ? (
      <div className="min-h-[22rem]" aria-busy />
    ) : (
      <section id="tariffs" className="min-h-[40vh]" aria-busy />
    )
  }
  if (cards.length === 0) return null

  // На лендинге тариф не выбирают — ведём в кабинет, дальше обычный флоу оплаты.
  const buyHref = brand.tariffsHref

  if (variant === 'panel') {
    return (
      <div id="tariffs" className="w-full">
        <div className="px-1 pb-3">
          <span className="text-sm font-semibold text-muted-foreground">
            {t('landing.tariffs.eyebrow')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <TariffCard
              key={card.key}
              card={card}
              href={buyHref}
              isPeriods={isPeriods}
              onMouseMove={onMouseMove}
            />
          ))}
        </div>

        <a
          href={buyHref}
          className="landing-cta landing-cta--primary group mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold"
        >
          {t('landing.tariffs.cta')}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </a>
      </div>
    )
  }

  const columns =
    cards.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2 sm:max-w-2xl sm:mx-auto'
      : cards.length === 3
        ? 'grid-cols-2 lg:grid-cols-3 lg:max-w-4xl lg:mx-auto'
        : 'grid-cols-2 lg:grid-cols-4'

  return (
    <section id="tariffs" className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow={t('landing.tariffs.eyebrow')}
          title={t('landing.tariffs.title')}
          description={t('landing.tariffs.subtitle')}
        />

        <div className={cn('mt-10 grid gap-3 sm:mt-14 sm:gap-4', columns)}>
          {cards.map((card, i) => (
            <Reveal key={card.key} delay={0.06 * i}>
              <TariffCard
                card={card}
                href={buyHref}
                isPeriods={isPeriods}
                onMouseMove={onMouseMove}
              />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-8 flex justify-center sm:mt-10">
            <a
              href={buyHref}
              className="landing-cta landing-cta--primary group inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold"
            >
              {t('landing.tariffs.cta')}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
