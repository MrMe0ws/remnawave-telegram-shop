import { useId, useMemo } from 'react'

import { cn } from '@/lib/utils'
import type { FortuneDesignVariant } from '@/features/fortune/fortunePrizeVisuals'

const RAY_COUNT = 14

const CONFETTI_COLORS = [
  'hsl(199 95% 58%)',
  'hsl(285 88% 62%)',
  'hsl(46 100% 54%)',
  'hsl(168 78% 48%)',
  'hsl(350 85% 58%)',
  'hsl(248 82% 65%)',
  'hsl(32 98% 55%)',
  'hsl(142 76% 52%)',
]

type Particle = {
  leftPct: number
  topPct: number
  dx: string
  dy: string
  rot: string
  delayMs: number
  color: string
  size: number
  round: boolean
}

function buildParticles(seed: number): Particle[] {
  const out: Particle[] = []
  for (let i = 0; i < 40; i++) {
    const u = ((i * 17 + seed) % 97) / 97
    const v = ((i * 31 + seed) % 89) / 89
    const angle = u * Math.PI * 2
    const dist = 55 + v * 150
    const dx = `${Math.cos(angle) * dist}px`
    const dy = `${32 + Math.sin(angle) * dist * 0.95}px`
    out.push({
      leftPct: 4 + u * 92,
      topPct: 2 + v * 48,
      dx,
      dy,
      rot: `${(u - 0.5) * 720}deg`,
      delayMs: Math.floor(i * 18 + v * 80),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + (i % 7) * 2,
      round: i % 3 !== 1,
    })
  }
  return out
}

/** Слои вспышки + лучи + «взрыв» + конфетти (не крутится с диском). */
export function FortuneWinCelebration({
  active,
  designVariant,
}: {
  active: boolean
  designVariant: FortuneDesignVariant
}) {
  const rayFilterId = `fortune-win-ray-glow-${useId().replace(/:/g, '')}`
  const particles = useMemo(() => buildParticles(91), [])

  if (!active) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-[25] overflow-hidden rounded-full motion-reduce:hidden',
        `fortune-celebration--${designVariant}`,
      )}
      aria-hidden
    >
      <div className="fortune-win-vignette absolute inset-0 rounded-full" />
      <div className="fortune-win-spotlight absolute inset-0 rounded-full" />
      <div className="fortune-win-spotlight-delayed absolute inset-0 rounded-full" />
      <div className="fortune-win-explosion absolute inset-[-18%] rounded-full" />
      <svg
        className="fortune-win-rays absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id={rayFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {Array.from({ length: RAY_COUNT }, (_, i) => (
          <g key={i} transform={`rotate(${(360 / RAY_COUNT) * i} 50 6)`}>
            <line
              x1="50"
              y1="6"
              x2="50"
              y2="46"
              className="stroke-white dark:stroke-sky-50"
              strokeWidth="2"
              strokeLinecap="round"
              filter={`url(#${rayFilterId})`}
              opacity="0.98"
            />
          </g>
        ))}
      </svg>
      <div className="fortune-win-rim-glint absolute inset-[3%] rounded-full" />
      {particles.map((p, i) => (
        <span
          key={i}
          className={cn(
            'fortune-confetti-bit absolute shadow-sm',
            i > 22 && designVariant === 'porcelain' && 'hidden',
            designVariant === 'ledger' && i > 18 && 'hidden',
            p.round ? 'rounded-full' : 'rounded-[2px]',
          )}
          style={{
            left: `${p.leftPct}%`,
            top: `${p.topPct}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.28,
            backgroundColor: p.color,
            boxShadow: `0 0 ${8 + (i % 5)}px ${p.color}`,
            animationDelay: `${p.delayMs}ms`,
            ['--dx' as string]: p.dx,
            ['--dy' as string]: p.dy,
            ['--rot' as string]: p.rot,
          }}
        />
      ))}
    </div>
  )
}
