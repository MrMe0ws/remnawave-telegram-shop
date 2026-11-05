import type { ReactNode } from 'react'

import '@/lib/splitColor'
import type { ToneLevel } from '@/lib/subscriptionTone'

/**
 * Два вложенных кольца для плитки «Трафик» (раздельный трафик): снаружи обычные
 * серверы, внутри обход. Цвет внутреннего кольца — фиолетовый, пока всё спокойно;
 * жёлтый и красный — те же уровни тревоги, что у остальных колец главной.
 *
 * Толщина колец — 7 px, как у колец «Дней» и «Устройств» (.cabinet-ring): ряд плиток
 * выглядит ровно. У безлимитных обычных серверов внешнее кольцо приглушённое, а знак «∞»
 * вписан прямо в него (в верхней точке, по центру полосы), без отдельной плашки.
 */

const OUTER_COLOR: Record<ToneLevel, string> = {
  calm: 'hsl(var(--primary))',
  warn: 'hsl(38 92% 50%)',
  danger: 'hsl(var(--destructive))',
}
const INNER_COLOR: Record<ToneLevel, string> = {
  calm: 'hsl(var(--split-bypass))',
  warn: 'hsl(38 92% 50%)',
  danger: 'hsl(var(--destructive))',
}

/** Цвет метки-точки в подписи под кольцом. */
export const SPLIT_DOT_COLOR = { main: OUTER_COLOR, bypass: INNER_COLOR }

type Layer = { value: number | null; tone: ToneLevel }

/** Толщина кольца в пикселях и зазор между кольцами. */
const THICKNESS_PX = 7
const GAP_PX = 2.5

function Arc({ r, w, value, color }: { r: number; w: number; value: number; color: string }) {
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value))
  return (
    <>
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={w} />
      {pct > 0 && (
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={w}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 50 50)"
        />
      )}
    </>
  )
}

/** Безлимитное кольцо: полное, приглушённое, со знаком «∞» по центру полосы в верхней точке. */
function UnlimitedArc({ r, w }: { r: number; w: number }) {
  // Знак нарисован контуром вокруг своего центра (0, 0): так он стоит ровно посередине полосы,
  // а не «сидит» на базовой линии шрифта. Масштаб привязан к толщине кольца.
  const k = (w / 11) * 0.84
  return (
    <>
      <circle cx="50" cy="50" r={r} fill="none" stroke={OUTER_COLOR.calm} strokeOpacity={0.3} strokeWidth={w} />
      <path
        className="nested-ring-infinity"
        transform={`translate(50 ${50 - r}) scale(${k})`}
        d="M0 0 C2 -4.6 8.4 -4.6 8.4 0 C8.4 4.6 2 4.6 0 0 C-2 -4.6 -8.4 -4.6 -8.4 0 C-8.4 4.6 -2 4.6 0 0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  )
}

export function NestedStatRing({
  outer,
  inner,
  size = 64,
  children,
}: {
  /** Обычные серверы. value = null — безлимит: кольцо полное, приглушённое, со знаком «∞». */
  outer: Layer
  /** Обход. */
  inner: Layer & { value: number }
  size?: number
  children: ReactNode
}) {
  // Единицы viewBox (100) на пиксель: толщина в пикселях одна и та же при любом размере плитки.
  const unit = 100 / size
  const w = THICKNESS_PX * unit
  const outerR = 50 - w / 2
  const innerR = outerR - w - GAP_PX * unit
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        {outer.value === null ? (
          <UnlimitedArc r={outerR} w={w} />
        ) : (
          <Arc r={outerR} w={w} value={outer.value} color={OUTER_COLOR[outer.tone]} />
        )}
        <Arc r={innerR} w={w} value={inner.value} color={INNER_COLOR[inner.tone]} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center leading-none">{children}</div>
    </div>
  )
}
