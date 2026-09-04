import { cn } from '@/lib/utils'

/**
 * Флаг страны по ISO-коду (`countryCode` из Remnawave: `DE`, `SE`, `RU`).
 *
 * SVG лежат у нас в `public/flags` и отдаются со своего же домена. Эмодзи-флаги
 * тут не подходят: в системном шрифте Windows глифов флагов нет, и браузер
 * рисует вместо флага две буквы — то есть у половины админов картинки не было
 * бы вовсе. Внешний CDN отпал по другой причине: админку ставят в том числе в
 * закрытый контур, где до него не достучаться.
 *
 * Файл называется по коду в нижнем регистре. Кода нет или он битый — не рисуем
 * ничего; файла не оказалось (новая страна в наборе) — прячем по `onError`,
 * чтобы вместо флага не торчала иконка сломанной картинки.
 */
export function CountryFlag({
  code,
  className,
}: {
  code?: string | null
  className?: string
}) {
  const cc = code?.trim().toLowerCase()
  if (!cc || !/^[a-z]{2}$/.test(cc)) return null

  const upper = cc.toUpperCase()
  return (
    <img
      src={`${import.meta.env.BASE_URL}flags/${cc}.svg`}
      // Код страны как alt: если картинка не загрузится, скринридер и поиск по
      // странице всё равно получат «DE», а не пустоту.
      alt={upper}
      title={upper}
      loading="lazy"
      className={cn('h-3.5 w-5 shrink-0 rounded-[2px] object-cover', className)}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}
