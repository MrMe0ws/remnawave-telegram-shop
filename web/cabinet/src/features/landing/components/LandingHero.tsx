import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'
import { Activity, Gauge, Shield, ShieldCheck } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { LandingBrand } from '../useLandingBrand'
import { Rise, WordsReveal } from './LandingMotion'
import { LandingPlatformRow } from './LandingPlatforms'
import { LandingCabinetCta } from './LandingPrimitives'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Первый экран.
 *
 * Заголовок собирается из трёх i18n-кусков (`titleBefore` / бренд из env / `titleAfter`),
 * чтобы в русской и английской версии бренд стоял в разных местах фразы.
 * Слова проявляются по очереди, остальное — лесенкой следом.
 *
 * `aside` — раскладка «тарифы справа от hero»: текст уезжает влево и в колонку
 * справа встаёт витрина. Без него hero центрируется, а под ним показывается
 * декоративная карточка подписки — её можно погасить через showPanel, если
 * следом идёт секция тарифов и две «витрины» подряд были бы лишними.
 */
export function LandingHero({
  brand,
  aside,
  showPanel = true,
}: {
  brand: LandingBrand
  aside?: ReactNode
  showPanel?: boolean
}) {
  const { t } = useTranslation()
  const split = Boolean(aside)

  const titleSegments = [
    ...t('landing.hero.titleBefore').split(' ').filter(Boolean),
    <span key="brand" className="landing-title-gradient">
      {brand.name}
    </span>,
    ...t('landing.hero.titleAfter').split(' ').filter(Boolean),
  ]

  const copy = (
    <div className={cn('mx-auto max-w-3xl', split ? 'text-center lg:mx-0 lg:text-left' : 'text-center')}>
      {split && <HeroBrandMark brand={brand} />}

      <h1
        className={cn(
          'text-balance font-heading font-extrabold leading-[1.12] tracking-tight',
          split
            ? 'mt-7 text-[2rem] sm:text-5xl lg:text-[3.25rem]'
            : 'text-[2rem] sm:text-5xl lg:text-6xl',
        )}
      >
        <WordsReveal segments={titleSegments} delay={0.12} stagger={0.06} />
      </h1>

      <Rise delay={0.5} y={28}>
        <div className={cn('mt-5 max-w-xl sm:mt-6', split ? 'mx-auto lg:mx-0' : 'mx-auto')}>
          <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('landing.hero.subtitle')}
          </p>
          {/* Логотипы платформ вместо перечисления словами — читается с одного взгляда. */}
          <LandingPlatformRow
            className={cn('mt-4', split ? 'justify-center lg:justify-start' : 'justify-center')}
            label={t('landing.hero.subtitle')}
          />
        </div>
      </Rise>

      {/*
        На десктопе CTA скрыт: там его роль берут «Войти» в шапке и «Оформить»
        в витрине тарифов справа. На мобильных шапка свёрнута в бургер — кнопка
        остаётся единственной видимой точкой входа.
      */}
      <Rise delay={0.64} y={28}>
        <LandingCabinetCta
          className={cn('mt-7 sm:mt-9', split ? 'justify-center lg:justify-start' : 'justify-center')}
          size="lg"
          href={brand.cabinetHref}
          label={brand.authenticated ? t('landing.nav.cabinet') : t('landing.hero.ctaCabinet')}
          desktopHidden
        />
      </Rise>
    </div>
  )

  if (!split) {
    return (
      <section
        className={
          showPanel
            ? 'relative px-4 pb-6 pt-10 sm:px-6 sm:pb-8 sm:pt-20 lg:pt-24'
            : 'relative px-4 pb-2 pt-10 sm:px-6 sm:pb-4 sm:pt-20 lg:pt-24'
        }
      >
        {copy}
        {showPanel && <HeroPanel />}
      </section>
    )
  }

  return (
    <section className="relative px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16 lg:pt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-12">
        {copy}
        <Rise delay={0.35} y={36} duration={0.75}>
          {aside}
        </Rise>
      </div>
    </section>
  )
}

/**
 * Крупный знак бренда над заголовком — заполняет левую колонку в раскладке со ширмой.
 *
 * Внутри — логотип из env (CABINET_BRAND_LOGO_URL / CABINET_BRAND_LOGO_FILE),
 * тот же, что в шапке кабинета. Если он не задан, рисуется щит-заглушка.
 * Пульсация и расходящиеся кольца живут в CSS (.landing-brandmark в landing.css),
 * здесь только появление при загрузке.
 */
function HeroBrandMark({ brand }: { brand: LandingBrand }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className="flex justify-center lg:justify-start"
      initial={reduce ? false : { opacity: 0, scale: 0.86 }}
      animate={reduce ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <span className="landing-brandmark size-40 sm:size-44 lg:size-52">
        <span className="landing-brandmark__halo" aria-hidden />
        <span className="landing-brandmark__disc landing-brandmark__disc--outer" aria-hidden />
        <span className="landing-brandmark__disc landing-brandmark__disc--inner" aria-hidden />
        <span className="landing-brandmark__ring" aria-hidden />
        <span className="landing-brandmark__ring" aria-hidden />
        <span className="landing-brandmark__ring" aria-hidden />

        {brand.logoUrl ? (
          <span className="landing-brandmark__core">
            <img src={brand.logoUrl} alt="" loading="eager" />
          </span>
        ) : (
          <span className="landing-brandmark__core landing-brandmark__core--fallback">
            <Shield className="size-[55%]" strokeWidth={2.1} />
          </span>
        )}
      </span>
    </motion.div>
  )
}

/**
 * Стеклянная «витрина» под hero: имитирует карточку подписки из кабинета —
 * сразу показывает, как выглядит продукт, и связывает лендинг с самим ЛК.
 * Данные декоративные и намеренно захардкожены: это иллюстрация, не виджет.
 */
function HeroPanel() {
  const { t } = useTranslation()
  const reduce = useReducedMotion()

  const stats = [
    { id: 'speed', icon: Gauge, accent: 'cyan' as const },
    { id: 'uptime', icon: Activity, accent: 'emerald' as const },
    { id: 'protocol', icon: ShieldCheck, accent: 'violet' as const },
  ]

  return (
    <motion.div
      className="mx-auto mt-10 w-full max-w-4xl sm:mt-16"
      initial={reduce ? false : { opacity: 0, y: 48, scale: 0.97 }}
      animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.85, duration: 0.85, ease: EASE }}
    >
      <div className="landing-card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2.5">
              {!reduce && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[hsl(var(--lp-emerald))] opacity-60" />
              )}
              <span className="relative inline-flex size-2.5 rounded-full bg-[hsl(var(--lp-emerald))]" />
            </span>
            <span className="text-sm font-semibold">{t('landing.panel.status')}</span>
          </div>
          <span className="rounded-full border border-[hsl(var(--lp-emerald)/0.35)] bg-[hsl(var(--lp-emerald)/0.12)] px-3 py-1 text-xs font-semibold text-[hsl(var(--lp-emerald))]">
            {t('landing.panel.badge')}
          </span>
        </div>

        <div className="mt-5 sm:mt-6">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{t('landing.panel.trafficLabel')}</span>
            <span className="landing-price font-semibold">
              {t('landing.panel.trafficValue')}
            </span>
          </div>
          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-secondary/80">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--lp-cyan))] to-[hsl(var(--lp-violet))]"
              initial={reduce ? false : { width: 0 }}
              animate={reduce ? undefined : { width: '64%' }}
              style={reduce ? { width: '64%' } : undefined}
              transition={{ delay: 1.25, duration: 1.1, ease: EASE }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.id}
              className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-background/40 p-4 sm:block"
              style={{ ['--lp-accent' as string]: `var(--lp-${stat.accent})` }}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 1.15 + i * 0.1, duration: 0.5, ease: EASE }}
            >
              <stat.icon
                className="size-5 shrink-0 text-[hsl(var(--lp-accent))]"
                strokeWidth={1.9}
              />
              <div className="min-w-0">
                <p className="landing-price font-heading text-lg font-bold sm:mt-3 sm:text-xl">
                  {t(`landing.panel.stats.${stat.id}.value`)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(`landing.panel.stats.${stat.id}.label`)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
