import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Tv } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Иконки платформ для лендинга.
 *
 * В lucide брендовых логотипов нет (в DevicePlatformIcon кабинета используются
 * generic-фигуры), поэтому Apple / Android / Windows / Linux нарисованы своими
 * путями. Все глифы монохромные и наследуют currentColor — так они одинаково
 * ложатся и на тёмную подложку hero, и внутрь карточки возможностей.
 *
 * Логотип Apple закрывает и iOS, и macOS — рисовать одно и то же яблоко дважды
 * смысла нет, поэтому подпись у него двойная.
 */

type GlyphProps = { className?: string }

function AppleGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.05 12.54c-.02-2.2 1.79-3.25 1.87-3.3-1.02-1.5-2.61-1.7-3.17-1.73-1.35-.14-2.63.79-3.31.79-.7 0-1.75-.77-2.88-.75-1.48.02-2.85.86-3.61 2.19-1.54 2.68-.39 6.64 1.11 8.81.74 1.06 1.62 2.25 2.78 2.21 1.11-.04 1.54-.72 2.89-.72 1.34 0 1.73.72 2.9.7 1.2-.02 1.97-1.09 2.71-2.15.85-1.22 1.2-2.4 1.22-2.46-.03-.01-2.34-.9-2.36-3.58ZM14.9 5.86c.61-.74 1.02-1.77.91-2.79-.9.04-1.99.6-2.62 1.34-.57.65-1.06 1.7-.93 2.7 1 .08 2.02-.51 2.64-1.25Z" />
    </svg>
  )
}

function AndroidGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6.4 9.4h11.2v8.3c0 .6-.5 1.1-1.1 1.1h-1.2v2.6a1.4 1.4 0 1 1-2.8 0v-2.6h-1.4v2.6a1.4 1.4 0 1 1-2.8 0v-2.6H7.5c-.6 0-1.1-.5-1.1-1.1V9.4Z" />
      <path d="M3.4 9.2a1.4 1.4 0 0 1 1.4 1.4v5.1a1.4 1.4 0 0 1-2.8 0v-5.1a1.4 1.4 0 0 1 1.4-1.4ZM20.6 9.2a1.4 1.4 0 0 1 1.4 1.4v5.1a1.4 1.4 0 0 1-2.8 0v-5.1a1.4 1.4 0 0 1 1.4-1.4Z" />
      <path d="M15.7 3.6l1.1-1.9a.5.5 0 0 0-.87-.5l-1.15 2A6.6 6.6 0 0 0 12 2.6c-.99 0-1.92.19-2.75.55l-1.16-2a.5.5 0 0 0-.86.5l1.1 1.9A5.9 5.9 0 0 0 6.4 8.3h11.2a5.9 5.9 0 0 0-1.9-4.7ZM9.6 6.4a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4.8 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z" />
    </svg>
  )
}

function WindowsGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3 5.6 10.4 4.5v7.2H3V5.6ZM3 18.4l7.4 1.1v-7.1H3v6ZM11.6 4.3 21 2.9v8.8h-9.4V4.3ZM11.6 19.7 21 21.1v-8.7h-9.4v7.3Z" />
    </svg>
  )
}

function LinuxGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {/* Тукс: тело + белая грудка, глаза и клюв — отдельными фигурами. */}
      <path
        fill="currentColor"
        d="M12 1.6c-2.35 0-3.9 1.83-3.9 4.28 0 1.06.13 1.9-.3 2.76-.55 1.1-1.6 2.03-2.35 3.42-.64 1.18-1.05 2.44-1.48 3.3-.32.65-.77 1.1-.53 1.75.33.87 1.5.78 2.56 1.1.66.2 1.1.63 1.72.93.55.27 1.1.36 1.66.36h5.24c.62 0 1.24-.12 1.82-.42.62-.31 1.06-.72 1.7-.92 1.05-.33 2.22-.24 2.55-1.11.24-.65-.21-1.1-.53-1.75-.43-.86-.84-2.12-1.48-3.3-.75-1.39-1.8-2.32-2.35-3.42-.43-.86-.3-1.7-.3-2.76 0-2.45-1.55-4.28-3.9-4.28Z"
      />
      <path
        fill="hsl(var(--background))"
        d="M12 12.1c1.9 0 3.5 1.5 3.5 3.2 0 1.6-1.6 2.9-3.5 2.9s-3.5-1.3-3.5-2.9c0-1.7 1.6-3.2 3.5-3.2Z"
      />
      <ellipse cx="10.3" cy="6.5" rx="1.05" ry="1.4" fill="hsl(var(--background))" />
      <ellipse cx="13.7" cy="6.5" rx="1.05" ry="1.4" fill="hsl(var(--background))" />
      <ellipse cx="10.4" cy="6.8" rx=".5" ry=".7" fill="currentColor" />
      <ellipse cx="13.6" cy="6.8" rx=".5" ry=".7" fill="currentColor" />
      <path fill="#f5a623" d="M12 7.9c.95 0 1.75.62 1.75 1.25S12.95 10.6 12 10.6s-1.75-.82-1.75-1.45S11.05 7.9 12 7.9Z" />
    </svg>
  )
}

interface Platform {
  id: string
  Icon: (props: GlyphProps) => ReactElement
}

/** Порядок как в подписи: Apple (iOS/macOS) → Android → Windows → Linux → Smart TV. */
const PLATFORMS: Platform[] = [
  { id: 'apple', Icon: AppleGlyph },
  { id: 'android', Icon: AndroidGlyph },
  { id: 'windows', Icon: WindowsGlyph },
  { id: 'linux', Icon: LinuxGlyph },
  { id: 'tv', Icon: (props) => <Tv {...props} strokeWidth={1.9} /> },
]

/**
 * Ряд иконок платформ. `label` уходит в aria-label списка, чтобы скринридер
 * получил перечисление словами — иконки для него бесполезны.
 */
export function LandingPlatformRow({
  className,
  iconClassName,
  label,
}: {
  className?: string
  iconClassName?: string
  label?: string
}) {
  const { t } = useTranslation()

  return (
    <ul
      className={cn('flex flex-wrap items-center gap-3 sm:gap-4', className)}
      aria-label={label}
    >
      {PLATFORMS.map(({ id, Icon }) => (
        <li key={id} title={t(`landing.platforms.${id}`)} className="inline-flex">
          <Icon className={cn('size-6 text-foreground/70 sm:size-7', iconClassName)} />
          <span className="sr-only">{t(`landing.platforms.${id}`)}</span>
        </li>
      ))}
    </ul>
  )
}
