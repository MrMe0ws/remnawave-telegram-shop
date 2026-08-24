import { useTranslation } from 'react-i18next'

import type { LandingBrand } from '../useLandingBrand'
import { Reveal } from './LandingMotion'
import { LandingActions } from './LandingPrimitives'

/** Финальный призыв к действию перед футером. */
export function LandingCtaBand({ brand }: { brand: LandingBrand }) {
  const { t } = useTranslation()

  return (
    <section className="px-4 pb-16 pt-2 sm:px-6 sm:pb-28">
      <Reveal y={32}>
        <div className="landing-cta-band mx-auto max-w-4xl px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="relative">
            <h2 className="text-balance font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t('landing.cta.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground">
              {t('landing.cta.subtitle', { brand: brand.name })}
            </p>

            <LandingActions
              className="mt-9 justify-center"
              size="lg"
              botUrl={brand.botUrl}
              cabinetHref={brand.cabinetHref}
              botLabel={t('landing.cta.ctaBot')}
              cabinetLabel={
                brand.authenticated ? t('landing.nav.cabinet') : t('landing.cta.ctaCabinet')
              }
            />
          </div>
        </div>
      </Reveal>
    </section>
  )
}
