import { useTranslation } from 'react-i18next'

import type { LandingBrand } from '../useLandingBrand'
import { Reveal } from './LandingMotion'
import { LandingCabinetCta } from './LandingPrimitives'
import { useLandingSettings } from '../useLandingSettings'

/** Финальный призыв к действию перед футером. */
export function LandingCtaBand({ brand }: { brand: LandingBrand }) {
  const { t } = useTranslation()
  const { text } = useLandingSettings()
  // В своём тексте {{brand}} подставляем сами: i18next его уже не увидит.
  const subtitle =
    text('cta_subtitle', '').split('{{brand}}').join(brand.name) ||
    t('landing.cta.subtitle', { brand: brand.name })

  return (
    <section className="px-4 pb-16 pt-2 sm:px-6 sm:pb-28">
      <Reveal y={32}>
        <div className="landing-cta-band mx-auto max-w-4xl px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="relative">
            <h2 className="text-balance font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              {text('cta_title', t('landing.cta.title'))}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground">
              {subtitle}
            </p>

            <LandingCabinetCta
              className="mt-9 justify-center"
              size="lg"
              href={brand.cabinetHref}
              label={brand.authenticated ? t('landing.nav.cabinet') : t('landing.cta.ctaCabinet')}
            />
          </div>
        </div>
      </Reveal>
    </section>
  )
}
