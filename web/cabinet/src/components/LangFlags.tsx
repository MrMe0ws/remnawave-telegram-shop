/**
 * Флаги языков для переключателей (профиль, шапка админки).
 * Нарисованы SVG, а не эмодзи: на Windows эмодзи-флаги показываются буквами «RU» и «US».
 */

/** Флаг России: три полосы 3:2, со скруглением и тонкой обводкой — на тёмном фоне белая полоса не сливается. */
export function FlagRu() {
  return (
    <svg viewBox="0 0 30 20" className="h-[15px] w-[22px] overflow-hidden rounded-[3px] ring-1 ring-black/15" aria-hidden>
      <rect width="30" height="20" fill="#fff" />
      <rect y="6.67" width="30" height="6.67" fill="#0039A6" />
      <rect y="13.33" width="30" height="6.67" fill="#D52B1E" />
    </svg>
  )
}

/** Флаг США в упрощённом виде: семь полос и синий крыж — в 22px звёзды всё равно не различить. */
export function FlagUs() {
  return (
    <svg viewBox="0 0 30 20" className="h-[15px] w-[22px] overflow-hidden rounded-[3px] ring-1 ring-black/15" aria-hidden>
      <rect width="30" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#B22234" />
      ))}
      <rect width="13" height={(20 * 7) / 13} fill="#3C3B6E" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <circle key={`${r}-${c}`} cx={2 + c * 3} cy={2 + r * 3.4} r="0.7" fill="#fff" />
        )),
      )}
    </svg>
  )
}
