import { useTranslation } from 'react-i18next'

import { accentVar, LANDING_FEATURES } from '../landingContent'
import { Reveal, useCardSpotlight } from './LandingMotion'
import { LandingPlatformRow } from './LandingPlatforms'
import { SectionHeading } from './LandingPrimitives'

/** Сетка преимуществ: 6 карточек с акцентными иконками и подсветкой под курсором. */
export function LandingFeatures() {
  const { t } = useTranslation()
  const onMouseMove = useCardSpotlight()

  return (
    <section id="features" className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow={t('landing.features.eyebrow')}
          title={t('landing.features.title')}
          description={t('landing.features.subtitle')}
        />

        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-14 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature, i) => (
            <Reveal key={feature.id} delay={0.05 * i}>
              <article
                className="landing-card h-full p-5 sm:p-6"
                style={{ ['--lp-accent' as string]: accentVar(feature.accent) }}
                onMouseMove={onMouseMove}
              >
                <span className="landing-icon-tile size-12">
                  <feature.icon className="size-6" strokeWidth={1.9} />
                </span>
                <h3 className="mt-5 font-heading text-lg font-bold tracking-tight">
                  {t(`landing.features.items.${feature.id}.title`)}
                </h3>
                {feature.showPlatforms ? (
                  /* Текст остаётся в aria-label: скринридеру логотипы бесполезны. */
                  <LandingPlatformRow
                    className="mt-4 gap-3.5 sm:gap-4"
                    label={t(`landing.features.items.${feature.id}.text`)}
                  />
                ) : (
                  <p className="mt-2.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {t(`landing.features.items.${feature.id}.text`)}
                  </p>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
