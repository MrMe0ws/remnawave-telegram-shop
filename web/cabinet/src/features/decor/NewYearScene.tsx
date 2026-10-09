import type { CSSProperties } from 'react'

/**
 * new_year: звёздное небо, наряженная ёлка с подарками, снеговик и сугробы.
 * Нижняя часть живёт в .cabinet-ny-ground: на телефоне она поднята над
 * нижним меню, а снег тянется вниз за viewBox, чтобы под меню не было щели.
 */

/** Детерминированный ГПСЧ: звёзды не прыгают между рендерами и вкладками. */
function seeded(seed: number) {
  let x = seed
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296
    return x / 4294967296
  }
}

const STARS = (() => {
  const rnd = seeded(2027)
  return Array.from({ length: 34 }, () => ({
    left: `${(rnd() * 100).toFixed(2)}%`,
    top: `${(rnd() * 70).toFixed(2)}%`,
    size: 1 + rnd() * 2.2,
    delay: `${(-rnd() * 6).toFixed(2)}s`,
    duration: `${(3 + rnd() * 4).toFixed(2)}s`,
  }))
})()

function NewYearSky() {
  return (
    <div className="cabinet-ny-sky" aria-hidden>
      {STARS.map((s, i) => (
        <span
          key={i}
          className="cabinet-ny-star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  )
}

function starPath(cx: number, cy: number, outer: number, inner: number) {
  return (
    Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? outer : inner
      const a = (Math.PI / 5) * i - Math.PI / 2
      return `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
    }).join(' ') + ' Z'
  )
}

const TREE_TIERS = [
  'M80 92 L142 196 C130 201 120 192 110 198 C100 192 92 201 80 196 C68 201 60 192 50 198 C40 192 30 201 18 196 Z',
  'M80 62 L130 150 C120 155 110 147 100 152 C92 147 86 155 80 151 C74 155 68 147 60 152 C50 147 40 155 30 150 Z',
  'M80 36 L118 106 C110 110 102 104 94 108 C88 104 84 110 80 107 C76 110 72 104 66 108 C58 104 50 110 42 106 Z',
  'M80 16 L104 62 C96 66 88 60 80 64 C72 60 64 66 56 62 Z',
]

/** Снег по нижней кромке каждого яруса — та же волна, что у яруса. */
const TREE_SNOW = [
  'M22 194 C32 199 40 191 50 197 C60 191 68 200 80 195 C92 200 100 191 110 197 C120 191 130 199 138 194',
  'M33 148 C42 153 50 146 60 151 C68 146 74 154 80 150 C86 154 92 146 100 151 C110 146 118 153 127 148',
  'M45 104 C52 108 58 103 66 107 C72 103 76 109 80 106 C84 109 88 103 94 107 C102 103 108 108 115 104',
  'M59 61 C66 64 72 59 80 63 C88 59 94 64 101 61',
]

const ORNAMENTS: { cx: number; cy: number; color: string; blink?: boolean }[] = [
  { cx: 66, cy: 84, color: 'hsl(355 80% 55%)', blink: true },
  { cx: 96, cy: 78, color: 'hsl(45 95% 58%)' },
  { cx: 80, cy: 124, color: 'hsl(205 85% 58%)', blink: true },
  { cx: 52, cy: 138, color: 'hsl(45 95% 58%)' },
  { cx: 110, cy: 132, color: 'hsl(355 80% 55%)' },
  { cx: 68, cy: 168, color: 'hsl(280 70% 64%)', blink: true },
  { cx: 120, cy: 178, color: 'hsl(205 85% 58%)' },
  { cx: 38, cy: 180, color: 'hsl(355 80% 55%)', blink: true },
  { cx: 96, cy: 160, color: 'hsl(45 95% 58%)', blink: true },
  { cx: 82, cy: 46, color: 'hsl(205 85% 58%)' },
]

function Gift({
  x,
  y,
  w,
  h,
  box,
  ribbon,
}: {
  x: number
  y: number
  w: number
  h: number
  box: string
  ribbon: string
}) {
  const cx = x + w / 2
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1.5" fill={box} />
      <rect x={x - 1} y={y} width={w + 2} height={h * 0.28} rx="1.5" fill={box} />
      <rect x={x} y={y} width={w} height={h * 0.28} rx="1.5" fill="hsl(0 0% 100% / 0.12)" />
      <rect x={cx - 2} y={y} width="4" height={h} fill={ribbon} />
      <ellipse cx={cx - 4} cy={y - 2} rx="4.2" ry="2.6" fill="none" stroke={ribbon} strokeWidth="2" />
      <ellipse cx={cx + 4} cy={y - 2} rx="4.2" ry="2.6" fill="none" stroke={ribbon} strokeWidth="2" />
    </g>
  )
}

function ChristmasTree() {
  return (
    <svg className="cabinet-ny-tree" viewBox="0 0 160 222" aria-hidden>
      <defs>
        <linearGradient id="cabinet-ny-fir" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="hsl(145 42% 31%)" />
          <stop offset="55%" stopColor="hsl(150 46% 23%)" />
          <stop offset="100%" stopColor="hsl(156 50% 16%)" />
        </linearGradient>
        <radialGradient id="cabinet-ny-star-glow">
          <stop offset="0%" stopColor="hsl(48 100% 70% / 0.85)" />
          <stop offset="100%" stopColor="hsl(48 100% 70% / 0)" />
        </radialGradient>
      </defs>
      <rect x="75" y="190" width="10" height="26" rx="1.5" fill="hsl(25 45% 17%)" />
      {TREE_TIERS.map((d) => (
        <path key={d} d={d} fill="url(#cabinet-ny-fir)" />
      ))}
      <g className="cabinet-ny-tree__snow" fill="none" strokeWidth="3.2" strokeLinecap="round">
        {TREE_SNOW.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className="cabinet-ny-tree__lights" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0 7">
        <path d="M56 70 Q80 82 102 66" />
        <path d="M44 112 Q80 132 116 106" />
        <path d="M32 158 Q80 180 128 152" />
      </g>
      {ORNAMENTS.map((o) => (
        <g key={`${o.cx}-${o.cy}`} className={o.blink ? 'cabinet-ny-ornament cabinet-ny-ornament--blink' : 'cabinet-ny-ornament'}>
          <circle cx={o.cx} cy={o.cy} r="4.6" fill={o.color} />
          <circle cx={o.cx - 1.5} cy={o.cy - 1.6} r="1.3" fill="hsl(0 0% 100% / 0.75)" />
        </g>
      ))}
      <circle className="cabinet-ny-tree__star-glow" cx="80" cy="13" r="20" fill="url(#cabinet-ny-star-glow)" />
      <path d={starPath(80, 13, 11, 4.6)} fill="hsl(46 100% 60%)" stroke="hsl(40 100% 45%)" strokeWidth="0.8" />
      <Gift x={20} y={198} w={28} h={22} box="hsl(355 72% 48%)" ribbon="hsl(46 95% 60%)" />
      <Gift x={98} y={203} w={22} h={17} box="hsl(210 75% 50%)" ribbon="hsl(0 0% 96%)" />
      <Gift x={124} y={207} w={16} h={13} box="hsl(150 50% 36%)" ribbon="hsl(355 72% 52%)" />
    </svg>
  )
}

function SnowyFir({ x, w }: { x: number; w: number }) {
  const h = w * 1.6
  const top = 160 - h
  return (
    <g className="cabinet-ny-fir-bg">
      <path d={`M${x + w / 2} ${top} L${x + w} ${top + h * 0.62} H${x} Z`} />
      <path d={`M${x + w / 2} ${top + h * 0.28} L${x + w * 1.08} ${top + h * 0.92} H${x - w * 0.08} Z`} />
      <path
        className="cabinet-ny-fir-bg__snow"
        d={`M${x + w / 2} ${top} L${x + w * 0.66} ${top + h * 0.2} L${x + w * 0.5} ${top + h * 0.16} L${x + w * 0.34} ${top + h * 0.2} Z`}
      />
    </g>
  )
}

function Snowman() {
  return (
    <svg className="cabinet-ny-snowman" viewBox="0 0 220 160" aria-hidden>
      <defs>
        <radialGradient id="cabinet-ny-snowball" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="hsl(0 0% 100%)" />
          <stop offset="70%" stopColor="hsl(210 45% 93%)" />
          <stop offset="100%" stopColor="hsl(212 40% 80%)" />
        </radialGradient>
      </defs>
      <SnowyFir x={140} w={44} />
      <SnowyFir x={182} w={30} />
      <g transform="translate(30 6)">
        <path d="M28 76 L4 56 M14 64 L6 68" stroke="hsl(25 40% 28%)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M72 76 L98 58 M88 64 L94 70" stroke="hsl(25 40% 28%)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="50" cy="120" r="30" fill="url(#cabinet-ny-snowball)" />
        <circle cx="50" cy="76" r="22" fill="url(#cabinet-ny-snowball)" />
        <circle cx="50" cy="42" r="16" fill="url(#cabinet-ny-snowball)" />
        <rect x="31" y="25" width="38" height="4.5" rx="2" fill="hsl(220 25% 13%)" />
        <rect x="37" y="4" width="26" height="23" rx="2.5" fill="hsl(220 25% 13%)" />
        <rect x="37" y="20" width="26" height="4.5" fill="hsl(355 72% 50%)" />
        <circle cx="44" cy="39" r="1.9" fill="hsl(220 25% 13%)" />
        <circle cx="56" cy="39" r="1.9" fill="hsl(220 25% 13%)" />
        <path d="M50 44 L66 47.5 L50 49 Z" fill="hsl(25 95% 54%)" />
        <path d="M43 51.5 Q50 55.5 57 51.5" stroke="hsl(220 25% 13%)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeDasharray="0 3.2" />
        <path d="M33 56 C41 62 59 62 67 56 L67 62 C59 68 41 68 33 62 Z" fill="hsl(355 72% 50%)" />
        <path d="M57 62 L63 84 L55.5 85 L51 63 Z" fill="hsl(355 65% 44%)" />
        <circle cx="50" cy="74" r="2.2" fill="hsl(220 25% 13%)" />
        <circle cx="50" cy="84" r="2.2" fill="hsl(220 25% 13%)" />
        <circle cx="50" cy="114" r="2.4" fill="hsl(220 25% 13%)" />
      </g>
    </svg>
  )
}

/**
 * Два слоя сугробов позади ёлки и снеговика; низ уходит за viewBox
 * (overflow: visible), закрывая щель под ними.
 */
function SnowDrifts() {
  return (
    <svg className="cabinet-ny-drifts" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden>
      <path
        className="cabinet-ny-drifts__back"
        d="M0 600 V58 C150 26 300 72 450 50 C600 28 750 68 900 42 C1020 24 1110 52 1200 36 V600 Z"
      />
      <path
        className="cabinet-ny-drifts__front"
        d="M0 600 V86 C200 58 380 98 600 80 C820 62 1000 98 1200 74 V600 Z"
      />
    </svg>
  )
}

export function NewYearScene() {
  return (
    <>
      <NewYearSky />
      <div className="cabinet-ny-ground" aria-hidden>
        <SnowDrifts />
        <ChristmasTree />
        <Snowman />
      </div>
    </>
  )
}

/** Гирлянда с провисающим проводом под шапкой + снежная кромка шапки. */
const GARLAND_COLORS = [
  'hsl(355 85% 58%)',
  'hsl(45 100% 58%)',
  'hsl(140 65% 48%)',
  'hsl(205 90% 60%)',
  'hsl(285 75% 66%)',
  'hsl(25 95% 58%)',
]
const GARLAND_SPANS = 14

const SNOW_CAP_PATH = (() => {
  const rnd = seeded(31)
  let d = 'M0 0 H1200 V2'
  for (let x = 1200; x > 0; ) {
    const w = 18 + rnd() * 34
    const nx = Math.max(0, x - w)
    const depth = 4 + rnd() * 6
    d += ` Q${((x + nx) / 2).toFixed(1)} ${(2 + depth * 2).toFixed(1)} ${nx.toFixed(1)} 2`
    x = nx
  }
  return d + ' Z'
})()

export function NewYearHeaderDecor() {
  const wire = Array.from({ length: GARLAND_SPANS }, (_, i) => {
    const x0 = i * 40
    return `${i === 0 ? `M${x0} 2 ` : ''}Q${x0 + 20} 22 ${x0 + 40} 2`
  }).join(' ')

  return (
    <div className="cabinet-ny-header pointer-events-none absolute inset-x-0 bottom-0 h-px" aria-hidden>
      <svg className="cabinet-ny-header__snow" viewBox="0 0 1200 16" preserveAspectRatio="none">
        <path d={SNOW_CAP_PATH} />
      </svg>
      <div className="cabinet-ny-garland">
        <svg viewBox={`0 0 ${GARLAND_SPANS * 40} 24`} preserveAspectRatio="none" className="cabinet-ny-garland__wire">
          <path d={wire} fill="none" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>
        {Array.from({ length: GARLAND_SPANS }, (_, i) => (
          <span
            key={i}
            className="cabinet-ny-bulb"
            style={
              {
                left: `${((i + 0.5) / GARLAND_SPANS) * 100}%`,
                '--bulb-color': GARLAND_COLORS[i % GARLAND_COLORS.length],
                '--bulb-delay': `${(i % GARLAND_COLORS.length) * 0.32}s`,
                '--bulb-tilt': `${i % 2 === 0 ? -8 : 8}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}
