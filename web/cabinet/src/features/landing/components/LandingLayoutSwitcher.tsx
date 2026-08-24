import {
  LANDING_LAYOUTS,
  LANDING_LAYOUT_LABELS,
  saveLandingLayout,
  type LandingLayout,
} from '../landingLayout'

/**
 * Переключатель раскладок для оценки вариантов на локалхосте.
 *
 * Рендерится только при import.meta.env.DEV (проверка на стороне LandingPage),
 * поэтому в прод-бандл не попадает. Смена варианта перезагружает страницу:
 * так видно и порядок секций, и анимации появления с нуля.
 */
export function LandingLayoutSwitcher({ current }: { current: LandingLayout }) {
  const pick = (layout: LandingLayout) => {
    saveLandingLayout(layout)
    const url = new URL(window.location.href)
    url.searchParams.set('layout', layout)
    window.location.href = url.toString()
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[min(94vw,640px)] -translate-x-1/2">
      <div className="rounded-2xl border border-border/80 bg-background/90 p-2 shadow-2xl backdrop-blur-xl">
        <p className="px-2 pb-1.5 pt-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Раскладка · только в dev
        </p>
        <div className="flex flex-col gap-1 sm:flex-row">
          {LANDING_LAYOUTS.map((layout) => {
            const active = layout === current
            return (
              <button
                key={layout}
                type="button"
                onClick={() => pick(layout)}
                aria-pressed={active}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[hsl(var(--lp-cyan)/0.18)] text-[hsl(var(--lp-cyan))] ring-1 ring-[hsl(var(--lp-cyan)/0.45)]'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                }`}
              >
                {LANDING_LAYOUT_LABELS[layout]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
