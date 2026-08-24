import { useLayoutEffect, useState } from 'react'

import './landing.css'
import { resolveLandingLayout } from './landingLayout'
import { useLandingBrand } from './useLandingBrand'
import { LandingHeader } from './components/LandingHeader'
import { LandingHero } from './components/LandingHero'
import { LandingFeatures } from './components/LandingFeatures'
import { LandingSteps } from './components/LandingSteps'
import { LandingTariffs } from './components/LandingTariffs'
import { LandingFaq } from './components/LandingFaq'
import { LandingCtaBand } from './components/LandingCtaBand'
import { LandingFooter } from './components/LandingFooter'
import { LandingLayoutSwitcher } from './components/LandingLayoutSwitcher'

/**
 * Публичный лендинг: /landing (и /cabinet/landing).
 *
 * Отдельный маршрут, а не корень SPA: `/` по-прежнему ведёт в личный кабинет,
 * и авторизованного пользователя отсюда никуда не перекидывает — если он зашёл
 * на лендинг осознанно, он на нём и остаётся.
 *
 * Порядок секций: hero → как подключиться → возможности → вопросы → CTA.
 * Витрина тарифов встаёт в одно из трёх мест — см. landingLayout.ts.
 *
 * Страница всегда тёмная: тема кабинета на время показа принудительно
 * переключается в dark и восстанавливается при уходе (значение в localStorage
 * не трогаем — это выбор пользователя, а не состояние лендинга).
 */
export default function LandingPage() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    const hadLight = root.classList.contains('light')

    root.classList.add('dark')
    root.classList.remove('light')
    // Плавная прокрутка к якорям — только на лендинге, чтобы не менять
    // поведение остальных экранов кабинета.
    root.dataset.landing = '1'

    return () => {
      if (!hadDark) root.classList.remove('dark')
      if (hadLight) root.classList.add('light')
      delete root.dataset.landing
    }
  }, [])

  const brand = useLandingBrand()
  // Раскладка фиксируется на монтировании: смена варианта идёт через перезагрузку.
  const [layout] = useState(resolveLandingLayout)

  return (
    <div className="dark landing-root">
      <div className="landing-backdrop" aria-hidden>
        <div className="landing-backdrop__grid" />
        <div className="landing-orb landing-orb--cyan" />
        <div className="landing-orb landing-orb--violet" />
        <div className="landing-orb landing-orb--emerald" />
      </div>

      <div className="relative z-10">
        <LandingHeader brand={brand} />
        <main>
          <LandingHero
            brand={brand}
            aside={
              layout === 'hero-side' ? (
                <LandingTariffs brand={brand} variant="panel" />
              ) : undefined
            }
            /* Тарифы идут сразу следом — декоративная карточка подписки только мешала бы. */
            showPanel={layout !== 'after-hero'}
          />

          {layout === 'after-hero' && <LandingTariffs brand={brand} />}

          <LandingSteps brand={brand} />

          {layout === 'after-steps' && <LandingTariffs brand={brand} />}

          <LandingFeatures />
          <LandingFaq />
          <LandingCtaBand brand={brand} />
        </main>
        <LandingFooter brand={brand} />
      </div>

      {import.meta.env.DEV && <LandingLayoutSwitcher current={layout} />}
    </div>
  )
}
