import { useEffect, useMemo, useState } from 'react'

import { cn } from '@/lib/utils'

/** ≥768px — крупные частицы только на ПК/планшете. */
function useIsDesktopViewport(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}

function particleCount(mobileDivisor = 1): number {
  if (typeof window === 'undefined') return 32
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0
  const base = window.matchMedia('(max-width: 767px)').matches ? 18 : 36
  return Math.max(4, Math.floor(base / mobileDivisor))
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

interface ParticleStyle {
  left: string
  animationDuration: string
  animationDelay: string
  fontSize: string
  opacity: number
  char: string
}

function buildParticleStyles(
  count: number,
  charOrChars: string | string[],
  opts?: { fontMin?: number; fontMax?: number; delayMax?: number; durationMin?: number; durationMax?: number },
): ParticleStyle[] {
  const fontMin = opts?.fontMin ?? 12
  const fontMax = opts?.fontMax ?? 22
  const delayMax = opts?.delayMax ?? 12
  const durationMin = opts?.durationMin ?? 8
  const durationMax = opts?.durationMax ?? 18
  const chars = Array.isArray(charOrChars) ? charOrChars : [charOrChars]
  return Array.from({ length: count }, () => ({
    left: `${randomBetween(0, 100)}%`,
    animationDuration: `${randomBetween(durationMin, durationMax)}s`,
    animationDelay: `${randomBetween(0, delayMax)}s`,
    fontSize: `${randomBetween(fontMin, fontMax)}px`,
    opacity: randomBetween(0.3, 0.85),
    char: chars[Math.floor(Math.random() * chars.length)]!,
  }))
}

interface FloatingParticlesProps {
  char?: string
  chars?: readonly string[]
  particleClassName: string
  fxClassName?: string
  count?: number
  buildOpts?: Parameters<typeof buildParticleStyles>[2]
}

function FloatingParticles({ char, chars, particleClassName, fxClassName, count, buildOpts }: FloatingParticlesProps) {
  const n = count ?? particleCount()
  const styles = useMemo(() => {
    const glyph = chars ? [...chars] : char ? [char] : ['✦']
    return buildParticleStyles(n, glyph, buildOpts)
  }, [n, char, chars, buildOpts])
  if (styles.length === 0) return null

  return (
    <div className={cn('cabinet-decor-fx', fxClassName)} aria-hidden>
      {styles.map((s, i) => (
        <span
          key={i}
          className={cn('cabinet-decor-particle', particleClassName)}
          style={{
            left: s.left,
            animationDuration: s.animationDuration,
            animationDelay: s.animationDelay,
            fontSize: s.fontSize,
            opacity: s.opacity,
          }}
        >
          {s.char}
        </span>
      ))}
    </div>
  )
}

export function SnowEffect() {
  const desktop = useIsDesktopViewport()
  const buildOpts = useMemo(
    () =>
      desktop
        ? { fontMin: 16, fontMax: 30, durationMin: 8, durationMax: 18, delayMax: 12 }
        : { fontMin: 12, fontMax: 24, durationMin: 8, durationMax: 18, delayMax: 12 },
    [desktop],
  )

  return (
    <FloatingParticles
      char="❄"
      fxClassName="cabinet-decor-fx--snow"
      particleClassName="cabinet-decor-particle--snow"
      buildOpts={buildOpts}
    />
  )
}

function staggeredTiming(durationMin: number, durationMax: number): { animationDuration: string; animationDelay: string } {
  const sec = randomBetween(durationMin, durationMax)
  return {
    animationDuration: `${sec}s`,
    animationDelay: `-${randomBetween(0, sec)}s`,
  }
}

export function SunraysEffect() {
  const desktop = useIsDesktopViewport()
  const buildOpts = useMemo(
    () =>
      desktop
        ? { sizeMin: 22, sizeMax: 44, durationMin: 9, durationMax: 16 }
        : { sizeMin: 18, sizeMax: 34, durationMin: 8, durationMax: 14 },
    [desktop],
  )
  const n = particleCount(4)
  const styles = useMemo(() => buildSummerLeafStyles(n, buildOpts), [n, buildOpts])
  if (styles.length === 0) return null

  return (
    <div className="cabinet-decor-fx cabinet-decor-fx--summer" aria-hidden>
      {styles.map((s, i) => (
        <span
          key={i}
          className={cn(
            'cabinet-decor-particle cabinet-decor-particle--summer-leaf',
            s.variant === 'wide' && 'cabinet-decor-particle--summer-leaf-wide',
          )}
          style={{
            left: s.left,
            width: s.size,
            height: s.size,
            animationDuration: s.animationDuration,
            animationDelay: s.animationDelay,
            opacity: s.opacity,
            ['--summer-flip' as string]: String(s.flip),
          }}
        >
          <SummerLeafSvg variant={s.variant} />
        </span>
      ))}
    </div>
  )
}

type SummerLeafVariant = 'default' | 'wide' | 'autumn'

interface SummerLeafStyle {
  left: string
  size: number
  animationDuration: string
  animationDelay: string
  opacity: number
  variant: SummerLeafVariant
  flip: number
}

function buildSummerLeafStyles(
  count: number,
  opts?: { sizeMin?: number; sizeMax?: number; durationMin?: number; durationMax?: number },
): SummerLeafStyle[] {
  const sizeMin = opts?.sizeMin ?? 18
  const sizeMax = opts?.sizeMax ?? 34
  const durationMin = opts?.durationMin ?? 8
  const durationMax = opts?.durationMax ?? 14
  const variants: SummerLeafVariant[] = ['default', 'wide', 'autumn']
  return Array.from({ length: count }, () => {
    const timing = staggeredTiming(durationMin, durationMax)
    return {
      left: `${randomBetween(0, 94)}%`,
      size: randomBetween(sizeMin, sizeMax),
      ...timing,
      opacity: randomBetween(0.4, 0.82),
      variant: variants[Math.floor(Math.random() * variants.length)]!,
      flip: Math.random() > 0.5 ? -1 : 1,
    }
  })
}

function SummerLeafSvg({ variant }: { variant: SummerLeafVariant }) {
  if (variant === 'wide') {
    return (
      <svg viewBox="0 0 24 14" fill="currentColor" aria-hidden className="size-full">
        <path
          d="M2 9 C6 4 10 3 14 5 C18 7 20 9 22 8 C19 11 14 12 10 11 C6 10 4 10 2 9Z"
          opacity="0.9"
        />
        <path d="M12 6 V11" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.45" />
      </svg>
    )
  }
  if (variant === 'autumn') {
    return (
      <svg viewBox="0 0 20 22" fill="currentColor" aria-hidden className="size-full">
        <path
          d="M10 2 C5 6 3 11 4 16 C6 14 8 13 10 13 C12 13 14 14 16 16 C17 11 15 6 10 2Z"
          opacity="0.88"
        />
        <path d="M10 13 V20" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-full">
      <path
        d="M10 3 C6 7 4 11 5 15 C7 13 9 12 10 12 C11 12 13 13 15 15 C16 11 14 7 10 3Z"
        opacity="0.9"
      />
      <path d="M10 12 V17" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" />
    </svg>
  )
}

function PumpkinSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-full">
      <path d="M12 3.5c-1.2 0-2 .8-2.6 2 .6-.3 1.3-.5 2.1-.5s1.5.2 2.1.5c-.6-1.2-1.4-2-2.6-2z" opacity="0.9" />
      <path d="M5.5 14.5c0-4 2.9-7 6.5-7s6.5 3 6.5 7c0 3.2-2.2 5.5-5 5.5h-3c-2.8 0-5-2.3-5-5.5z" opacity="0.95" />
      <ellipse cx="9" cy="12.5" rx="0.8" ry="1.2" fill="hsl(var(--background))" opacity="0.85" />
      <ellipse cx="15" cy="12.5" rx="0.8" ry="1.2" fill="hsl(var(--background))" opacity="0.85" />
      <path
        d="M10 16c.7.7 2.3.7 3 0"
        stroke="hsl(var(--background))"
        strokeWidth="1.1"
        fill="none"
        opacity="0.75"
      />
    </svg>
  )
}

interface PopParticleStyle {
  left: string
  top: string
  size: number
  animationDuration: string
  animationDelay: string
}

function buildPopStyles(
  count: number,
  opts?: { sizeMin?: number; sizeMax?: number; durationMin?: number; durationMax?: number },
): PopParticleStyle[] {
  const sizeMin = opts?.sizeMin ?? 48
  const sizeMax = opts?.sizeMax ?? 96
  const durationMin = opts?.durationMin ?? 2.2
  const durationMax = opts?.durationMax ?? 4.2
  return Array.from({ length: count }, () => {
    const timing = staggeredTiming(durationMin, durationMax)
    return {
      left: `${randomBetween(2, 78)}%`,
      top: `${randomBetween(12, 72)}%`,
      size: randomBetween(sizeMin, sizeMax),
      animationDuration: timing.animationDuration,
      animationDelay: timing.animationDelay,
    }
  })
}

export function PumpkinsEffect() {
  const desktop = useIsDesktopViewport()
  const buildOpts = useMemo(
    () =>
      desktop
        ? { sizeMin: 52, sizeMax: 108, durationMin: 2.2, durationMax: 4.5 }
        : { sizeMin: 40, sizeMax: 76, durationMin: 2, durationMax: 4 },
    [desktop],
  )
  const n = useMemo(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 0
    }
    return desktop ? 11 : 7
  }, [desktop])
  const styles = useMemo(() => buildPopStyles(n, buildOpts), [n, buildOpts])
  if (styles.length === 0) return null

  return (
    <div className="cabinet-decor-fx cabinet-decor-fx--halloween" aria-hidden>
      {styles.map((s, i) => (
        <span
          key={i}
          className="cabinet-decor-particle cabinet-decor-particle--pumpkin-pop"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDuration: s.animationDuration,
            animationDelay: s.animationDelay,
          }}
        >
          <PumpkinSvg />
        </span>
      ))}
    </div>
  )
}

export function HeartsEffect() {
  const desktop = useIsDesktopViewport()
  const buildOpts = useMemo(
    () =>
      desktop
        ? { fontMin: 24, fontMax: 42, durationMin: 9, durationMax: 18, delayMax: 12 }
        : { fontMin: 14, fontMax: 26, durationMin: 9, durationMax: 18, delayMax: 12 },
    [desktop],
  )

  return (
    <FloatingParticles
      char="♥"
      fxClassName="cabinet-decor-fx--valentine"
      particleClassName="cabinet-decor-particle--heart"
      count={particleCount(2)}
      buildOpts={buildOpts}
    />
  )
}

const SPRING_GLYPHS = ['petal', 'leaf', 'blossom', 'sprig'] as const
type SpringGlyph = (typeof SPRING_GLYPHS)[number]

interface WindParticleStyle {
  left: string
  top: string
  size: number
  animationDuration: string
  animationDelay: string
  opacity: number
  glyph: SpringGlyph
  flip: number
}

function buildSpringWindStyles(
  count: number,
  opts?: { sizeMin?: number; sizeMax?: number; durationMin?: number; durationMax?: number },
): WindParticleStyle[] {
  const sizeMin = opts?.sizeMin ?? 14
  const sizeMax = opts?.sizeMax ?? 28
  const durationMin = opts?.durationMin ?? 10
  const durationMax = opts?.durationMax ?? 18
  return Array.from({ length: count }, () => {
    const timing = staggeredTiming(durationMin, durationMax)
    return {
      left: `${randomBetween(-4, 92)}%`,
      top: `${randomBetween(8, 72)}%`,
      size: randomBetween(sizeMin, sizeMax),
      animationDuration: timing.animationDuration,
      animationDelay: timing.animationDelay,
      opacity: randomBetween(0.35, 0.8),
      glyph: SPRING_GLYPHS[Math.floor(Math.random() * SPRING_GLYPHS.length)]!,
      flip: Math.random() > 0.5 ? -1 : 1,
    }
  })
}

function SpringGlyphSvg({ kind }: { kind: SpringGlyph }) {
  switch (kind) {
    case 'petal':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-full">
          <ellipse cx="10" cy="10" rx="6" ry="3.5" opacity="0.9" transform="rotate(32 10 10)" />
        </svg>
      )
    case 'leaf':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-full">
          <path
            d="M10 3 C6 7 4 11 5 15 C7 13 9 12 10 12 C11 12 13 13 15 15 C16 11 14 7 10 3Z"
            opacity="0.88"
          />
          <path d="M10 12 V17" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" />
        </svg>
      )
    case 'blossom':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-full">
          <circle cx="10" cy="6" r="2.2" opacity="0.85" />
          <circle cx="13.5" cy="9" r="2.2" opacity="0.8" />
          <circle cx="12" cy="13" r="2.2" opacity="0.8" />
          <circle cx="8" cy="13" r="2.2" opacity="0.8" />
          <circle cx="6.5" cy="9" r="2.2" opacity="0.85" />
          <circle cx="10" cy="10" r="1.6" opacity="0.95" />
        </svg>
      )
    case 'sprig':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-full">
          <path d="M10 17 V8" stroke="currentColor" strokeWidth="1.3" fill="none" opacity="0.55" />
          <ellipse cx="7" cy="11" rx="3.2" ry="1.8" opacity="0.82" transform="rotate(-35 7 11)" />
          <ellipse cx="13" cy="9.5" rx="3" ry="1.7" opacity="0.78" transform="rotate(28 13 9.5)" />
          <ellipse cx="8.5" cy="7" rx="2.6" ry="1.5" opacity="0.75" transform="rotate(-20 8.5 7)" />
        </svg>
      )
  }
}

export function SpringEffect() {
  const desktop = useIsDesktopViewport()
  const buildOpts = useMemo(
    () =>
      desktop
        ? { sizeMin: 16, sizeMax: 32, durationMin: 10, durationMax: 18 }
        : { sizeMin: 12, sizeMax: 24, durationMin: 9, durationMax: 16 },
    [desktop],
  )
  const n = particleCount(2)
  const styles = useMemo(() => buildSpringWindStyles(n, buildOpts), [n, buildOpts])
  if (styles.length === 0) return null

  return (
    <div className="cabinet-decor-fx cabinet-decor-fx--spring" aria-hidden>
      {styles.map((s, i) => (
        <span
          key={i}
          className={cn(
            'cabinet-decor-particle',
            'cabinet-decor-particle--spring',
            s.glyph === 'petal' || s.glyph === 'blossom'
              ? 'cabinet-decor-particle--spring-bloom'
              : 'cabinet-decor-particle--spring-leaf',
          )}
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDuration: s.animationDuration,
            animationDelay: s.animationDelay,
            ['--spring-flip' as string]: String(s.flip),
          }}
        >
          <SpringGlyphSvg kind={s.glyph} />
        </span>
      ))}
    </div>
  )
}

const BLACK_FRIDAY_MONEY = ['💰', '💵', '$', '%'] as const
const BLACK_FRIDAY_GLYPHS = ['tag', 'money', 'flash'] as const
type BlackFridayGlyph = (typeof BLACK_FRIDAY_GLYPHS)[number]

interface SaleParticleStyle {
  left: string
  top: string
  size: number
  animationDuration: string
  animationDelay: string
  opacity: number
  glyph: BlackFridayGlyph
  char: string
  angle: number
}

function buildSaleParticleStyles(
  count: number,
  opts?: { sizeMin?: number; sizeMax?: number; durationMin?: number; durationMax?: number },
): SaleParticleStyle[] {
  const sizeMin = opts?.sizeMin ?? 18
  const sizeMax = opts?.sizeMax ?? 34
  const durationMin = opts?.durationMin ?? 6
  const durationMax = opts?.durationMax ?? 13
  return Array.from({ length: count }, () => {
    const glyph = BLACK_FRIDAY_GLYPHS[Math.floor(Math.random() * BLACK_FRIDAY_GLYPHS.length)]!
    const timing = staggeredTiming(durationMin, durationMax)
    return {
      left: `${randomBetween(-5, 88)}%`,
      top: `${randomBetween(10, 80)}%`,
      size: randomBetween(sizeMin, sizeMax),
      animationDuration: timing.animationDuration,
      animationDelay: timing.animationDelay,
      opacity: randomBetween(0.45, 0.92),
      glyph,
      char: BLACK_FRIDAY_MONEY[Math.floor(Math.random() * BLACK_FRIDAY_MONEY.length)]!,
      angle: randomBetween(-38, -18),
    }
  })
}

function SaleTagSvg() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="size-full">
      <path
        d="M6 8 L22 6 L26 22 L10 26 Z"
        fill="currentColor"
        opacity="0.92"
      />
      <circle cx="10" cy="10" r="2.2" fill="hsl(var(--background))" opacity="0.55" />
      <text x="16" y="19" textAnchor="middle" fill="hsl(var(--background))" fontSize="9" fontWeight="700" opacity="0.9">
        %
      </text>
    </svg>
  )
}

export function SparksEffect() {
  const desktop = useIsDesktopViewport()
  const buildOpts = useMemo(
    () =>
      desktop
        ? { sizeMin: 20, sizeMax: 38, durationMin: 7, durationMax: 14 }
        : { sizeMin: 16, sizeMax: 28, durationMin: 6, durationMax: 12 },
    [desktop],
  )
  const n = particleCount(4)
  const styles = useMemo(() => buildSaleParticleStyles(n, buildOpts), [n, buildOpts])
  if (styles.length === 0) return null

  return (
    <div className="cabinet-decor-fx cabinet-decor-fx--black_friday" aria-hidden>
      {styles.map((s, i) => (
        <span
          key={i}
          className={cn(
            'cabinet-decor-particle',
            'cabinet-decor-particle--bf',
            s.glyph === 'flash' && 'cabinet-decor-particle--bf-flash',
            s.glyph === 'tag' && 'cabinet-decor-particle--bf-tag',
            s.glyph === 'money' && 'cabinet-decor-particle--bf-money',
          )}
          style={{
            left: s.left,
            top: s.top,
            width: s.glyph === 'flash' ? s.size * 2.2 : s.size,
            height: s.glyph === 'flash' ? s.size * 2.2 : s.size,
            fontSize: s.glyph === 'money' ? `${s.size}px` : undefined,
            animationDuration: s.animationDuration,
            animationDelay: s.animationDelay,
            opacity: s.opacity,
            ['--bf-angle' as string]: `${s.angle}deg`,
          }}
        >
          {s.glyph === 'tag' ? <SaleTagSvg /> : s.glyph === 'money' ? s.char : null}
        </span>
      ))}
    </div>
  )
}
