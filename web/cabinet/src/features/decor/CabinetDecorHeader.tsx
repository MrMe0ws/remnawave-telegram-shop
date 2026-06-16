import type { CSSProperties } from 'react'

import { useCabinetDecorTheme } from './useCabinetDecorTheme'

const GARLAND_BULBS = [
  '#ef4444',
  '#22c55e',
  '#eab308',
  '#3b82f6',
  '#a855f7',
  '#f97316',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
  '#84cc16',
  '#06b6d4',
  '#f59e0b',
]

function NewYearGarland() {
  return (
    <div className="cabinet-decor-garland pointer-events-none absolute inset-x-0 bottom-0 h-3 translate-y-1/2" aria-hidden>
      <div className="cabinet-decor-garland__wire" />
      <div className="cabinet-decor-garland__bulbs">
        {GARLAND_BULBS.map((color, i) => (
          <span
            key={i}
            className="cabinet-decor-garland__bulb"
            style={
              {
                '--bulb-color': color,
                '--bulb-delay': `${(i % 6) * 0.35}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}

function NeonHeaderAccent() {
  return (
    <div className="cabinet-decor-neon-header pointer-events-none absolute inset-x-0 bottom-0 h-px" aria-hidden>
      <div className="cabinet-decor-neon-header__line" />
    </div>
  )
}

/** Декор нижнего края sticky-хедера (гирлянда, неон и т.д.). */
export function CabinetDecorHeader() {
  const theme = useCabinetDecorTheme()

  if (theme === 'new_year') return <NewYearGarland />
  if (theme === 'neon') return <NeonHeaderAccent />
  return null
}
