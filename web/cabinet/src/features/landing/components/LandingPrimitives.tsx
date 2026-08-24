import type { ReactNode } from 'react'
import { ArrowRight, LayoutDashboard } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Reveal } from './LandingMotion'

/**
 * Монохромный глиф Telegram: в отличие от TelegramBrandIcon (синий круг),
 * наследует currentColor и не спорит с градиентной заливкой CTA-кнопки.
 */
export function TelegramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M21.6 4.3 3.1 11.4c-.9.35-.9 1.62.02 1.94l4.55 1.58 1.76 5.53c.22.7 1.1.9 1.6.37l2.55-2.66 4.6 3.37c.66.48 1.6.11 1.76-.69l3.1-14.9c.18-.86-.66-1.58-1.44-1.27ZM8.6 14.06l9.5-5.86c.2-.12.42.16.24.32l-7.5 6.75c-.2.18-.33.43-.36.7l-.24 1.99-1.64-3.9Z" />
    </svg>
  )
}

interface ActionsProps {
  botUrl: string | null
  /** Абсолютный URL кабинета — лендинг отдаётся с двух адресов, см. useLandingBrand. */
  cabinetHref: string
  /**
   * Скрыть кнопку кабинета от lg и шире. В hero на десктопе она дублирует
   * «Войти» в шапке, а на мобильных шапка сворачивается в бургер — там нужна.
   * Скрываем только когда есть telegram-кнопка, иначе hero остался бы без CTA.
   */
  cabinetDesktopHidden?: boolean
  /** Подписи приходят из i18n — компонент их не выдумывает. */
  botLabel: string
  cabinetLabel: string
  className?: string
  size?: 'md' | 'lg'
}

/**
 * Пара CTA: «Открыть в Telegram» (внешняя ссылка на бота) и «Личный кабинет».
 * Если BOT_URL в env не задан — telegram-кнопка не рисуется, и кабинетная
 * становится основной.
 */
export function LandingActions({
  botUrl,
  cabinetHref,
  botLabel,
  cabinetLabel,
  className,
  size = 'md',
  cabinetDesktopHidden = false,
}: ActionsProps) {
  const sizing =
    size === 'lg' ? 'h-12 px-7 text-base sm:h-14 sm:px-8' : 'h-12 px-6 text-[0.95rem]'
  const base = cn(
    'landing-cta group inline-flex items-center justify-center gap-2.5 rounded-full font-semibold',
    'outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--lp-cyan))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]',
    sizing,
  )

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      {botUrl && (
        <a
          href={botUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(base, 'landing-cta--primary')}
        >
          <TelegramGlyph className="size-5" />
          {botLabel}
        </a>
      )}
      <a
        href={cabinetHref}
        className={cn(
          base,
          botUrl ? 'landing-cta--ghost' : 'landing-cta--primary',
          cabinetDesktopHidden && botUrl && 'lg:hidden',
        )}
      >
        {botUrl ? <LayoutDashboard className="size-[1.15rem]" /> : null}
        {cabinetLabel}
        <ArrowRight className="size-[1.05rem] transition-transform duration-300 group-hover:translate-x-0.5" />
      </a>
    </div>
  )
}

interface SectionHeadingProps {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  className?: string
}

/** Единая шапка секции: бейдж → заголовок → лид. Все три появляются лесенкой. */
export function SectionHeading({ eyebrow, title, description, className }: SectionHeadingProps) {
  return (
    <div className={cn('mx-auto max-w-2xl text-center', className)}>
      <Reveal>
        <span className="landing-pill px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
          <span className="size-1.5 rounded-full bg-[hsl(var(--lp-cyan))]" aria-hidden />
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="mt-4 text-balance font-heading sm:mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={0.16}>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        </Reveal>
      )}
    </div>
  )
}
