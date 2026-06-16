import { cn } from '@/lib/utils'

import type { DecorThemeId } from './decorThemes'
import { useCabinetDecorTheme } from './useCabinetDecorTheme'

function SummerTree() {
  return (
    <svg
      className="cabinet-decor-scene__tree"
      viewBox="0 0 120 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M60 18 C42 42 28 58 32 78 C18 88 14 108 28 118 C22 132 26 148 44 152 C48 168 52 178 60 182 C68 178 72 168 76 152 C94 148 98 132 92 118 C106 108 102 88 88 78 C92 58 78 42 60 18Z"
        fill="currentColor"
        opacity="0.22"
      />
      <rect x="54" y="178" width="12" height="22" rx="2" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

function NewYearTree() {
  return (
    <svg
      className="cabinet-decor-scene__christmas-tree"
      viewBox="0 0 120 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M60 8 L72 28 H84 L68 48 L76 68 H92 L60 108 L28 68 H44 L52 48 L36 28 H48 Z" fill="currentColor" opacity="0.2" />
      <path d="M60 38 L70 54 H80 L66 72 L74 88 H88 L60 120 L32 88 H46 L54 72 L40 54 H50 Z" fill="currentColor" opacity="0.26" />
      <path d="M60 72 L68 84 H78 L64 98 L70 112 H82 L60 148 L38 112 H50 L56 98 L42 84 H52 Z" fill="currentColor" opacity="0.32" />
      <rect x="54" y="148" width="12" height="24" rx="2" fill="currentColor" opacity="0.35" />
      <path d="M60 4 L62 10 L68 10 L63 14 L65 20 L60 16 L55 20 L57 14 L52 10 L58 10 Z" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

function HalloweenMoon() {
  return (
    <svg className="cabinet-decor-scene__moon" viewBox="0 0 80 80" fill="none" aria-hidden>
      <defs>
        <radialGradient id="cabinet-moon-glow" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="hsl(48 85% 88%)" />
          <stop offset="55%" stopColor="hsl(45 70% 72%)" />
          <stop offset="100%" stopColor="hsl(42 55% 58%)" />
        </radialGradient>
        <mask id="cabinet-moon-crescent">
          <circle cx="40" cy="40" r="26" fill="white" />
          <circle cx="52" cy="36" r="22" fill="black" />
        </mask>
      </defs>
      <circle cx="40" cy="40" r="26" fill="url(#cabinet-moon-glow)" mask="url(#cabinet-moon-crescent)" />
      <ellipse cx="30" cy="38" rx="3.5" ry="2.5" fill="hsl(40 30% 45% / 0.22)" />
      <ellipse cx="36" cy="46" rx="2" ry="1.5" fill="hsl(40 30% 45% / 0.18)" />
      <ellipse cx="42" cy="34" rx="1.5" ry="1" fill="hsl(40 30% 45% / 0.15)" />
    </svg>
  )
}

function HalloweenCat() {
  return (
    <svg className="cabinet-decor-scene__cat" viewBox="0 0 80 72" fill="none" aria-hidden>
      <ellipse cx="40" cy="48" rx="28" ry="22" fill="currentColor" opacity="0.35" />
      <path d="M18 28 L24 8 L32 24 Z M48 24 L56 8 L62 28 Z" fill="currentColor" opacity="0.4" />
      <circle cx="30" cy="44" r="3" fill="hsl(var(--background))" />
      <circle cx="50" cy="44" r="3" fill="hsl(var(--background))" />
      <path d="M36 52 Q40 56 44 52" stroke="hsl(var(--background))" strokeWidth="2" fill="none" />
    </svg>
  )
}

function HalloweenMouse() {
  return (
    <svg className="cabinet-decor-scene__mouse" viewBox="0 0 64 48" fill="none" aria-hidden>
      <ellipse cx="32" cy="30" rx="22" ry="14" fill="currentColor" opacity="0.32" />
      <circle cx="48" cy="18" r="10" fill="currentColor" opacity="0.28" />
      <circle cx="52" cy="16" r="2" fill="hsl(var(--background))" />
      <path d="M8 28 C4 24 2 18 6 14" stroke="currentColor" strokeWidth="2" opacity="0.35" />
    </svg>
  )
}

function SpringScene() {
  return (
    <>
      <svg
        className="cabinet-decor-scene__spring-grass cabinet-decor-scene__spring-grass--bl"
        viewBox="0 0 80 48"
        fill="none"
        aria-hidden
      >
        <path d="M8 44 Q10 28 12 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        <path d="M16 44 Q18 22 20 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <path d="M24 44 Q26 30 28 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.32" />
        <path d="M32 44 Q34 18 36 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.38" />
        <ellipse cx="22" cy="44" rx="18" ry="4" fill="currentColor" opacity="0.12" />
      </svg>
      <svg
        className="cabinet-decor-scene__spring-bush cabinet-decor-scene__spring-bush--br"
        viewBox="0 0 72 56"
        fill="none"
        aria-hidden
      >
        <ellipse cx="36" cy="38" rx="22" ry="14" fill="currentColor" opacity="0.18" />
        <ellipse cx="26" cy="32" rx="14" ry="10" fill="currentColor" opacity="0.14" />
        <ellipse cx="48" cy="30" rx="12" ry="9" fill="currentColor" opacity="0.14" />
        <circle cx="30" cy="28" r="2.5" fill="hsl(var(--primary) / 0.35)" />
        <circle cx="42" cy="26" r="2" fill="hsl(var(--primary) / 0.3)" />
        <circle cx="36" cy="34" r="2" fill="hsl(var(--primary) / 0.28)" />
      </svg>
    </>
  )
}

function ValentineHearts() {
  return (
    <>
      <span className="cabinet-decor-scene__heart cabinet-decor-scene__heart--left" aria-hidden>
        ♥
      </span>
      <span className="cabinet-decor-scene__heart cabinet-decor-scene__heart--right" aria-hidden>
        ♥
      </span>
    </>
  )
}

function SceneContent({ theme }: { theme: DecorThemeId }) {
  switch (theme) {
    case 'new_year':
      return <NewYearTree />
    case 'summer':
      return <SummerTree />
    case 'halloween':
      return (
        <>
          <HalloweenMoon />
          <HalloweenCat />
          <HalloweenMouse />
        </>
      )
    case 'spring':
      return <SpringScene />
    case 'valentine':
      return <ValentineHearts />
    case 'neon':
      return (
        <>
          <div className="cabinet-decor-scene__neon-grid" aria-hidden />
          <div className="cabinet-decor-scene__neon-scanline" aria-hidden />
        </>
      )
    case 'black_friday':
      return (
        <>
          <div className="cabinet-decor-scene__bf-corner cabinet-decor-scene__bf-corner--tl" aria-hidden />
          <div className="cabinet-decor-scene__bf-corner cabinet-decor-scene__bf-corner--br" aria-hidden />
        </>
      )
    default:
      return null
  }
}

/** Фоновые силуэты и сцены декор-тем (фиксированный слой, не перекрывает клики). */
export function CabinetDecorScene() {
  const theme = useCabinetDecorTheme()
  if (theme === 'off') return null

  return (
    <div
      className={cn('cabinet-decor-scene', `cabinet-decor-scene--${theme}`)}
      data-cabinet-decor-scene={theme}
      aria-hidden
    >
      <SceneContent theme={theme} />
    </div>
  )
}
