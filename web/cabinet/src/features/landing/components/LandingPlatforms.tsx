import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Tv } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Иконки платформ для лендинга.
 *
 * В lucide брендовых логотипов нет (в DevicePlatformIcon кабинета используются
 * generic-фигуры), поэтому Apple / Android / Windows / Ubuntu нарисованы своими
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
      {/*
        Яблоко занимает меньшую долю вьюбокса, чем робот Android или квадраты
        Windows, и при одинаковом size выглядело мельче соседей — доводим
        масштабом от центра.
      */}
      <g transform="translate(12 12) scale(1.2) translate(-12 -12)">
        <path d="M17.05 12.54c-.02-2.2 1.79-3.25 1.87-3.3-1.02-1.5-2.61-1.7-3.17-1.73-1.35-.14-2.63.79-3.31.79-.7 0-1.75-.77-2.88-.75-1.48.02-2.85.86-3.61 2.19-1.54 2.68-.39 6.64 1.11 8.81.74 1.06 1.62 2.25 2.78 2.21 1.11-.04 1.54-.72 2.89-.72 1.34 0 1.73.72 2.9.7 1.2-.02 1.97-1.09 2.71-2.15.85-1.22 1.2-2.4 1.22-2.46-.03-.01-2.34-.9-2.36-3.58ZM14.9 5.86c.61-.74 1.02-1.77.91-2.79-.9.04-1.99.6-2.62 1.34-.57.65-1.06 1.7-.93 2.7 1 .08 2.02-.51 2.64-1.25Z" />
      </g>
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

function UbuntuGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {/*
        «Круг друзей» Ubuntu. Три дуги рисуются одной окружностью через
        dasharray: длина окружности при r=7.2 равна 45.24, что делится на три
        периода 15.08 (дуга 8.88 + разрыв 6.2), поэтому разрывы точно попадают
        под точки. dashoffset смещает шаблон так, чтобы первый разрыв встал
        по центру правой точки.
      */}
      <circle
        cx="12"
        cy="12"
        r="7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeDasharray="8.88 6.2"
        strokeDashoffset="11.98"
      />
      <circle cx="19.2" cy="12" r="2.3" fill="currentColor" />
      <circle cx="8.4" cy="5.77" r="2.3" fill="currentColor" />
      <circle cx="8.4" cy="18.23" r="2.3" fill="currentColor" />
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
  { id: 'linux', Icon: UbuntuGlyph },
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
