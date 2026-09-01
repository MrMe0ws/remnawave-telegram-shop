import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'

/**
 * Сворачиваемая секция страницы рефералки: условия, лента начислений, список
 * приглашённых.
 *
 * Все три отвечают на вопросы, которые возникают не сразу: «за что платят»,
 * «откуда взялись дни», «кто у меня есть». Раскрытыми на телефоне они занимали
 * три экрана прокрутки под главной карточкой и мешали дойти до кнопки
 * «Поделиться», ради которой страницу и открывают.
 *
 * `hint` в шапке — не украшение, а замена содержимому: «+7 · +3 · +7» и число
 * начислений отвечают на вопрос целиком, и разворачивать секцию нужно уже
 * только за подробностями.
 *
 * По умолчанию на телефоне свёрнуто, на десктопе раскрыто: там места хватает,
 * а лишний тап только раздражает. Стартовое значение берётся синхронно из
 * matchMedia, поэтому секция не мигает раскрытой на первом кадре.
 */
export function ReferralSection({
  icon: Icon,
  title,
  hint,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  /** Короткая сводка справа в шапке: она и есть ответ, пока секция свёрнута. */
  hint?: string
  children: ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(!isMobile)
  const bodyId = useId()

  return (
    <Card className={cn('h-full overflow-hidden', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Icon size={17} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
        {hint ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{hint}</span>
        ) : null}
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Содержимое размонтируется, а не прячется классом: в ленте начислений
          это десятки строк с анимацией появления, и держать их в дереве ради
          закрытой секции незачем. */}
      {open ? (
        <div id={bodyId} className="px-4 pb-4">
          {children}
        </div>
      ) : null}
    </Card>
  )
}
