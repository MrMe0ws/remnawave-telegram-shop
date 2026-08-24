import { useTranslation } from 'react-i18next'

import { accentVar, LANDING_STEPS } from '../landingContent'
import type { LandingBrand } from '../useLandingBrand'
import { Reveal, useCardSpotlight } from './LandingMotion'
import { LandingCabinetCta, SectionHeading } from './LandingPrimitives'

/**
 * «Как подключиться»: три шага в ряд, соединённые пунктирной линией на десктопе.
 * Иконка и номер стоят на одной строке (иконка слева, номер справа) — вертикальный
 * стек из двух кружков выглядел рыхло, особенно на мобильных.
 */
export function LandingSteps({ brand }: { brand: LandingBrand }) {
  const { t } = useTranslation()
  const onMouseMove = useCardSpotlight()

  return (
    <section id="how" className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow={t('landing.steps.eyebrow')}
          title={t('landing.steps.title')}
          description={t('landing.steps.subtitle')}
        />

        <div className="relative mt-10 sm:mt-14">
          {/* Линия идёт на уровне иконок; на узких экранах карточки в столбец — прячем. */}
          <div className="landing-steps-rail hidden lg:block" aria-hidden />

          <div className="relative grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
            {LANDING_STEPS.map((step, i) => (
              <Reveal key={step.id} delay={0.1 * i}>
                <article
                  className="landing-card h-full p-5 sm:p-6"
                  style={{ ['--lp-accent' as string]: accentVar(step.accent) }}
                  onMouseMove={onMouseMove}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="landing-icon-tile size-12">
                      <step.icon className="size-[1.4rem]" strokeWidth={1.9} />
                    </span>
                    <span className="landing-step-num">{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-bold tracking-tight">
                    {t(`landing.steps.items.${step.id}.title`)}
                  </h3>
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {t(`landing.steps.items.${step.id}.text`)}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={0.2}>
          <LandingCabinetCta
            className="mt-10 justify-center sm:mt-12"
            href={brand.cabinetHref}
            label={brand.authenticated ? t('landing.nav.cabinet') : t('landing.steps.ctaCabinet')}
          />
        </Reveal>
      </div>
    </section>
  )
}
