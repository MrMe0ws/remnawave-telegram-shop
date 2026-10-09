import { cn } from '@/lib/utils'

import { JackOLanternShape, SpiderSvg } from './DecorEffects'
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
    <svg className="cabinet-decor-scene__moon" viewBox="0 0 120 120" fill="none" aria-hidden>
      <defs>
        <radialGradient id="cabinet-hw-moon-face" cx="42%" cy="38%" r="62%">
          <stop offset="0%" stopColor="hsl(50 90% 92%)" />
          <stop offset="60%" stopColor="hsl(45 75% 76%)" />
          <stop offset="100%" stopColor="hsl(38 60% 60%)" />
        </radialGradient>
        <radialGradient id="cabinet-hw-moon-halo" cx="50%" cy="50%" r="50%">
          <stop offset="45%" stopColor="hsl(42 90% 70% / 0.35)" />
          <stop offset="100%" stopColor="hsl(42 90% 70% / 0)" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill="url(#cabinet-hw-moon-halo)" />
      <circle cx="60" cy="60" r="32" fill="url(#cabinet-hw-moon-face)" />
      <circle cx="50" cy="52" r="6" fill="hsl(38 35% 50% / 0.22)" />
      <circle cx="68" cy="68" r="8" fill="hsl(38 35% 50% / 0.18)" />
      <circle cx="70" cy="47" r="3.5" fill="hsl(38 35% 50% / 0.2)" />
      <circle cx="48" cy="72" r="3" fill="hsl(38 35% 50% / 0.16)" />
      {/* летучая мышь на фоне луны */}
      <g className="cabinet-decor-scene__moon-bat" transform="translate(46 58) scale(0.55)">
        <path d="M30 11 C24 6 14 5 3 9 C7.5 11 9 14 8 18 C11 15.5 14 15.5 16 19 C18 15.5 21 15.5 23 19 C25 15.5 28 15 30 16 Z" />
        <path d="M34 11 C40 6 50 5 61 9 C56.5 11 55 14 56 18 C53 15.5 50 15.5 48 19 C46 15.5 43 15.5 41 19 C39 15.5 36 15 34 16 Z" />
        <ellipse cx="32" cy="14.5" rx="3.6" ry="6" />
        <path d="M29.2 9.5 L29.6 4.5 L31.3 7.6 H32.7 L34.4 4.5 L34.8 9.5 Z" />
      </g>
    </svg>
  )
}

/** Паутина в углу: 7 радиальных нитей + провисающие кольца. Генерируется один раз. */
const WEB_SPOKES = [0, 15, 30, 45, 60, 75, 90].map((deg) => (deg * Math.PI) / 180)
const WEB_RINGS = [22, 42, 64, 88, 112]
const WEB_PATH = (() => {
  const pt = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`
  const spokes = WEB_SPOKES.map((a) => `M0 0 L${pt(120, a)}`)
  const rings = WEB_RINGS.map((r) =>
    WEB_SPOKES.slice(1)
      .map((a, i) => {
        const prev = WEB_SPOKES[i]!
        return `${i === 0 ? `M${pt(r, prev)} ` : ''}Q${pt(r * 0.84, (a + prev) / 2)} ${pt(r, a)}`
      })
      .join(' '),
  )
  return [...spokes, ...rings].join(' ')
})()

function HalloweenWeb() {
  return (
    <div className="cabinet-decor-scene__web" aria-hidden>
      <svg viewBox="0 0 120 120" fill="none" className="size-full overflow-visible">
        <path d={WEB_PATH} stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
      </svg>
      <span className="cabinet-hw-spider cabinet-hw-spider--web">
        <span className="cabinet-hw-spider__drop">
          <span className="cabinet-hw-spider__body">
            <SpiderSvg />
          </span>
        </span>
      </span>
    </div>
  )
}

/** Тыква на земле в силуэте кладбища: x/y — центр основания, size — ширина. */
function GroundPumpkin({ x, y, size }: { x: number; y: number; size: number }) {
  const scale = size / 64
  return (
    <g className="cabinet-decor-scene__ground-pumpkin" transform={`translate(${x - size / 2} ${y - 56 * scale}) scale(${scale})`}>
      <JackOLanternShape />
    </g>
  )
}

function HalloweenGraveyardLeft() {
  return (
    <svg className="cabinet-decor-scene__graves cabinet-decor-scene__graves--l" viewBox="0 0 300 200" aria-hidden>
      <g className="cabinet-decor-scene__silhouette">
        <path d="M0 320 V172 C60 160 140 158 220 168 C260 173 285 178 300 182 V320 Z" />
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M40 196 C42 175 44 150 40 120 C38 104 32 90 22 78" strokeWidth="9" />
          <path d="M41 128 C52 112 66 104 86 100" strokeWidth="5" />
          <path d="M70 103 C76 94 78 86 76 74" strokeWidth="3" />
          <path d="M86 100 C94 99 100 94 104 88" strokeWidth="2.5" />
          <path d="M22 78 C16 70 14 60 17 48" strokeWidth="4" />
          <path d="M27 86 C19 84 10 86 2 93" strokeWidth="3" />
          <path d="M43 160 C55 150 66 148 80 151" strokeWidth="4" />
          <path d="M17 60 C12 56 8 56 4 58" strokeWidth="2" />
        </g>
        <path d="M108 200 V152 C108 132 148 132 148 152 V200 Z" />
        <rect x="186" y="140" width="8" height="50" rx="1" />
        <rect x="174" y="152" width="32" height="8" rx="1" />
        <path d="M232 200 V170 C232 158 254 158 254 170 V200 Z" />
        {/* кот на надгробии */}
        <path d="M114 140 C112 128 115 119 121 115 C119 111 119 105 121 101 L119.5 91 L126 97 C128 96 132 96 134 97 L140.5 91 L139 101 C141 105 141 111 139 115 C145 119 148 128 146 140 Z" />
        <path d="M145 138 C154 137 158 128 153 119" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      </g>
      <g className="cabinet-decor-scene__cat-eyes">
        <ellipse cx="126" cy="106" rx="1.9" ry="1.5" />
        <ellipse cx="134" cy="106" rx="1.9" ry="1.5" />
      </g>
      <GroundPumpkin x={78} y={182} size={34} />
    </svg>
  )
}

const FENCE_POSTS = Array.from({ length: 9 }, (_, i) => 150 + i * 18)

function HalloweenGraveyardRight() {
  return (
    <svg className="cabinet-decor-scene__graves cabinet-decor-scene__graves--r" viewBox="0 0 300 200" aria-hidden>
      <g className="cabinet-decor-scene__silhouette">
        {FENCE_POSTS.map((x) => (
          <path key={x} d={`M${x} 200 V146 L${x + 2.5} 139 L${x + 5} 146 V200 Z`} />
        ))}
        <rect x="146" y="156" width="154" height="3.5" />
        <rect x="146" y="178" width="154" height="3.5" />
        <path d="M0 320 V184 C30 176 80 166 150 164 C220 162 270 168 300 172 V320 Z" />
        <path d="M54 200 V158 C54 140 90 140 90 158 V200 Z" />
        <path d="M14 200 V180 L18 170 H32 L36 180 V200 Z" />
      </g>
      <text x="72" y="166" textAnchor="middle" className="cabinet-decor-scene__rip">
        RIP
      </text>
      <GroundPumpkin x={122} y={178} size={40} />
      <GroundPumpkin x={226} y={186} size={30} />
    </svg>
  )
}

function HalloweenScene() {
  return (
    <>
      <div className="cabinet-decor-scene__hw-horizon" aria-hidden />
      <HalloweenMoon />
      <HalloweenWeb />
      <HalloweenGraveyardLeft />
      <HalloweenGraveyardRight />
      <div className="cabinet-decor-scene__fog cabinet-decor-scene__fog--a" aria-hidden />
      <div className="cabinet-decor-scene__fog cabinet-decor-scene__fog--b" aria-hidden />
    </>
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

function AuroraBands() {
  return (
    <>
      <div className="cabinet-decor-scene__aurora-band cabinet-decor-scene__aurora-band--a" aria-hidden />
      <div className="cabinet-decor-scene__aurora-band cabinet-decor-scene__aurora-band--b" aria-hidden />
      <div className="cabinet-decor-scene__aurora-band cabinet-decor-scene__aurora-band--c" aria-hidden />
    </>
  )
}

function OceanWave() {
  return <div className="cabinet-decor-scene__ocean-wave" aria-hidden />
}

function CyberGrid() {
  return (
    <>
      <div className="cabinet-decor-scene__cyber-grid" aria-hidden />
      <div className="cabinet-decor-scene__cyber-scanline" aria-hidden />
    </>
  )
}

function SunsetGlow() {
  return (
    <>
      <div className="cabinet-decor-scene__sunset-orb cabinet-decor-scene__sunset-orb--sun" aria-hidden />
      <div className="cabinet-decor-scene__sunset-orb cabinet-decor-scene__sunset-orb--haze" aria-hidden />
    </>
  )
}

/** wine: густая винная дымка по углам + мягкий блик «бокала» у верхней кромки. */
function WineHaze() {
  return (
    <>
      <div className="cabinet-decor-scene__wine-haze cabinet-decor-scene__wine-haze--tl" aria-hidden />
      <div className="cabinet-decor-scene__wine-haze cabinet-decor-scene__wine-haze--br" aria-hidden />
      <div className="cabinet-decor-scene__wine-sheen" aria-hidden />
    </>
  )
}

function LavenderMist() {
  return (
    <>
      <div className="cabinet-decor-scene__lavender-mist cabinet-decor-scene__lavender-mist--tl" aria-hidden />
      <div className="cabinet-decor-scene__lavender-mist cabinet-decor-scene__lavender-mist--br" aria-hidden />
    </>
  )
}

/**
 * nebula: сетка-«блюпринт» + три дышащих цветных пятна.
 * Тот же приём, что на лендинге, — фон живёт, но не отвлекает от контента.
 */
function NebulaGlow() {
  return (
    <>
      <div className="cabinet-decor-scene__nebula-grid" aria-hidden />
      <div className="cabinet-decor-scene__nebula-orb cabinet-decor-scene__nebula-orb--cyan" aria-hidden />
      <div className="cabinet-decor-scene__nebula-orb cabinet-decor-scene__nebula-orb--violet" aria-hidden />
      <div className="cabinet-decor-scene__nebula-orb cabinet-decor-scene__nebula-orb--teal" aria-hidden />
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
      return <HalloweenScene />
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
    case 'aurora':
      return <AuroraBands />
    case 'nebula':
      return <NebulaGlow />
    case 'ocean':
      return <OceanWave />
    case 'cyber':
      return <CyberGrid />
    case 'sunset':
      return <SunsetGlow />
    case 'lavender':
      return <LavenderMist />
    case 'wine':
      return <WineHaze />
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
