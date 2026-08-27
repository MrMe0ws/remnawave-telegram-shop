import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/**
 * QR-код ссылки, нарисованный SVG-путём.
 *
 * SVG, а не canvas: код печатают, увеличивают и открывают в тёмной теме, и
 * вектор переживает всё это без ресемплинга. Модули собираются в один <path> —
 * при 30+ строках это на порядок меньше узлов, чем прямоугольник на модуль.
 *
 * Фон всегда белый, а модули всегда чёрные, даже в тёмной теме: инверсный QR
 * читают далеко не все камеры, а сканирование здесь — единственная задача
 * картинки. Поэтому же вокруг остаётся светлое поле (quiet zone) в 4 модуля,
 * которого требует спецификация.
 */
export function QrCode({
  value,
  size = 208,
  className,
  title,
}: {
  value: string
  size?: number
  className?: string
  title?: string
}) {
  const { path, dimension } = useMemo(() => {
    // 0 — автоподбор версии под длину строки; 'M' — 15% избыточности, запас на
    // блики и кривой угол съёмки при ещё умеренной плотности модулей.
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()

    const count = qr.getModuleCount()
    const quiet = 4
    const parts: string[] = []
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) parts.push(`M${col + quiet} ${row + quiet}h1v1h-1z`)
      }
    }
    return { path: parts.join(''), dimension: count + quiet * 2 }
  }, [value])

  return (
    <svg
      viewBox={`0 0 ${dimension} ${dimension}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
    >
      <rect width={dimension} height={dimension} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  )
}
