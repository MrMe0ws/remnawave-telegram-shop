import { Heart, MessageCircle, type LucideIcon } from 'lucide-react'

import type { DecorThemeId } from './decorThemes'
import { useCabinetDecorTheme } from './useCabinetDecorTheme'

type NavIconProps = {
  className?: string
  strokeWidth?: number
}

/** Снеговик для new_year — читается даже на 18–20px. */
export function DecorSnowmanIcon({ className, strokeWidth = 1.75 }: NavIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="6.5" r="3" />
      <circle cx="12" cy="13.5" r="4" />
      <circle cx="12" cy="20.5" r="2.75" />
      <circle cx="10.5" cy="5.5" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="5.5" r="0.45" fill="currentColor" stroke="none" />
      <path d="M10 7.5h4" />
      <path d="M9 12.5h6" />
      <path d="M7.5 14l-2.25 1.25" />
      <path d="M16.5 14l2.25 1.25" />
    </svg>
  )
}

/** Тыква для halloween вместо «дома». */
export function DecorPumpkinIcon({ className, strokeWidth = 1.75 }: NavIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3.5c-1.2 0-2 .8-2.6 2" />
      <path d="M12 3.5c1.2 0 2 .8 2.6 2" />
      <path d="M5.5 14.5c0-4 2.9-7 6.5-7s6.5 3 6.5 7c0 3.2-2.2 5.5-5 5.5h-3c-2.8 0-5-2.3-5-5.5z" />
      <path d="M9 12.5v1.5" />
      <path d="M15 12.5v1.5" />
      <path d="M10 16.5c.7.7 2.3.7 3 0" />
    </svg>
  )
}

export function resolveDecorNavIcon(
  theme: DecorThemeId,
  to: string,
  defaultIcon: LucideIcon,
): LucideIcon | typeof DecorSnowmanIcon | typeof DecorPumpkinIcon {
  if (theme === 'valentine' && to === '/support') return Heart
  if (theme === 'halloween' && to === '/dashboard') return DecorPumpkinIcon
  if (theme === 'new_year' && to === '/profile') return DecorSnowmanIcon
  return defaultIcon
}

type DecorNavIconProps = NavIconProps & {
  to: string
  defaultIcon: LucideIcon
  theme: DecorThemeId
}

export function DecorNavIcon({ to, defaultIcon: DefaultIcon, theme, className, strokeWidth }: DecorNavIconProps) {
  const Icon = resolveDecorNavIcon(theme, to, DefaultIcon)
  return <Icon className={className} strokeWidth={strokeWidth} />
}

/** Иконка поддержки: сердце в valentine, иначе MessageCircle. */
export function DecorSupportIcon({ className, strokeWidth = 1.75 }: NavIconProps) {
  const theme = useCabinetDecorTheme()
  if (theme === 'valentine') {
    return <Heart className={className} strokeWidth={strokeWidth} aria-hidden />
  }
  return <MessageCircle className={className} strokeWidth={strokeWidth} aria-hidden />
}
