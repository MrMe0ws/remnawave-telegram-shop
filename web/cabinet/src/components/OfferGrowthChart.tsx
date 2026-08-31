import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/** Система координат графика. Совпадает с viewBox. */
const W = 320
const H = 170

/** Отрисовка и пауза перед повтором, мс. */
const DRAW_MS = 1800
const HOLD_MS = 2200

/**
 * График накопленного результата с зациклённой отрисовкой.
 *
 * Рисуется слева направо, впереди линии бежит точка, следом проявляется
 * заливка; в конце пауза и повтор. Сдвиг ползунка перезапускает цикл, поэтому
 * график откликается на ввод, а не просто пересчитывается.
 *
 * Показываем именно накопленный итог, а не прибавку месяца. Прибавка в этой
 * модели растёт на одну и ту же величину, то есть рисуется строго прямой
 * линией — и никакая анимация её не изогнёт. Накопленная сумма даёт выпуклую
 * кривую на тех же самых числах.
 *
 * Чистый SVG, а не recharts: тот весит около полумегабайта и живёт только в
 * админке — тянуть его в кабинет ради одной ломаной незачем.
 */
export function OfferGrowthChart({ values, className }: { values: number[]; className?: string }) {
  const reduceMotion = useReducedMotion()

  const lineRef = useRef<SVGPathElement>(null)
  const areaRef = useRef<SVGPathElement>(null)
  const clipRef = useRef<SVGRectElement>(null)
  const dotRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const line = lineRef.current
    const area = areaRef.current
    const clip = clipRef.current
    const dot = dotRef.current
    if (!line || !area || !clip || !dot) return

    const { linePath, areaPath } = buildPaths(values)
    line.setAttribute('d', linePath)
    area.setAttribute('d', areaPath)

    const length = line.getTotalLength()

    /** t — доля отрисованной длины, 0..1. */
    const frame = (t: number) => {
      clip.setAttribute('width', (W * t).toFixed(2))
      const p = line.getPointAtLength(length * t)
      dot.style.left = `${(p.x / W) * 100}%`
      dot.style.top = `${(p.y / H) * 100}%`
      dot.style.opacity = t > 0.02 ? '1' : '0'
    }

    if (reduceMotion) {
      frame(1)
      return
    }

    let raf = 0
    let start = performance.now()
    const step = (now: number) => {
      const elapsed = now - start
      if (elapsed <= DRAW_MS) {
        // Замедление к концу: линейная скорость читается механически.
        const t = elapsed / DRAW_MS
        frame(1 - Math.pow(1 - t, 3))
      } else if (elapsed <= DRAW_MS + HOLD_MS) {
        frame(1)
      } else {
        start = now
        frame(0)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [values, reduceMotion])

  return (
    <div className={className}>
      {/*
        Цвет задан на самом svg: currentColor внутри <defs> разрешается по
        элементу градиента, а не по пути, который на него ссылается.
      */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full text-emerald-600 dark:text-emerald-400"
        aria-hidden
      >
        <defs>
          <linearGradient id="cabinet-growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <clipPath id="cabinet-growth-clip">
            <rect ref={clipRef} x="0" y="0" width="0" height={H} />
          </clipPath>
        </defs>

        <g stroke="hsl(var(--border))" strokeWidth={1}>
          <line x1="0" y1="42" x2={W} y2="42" />
          <line x1="0" y1="85" x2={W} y2="85" />
          <line x1="0" y1="128" x2={W} y2="128" />
        </g>

        <path ref={areaRef} fill="url(#cabinet-growth-fill)" clipPath="url(#cabinet-growth-clip)" d="" />
        {/*
          Линию раскрывает та же обрезка, что и заливку.
          Через stroke-dasharray это ломалось: non-scaling-stroke считает длину
          штриха в экранных пикселях, а getTotalLength отдаёт её в единицах
          viewBox. viewBox растянут по ширине примерно в полтора раза, поэтому
          линия обрывалась, не доходя до своего конца.
        */}
        <path
          ref={lineRef}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          // Иначе растянутый viewBox утолщал бы линию по горизонтали.
          vectorEffect="non-scaling-stroke"
          clipPath="url(#cabinet-growth-clip)"
          d=""
        />
      </svg>

      {/*
        Голова линии — обычный элемент поверх svg: внутри растянутого viewBox
        кружок превратился бы в эллипс.
      */}
      <span
        ref={dotRef}
        aria-hidden
        className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 opacity-0 shadow-[0_0_12px_3px] shadow-emerald-500/50 transition-opacity"
      />
    </div>
  )
}

/** Пути линии и площади под ней в координатах viewBox. */
function buildPaths(values: number[]): { linePath: string; areaPath: string } {
  const max = Math.max(...values) || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - (v / max) * (H - 16) - 8
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const linePath = `M${points.join(' L')}`
  return { linePath, areaPath: `${linePath} L${W},${H} L0,${H} Z` }
}
