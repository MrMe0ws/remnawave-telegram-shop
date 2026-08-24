import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Shield, X } from 'lucide-react'

import { LangToggle } from '@/components/LangToggle'
import { LANDING_NAV_SECTIONS } from '../landingContent'
import type { LandingBrand } from '../useLandingBrand'
import { Rise } from './LandingMotion'

/**
 * Шапка лендинга: прозрачная над hero, «застекляется» после прокрутки.
 * На мобильных навигация уезжает в раскрывающуюся панель.
 */
export function LandingHeader({ brand }: { brand: LandingBrand }) {
  const { t } = useTranslation()
  const [stuck, setStuck] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Открытое меню не должно оставаться висеть при переходе на десктопную ширину.
  useEffect(() => {
    if (!menuOpen) return
    const mq = window.matchMedia('(min-width: 768px)')
    const close = () => setMenuOpen(false)
    mq.addEventListener('change', close)
    return () => mq.removeEventListener('change', close)
  }, [menuOpen])

  const cabinetLabel = brand.authenticated
    ? t('landing.nav.cabinet')
    : t('landing.nav.login')

  return (
    <header className="landing-header" data-stuck={stuck}>
      <Rise duration={0.5}>
        <div className="mx-auto flex h-[var(--lp-header-h)] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/landing"
            className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[hsl(var(--lp-cyan))]"
          >
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt=""
                className="size-9 rounded-full object-contain"
                loading="eager"
              />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-xl bg-[hsl(var(--lp-cyan)/0.12)] text-[hsl(var(--lp-cyan))]">
                <Shield className="size-5" strokeWidth={1.9} />
              </span>
            )}
            <span className="font-heading text-lg font-bold tracking-tight">{brand.name}</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            {LANDING_NAV_SECTIONS.map((section) => (
              <a key={section} href={`#${section}`} className="landing-nav-link">
                {t(`landing.nav.${section}`)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LangToggle className="rounded-full" />
            <a
              href={brand.cabinetHref}
              className="landing-cta landing-cta--ghost hidden h-10 items-center rounded-full px-5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--lp-cyan))] sm:inline-flex"
            >
              {cabinetLabel}
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={t('landing.nav.menu')}
              className="inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-card/50 text-foreground transition-colors hover:border-[hsl(var(--lp-cyan)/0.5)] md:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </Rise>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            key="landing-mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden"
          >
            <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
              {LANDING_NAV_SECTIONS.map((section, i) => (
                <motion.a
                  key={section}
                  href={`#${section}`}
                  onClick={() => setMenuOpen(false)}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 + i * 0.05, duration: 0.3 }}
                  className="rounded-xl px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  {t(`landing.nav.${section}`)}
                </motion.a>
              ))}

              <div className="mt-2">
                <a
                  href={brand.cabinetHref}
                  className="landing-cta landing-cta--primary inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold"
                >
                  {cabinetLabel}
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
