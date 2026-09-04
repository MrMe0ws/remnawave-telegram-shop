import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { surface, type SurfaceLevel } from './Surface'
import { rwIconToneClassNames, type RwIconTone } from '../utils/rwStatusStyles'
import {
  adminSectionIconAccentClassNames,
  type AdminSectionIconAccent,
} from '../utils/adminSectionIconAccents'

interface AdminSectionCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  headerRight?: ReactNode
  /** Крупный заголовок (профиль пользователя) */
  prominentTitle?: boolean
  /** RW status coloring — overrides iconAccent when not default */
  iconTone?: RwIconTone
  iconAccent?: AdminSectionIconAccent
  /** Растянуть карточку на всю высоту родителя (сетка / flex) */
  fillHeight?: boolean
  /**
   * Шапка без разделителя и с прижатым к содержимому низом.
   *
   * Черта под заголовком нужна там, где под ней форма или настройки: она
   * отделяет «что это» от «что менять». Над списком она лишняя — список и так
   * начинается своей строкой заголовков, и две горизонтальные линии подряд
   * читаются как пустая полоса.
   */
  flushHeader?: boolean
  /** Правый слот шапки прячется ниже sm: на телефоне он уходил на свою строку. */
  headerRightDesktopOnly?: boolean
  /**
   * Уровень поверхности. По умолчанию `card` — карточка на странице, с
   * привычной пластикой `cabinet-elevated-card`. Внутри модалки нужен
   * `raised`: панель окна сама уже `card`, и на ней такая же карточка
   * читается как продолжение фона.
   */
  level?: SurfaceLevel
}

export function AdminSectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  headerRight,
  iconTone = 'default',
  iconAccent,
  prominentTitle = false,
  fillHeight = false,
  flushHeader = false,
  headerRightDesktopOnly = false,
  level = 'card',
}: AdminSectionCardProps) {
  /*
   * Поднятый уровень нельзя нарисовать на <Card>: она несёт класс
   * `cabinet-card`, а `.dark .cabinet-card` заливает элемент градиентом с
   * !important. Любая заливка из Tailwind оказывается под ним, и карточка
   * внутри модалки красилась ровно как сама модалка. Поэтому на уровнях выше
   * плоскости берём обычный div со шкалой, а <Card> с её пластикой остаётся
   * там, где карточка и правда лежит на странице.
   */
  const Root = level === 'card' ? Card : 'div'
  const base =
    level === 'card'
      ? 'cabinet-elevated-card'
      : // Радиус и цвет текста приходили из <Card>; обычный div их не знает.
        surface(level, 'rounded-[var(--radius)] text-card-foreground')

  const iconStyles =
    iconTone !== 'default'
      ? rwIconToneClassNames(iconTone)
      : iconAccent
        ? adminSectionIconAccentClassNames(iconAccent)
        : rwIconToneClassNames('default')

  return (
    <Root
      className={cn(
        base,
        'overflow-hidden',
        fillHeight && 'flex h-full flex-col',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5',
          flushHeader ? 'pb-2' : 'border-b border-border/70 pb-4',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-lg',
                prominentTitle ? 'size-11' : 'size-8',
                iconStyles.boxClassName,
              )}
            >
              <Icon className={cn(prominentTitle ? 'size-5' : 'size-4', iconStyles.iconClassName)} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                'font-semibold leading-tight',
                prominentTitle ? 'text-lg sm:text-xl' : 'text-sm',
              )}
            >
              {title}
            </h2>
            {description && (
              <p
                className={cn(
                  'mt-1 break-all leading-snug text-muted-foreground',
                  prominentTitle ? 'text-sm' : 'text-xs',
                )}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {headerRight && (
          <div
            className={cn(
              'shrink-0 self-start sm:self-center',
              headerRightDesktopOnly && 'hidden sm:block',
            )}
          >
            {headerRight}
          </div>
        )}
      </div>
      <div
        className={cn(
          'min-w-0 px-4 pt-4 sm:px-5 sm:pt-5',
          flushHeader ? 'pb-4 sm:pb-5' : 'pb-4 sm:pb-5',
          fillHeight && 'flex flex-1 flex-col',
        )}
      >
        {children}
      </div>
    </Root>
  )
}
