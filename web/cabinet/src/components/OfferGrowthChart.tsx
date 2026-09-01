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
/** Подпись шкалы значений: `at` — доля от потолка, 0 внизу, 1 наверху. */
export interface OfferGrowthTick {
  label: string
  at: number
}

export function OfferGrowthChart({
  values,
  max,
  ticks,
  className,
}: {
  values: number[]
  /**
   * Потолок шкалы. По умолчанию — максимум ряда, и тогда верхняя точка
   * упирается в край. Своё значение нужно там, где рядом стоят подписи: они
   * обязаны читаться круглыми числами, а максимум ряда круглым не бывает.
   */
  max?: number
  /** Подписи шкалы слева. Пусто — оси нет, график занимает всю ширину. */
  ticks?: OfferGrowthTick[]
  className?: string
}) {
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

    const { linePath, areaPath } = buildPaths(values, max)
    line.setAttribute('d', linePath)
    area.setAttribute('d', areaPath)

    const length = line.getTotalLength()

    /** t — доля отрисованной длины, 0..1. */
    const frame = (t: number) => {
      // Ширина обрезки не может быть отрицательной: <rect width="-10"> браузер
      // отбрасывает с ошибкой в консоль. Зажимаем здесь, в единственном месте,
      // где значение попадает в DOM.
      const clamped = Math.min(1, Math.max(0, t))
      clip.setAttribute('width', (W * clamped).toFixed(2))
      const p = line.getPointAtLength(length * clamped)
      dot.style.left = `${(p.x / W) * 100}%`
      dot.style.top = `${(p.y / H) * 100}%`
      dot.style.opacity = clamped > 0.02 ? '1' : '0'
    }

    if (reduceMotion) {
      frame(1)
      return
    }

    let raf = 0
    /*
     * Отсчёт начинается с первого кадра, а не с момента подписки.
     * requestAnimationFrame отдаёт время начала кадра, и оно бывает раньше
     * performance.now(), снятого парой строк выше: elapsed уходил в минус, а
     * вместе с ним и доля отрисовки.
     */
    let start: number | null = null
    const step = (now: number) => {
      if (start === null) start = now
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
  }, [values, max, reduceMotion])

  return (
    <div className={className}>
      {ticks?.length ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8" aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick.label + tick.at}
              className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ top: `${(yFor(tick.at) / H) * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      ) : null}

      {/*
        Внутренняя обёртка совпадает с областью графика. Голову линии нельзя
        крепить к внешней: абсолютные координаты считаются от padding-box, и
        на ширину жёлоба под подписи точка уехала бы вбок.
      */}
      <div className="relative h-full" style={ticks?.length ? { marginLeft: 32 } : undefined}>
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

        {/* Сетка идёт по подписям, если они есть: линия без своей подписи
            ничего не сообщает, а подпись без линии не к чему привязать. */}
        <g stroke="hsl(var(--border))" strokeWidth={1}>
          {(ticks?.length ? ticks.map((tick) => yFor(tick.at)) : [42, 85, 128]).map((y) => (
            <line key={y} x1="0" y1={y} x2={W} y2={y} />
          ))}
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
    </div>
  )
}

/**
 * Округление потолка шкалы вверх до круглого числа.
 *
 * Ось подписывается значениями, и «111» на ней ничего не объясняет: подписи
 * читаются только круглыми. Берём ближайший вверх шаг ряда 1 / 2 / 2,5 / 5 / 10
 * в текущем порядке величины.
 */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const base = Math.pow(10, Math.floor(Math.log10(value)))
  for (const step of [1, 2, 2.5, 5]) {
    if (value <= step * base) return step * base
  }
  return 10 * base
}

/** Координата y для доли от потолка шкалы. */
function yFor(fraction: number): number {
  return H - fraction * (H - 16) - 8
}

/** Пути линии и площади под ней в координатах viewBox. */
function buildPaths(values: number[], ceiling?: number): { linePath: string; areaPath: string } {
  const max = ceiling && ceiling > 0 ? ceiling : Math.max(...values) || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = yFor(v / max)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const linePath = `M${points.join(' L')}`
  return { linePath, areaPath: `${linePath} L${W},${H} L0,${H} Z` }
}
