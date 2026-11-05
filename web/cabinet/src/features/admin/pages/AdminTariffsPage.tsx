import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  GripVertical,
  Zap,
  Plus,
  Pencil,
  Trash2,
  Server,
  Smartphone,
  Gauge,
  LayoutGrid,
  Rows2,
} from 'lucide-react'

import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminFeedback } from '../components/AdminFeedback'
import { AdminTariffEditor } from '../components/AdminTariffEditor'
import { AdminConfirmModal } from '../components/AdminConfirmModal'
import { AdminToggleSwitch } from '../components/AdminToggleSwitch'
import { AdminProductSettingsPanel } from '../components/AdminProductSettingsPanel'
import { useAdminMutationFeedback } from '../hooks/useAdminMutationFeedback'
import { tariffTierAccent } from '../utils/tariffTierAccent'
import { TariffDescription } from '@/components/TariffDescription'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { bypassLabel } from '@/lib/bypassLabel'
import '@/lib/splitColor'
import {
  useAdminTariffList,
  useAdminTariffCreate,
  useAdminTariffUpdate,
  useAdminTariffDelete,
  useAdminTariffSquadsApply,
  type AdminTariff,
  type AdminTariffPrice,
  type CreateTariffInput,
} from '../hooks/useAdminTariffs'

const GB = 1024 * 1024 * 1024

/** Периоды прайса — те же, что в редакторе тарифа. */
const PERIOD_MONTHS = [1, 3, 6, 12] as const

/** Целые значения без «.0»: 200 ГБ, а не 200.0 ГБ. */
function formatGb(bytes: number): string {
  const gb = bytes / GB
  return String(Number.isInteger(gb) ? gb : gb.toFixed(1))
}

/** Безлимит показываем знаком «∞» без единиц: «∞ ГБ» — бессмыслица. */
function formatTrafficLimit(bytes: number, gbUnit: string): string {
  if (!bytes || bytes <= 0) return '∞'
  return `${formatGb(bytes)} ${gbUnit}`
}

const VIEW_KEY = 'admin.tariffs.view'
type TariffsView = 'grid' | 'list'

/** ПК-раскладка (таблица) с md; на телефоне — плитка или список. */
function useIsDesktop(): boolean {
  const query = '(min-width: 768px)'
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return matches
}

function readView(): TariffsView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

/** Значок трафика; жёлтая точка — у тарифа продаётся докупка. */
function TrafficIcon({ packs, className }: { packs: number; className: string }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Gauge className={className} />
      {packs > 0 && (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-amber-500 ring-[1.5px] ring-card" />
      )}
    </span>
  )
}

/**
 * Лимит трафика: «∞ +30» — безлимит на обычных серверах плюс отдельный лимит обхода
 * (обход бывает только при безлимитных обычных, поэтому «200 +30» не встречается).
 */
function TrafficValue({ tariff, withUnit }: { tariff: AdminTariff; withUnit: boolean }) {
  const { t } = useTranslation()
  const gbUnit = t('admin.users.subscription.gbUnit')
  const bypass = tariff.bypass_limit_bytes ?? 0
  return (
    <span className="inline-flex items-baseline gap-1">
      {formatTrafficLimit(tariff.traffic_limit_bytes, gbUnit)}
      {bypass > 0 && (
        <span className="text-[hsl(var(--split-bypass))]">
          +{formatGb(bypass)}
          {withUnit && ` ${gbUnit}`}
        </span>
      )}
    </span>
  )
}

/** Расшифровка чипа трафика для подсказки. */
function trafficTitle(tariff: AdminTariff, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const gbUnit = t('admin.users.subscription.gbUnit')
  const main = tariff.traffic_limit_bytes > 0 ? `${formatGb(tariff.traffic_limit_bytes)} ${gbUnit}` : t('admin.tariffs.unlimited')
  const bypass = tariff.bypass_limit_bytes ?? 0
  const packs = tariff.traffic_packs ?? 0
  if (bypass <= 0 && packs <= 0) return t('admin.tariffs.trafficShort')
  const lines = [t('admin.tariffs.trafficMainTip', { value: main })]
  if (bypass > 0) lines.push(t('admin.tariffs.trafficBypassTip', { label: bypassLabel(), value: `${formatGb(bypass)} ${gbUnit}` }))
  if (packs > 0) lines.push(t('admin.tariffs.trafficPacksTip', { count: packs }))
  return lines.join('\n')
}

function formatRub(amount: number, locale: string): string {
  return `${new Intl.NumberFormat(locale).format(amount)} ₽`
}

function LimitChip({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <span
      title={label}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/25 px-2.5 py-1.5"
    >
      {icon}
      <span className="text-sm font-semibold leading-none tabular-nums">{value}</span>
    </span>
  )
}

function shownPrices(prices: AdminTariffPrice[]): AdminTariffPrice[] {
  const byMonths = new Map(prices.map((p) => [p.months, p]))
  return PERIOD_MONTHS.map((m) => byMonths.get(m)).filter((p): p is AdminTariffPrice => p != null)
}

/** Прайс тарифа: то, ради чего страницу открывают, — раньше его тут не было вовсе. */
function TariffPrices({ prices, locale }: { prices: AdminTariffPrice[]; locale: string }) {
  const { t } = useTranslation()

  const shown = shownPrices(prices)

  if (shown.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 px-3 py-2.5 text-center text-xs text-muted-foreground">
        {t('admin.tariffs.noPrices')}
      </p>
    )
  }

  return (
    <div className="flex gap-1.5 rounded-xl border border-border/40 bg-muted/15 p-1.5">
      {shown.map((price) => (
        <div key={price.months} className="min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-center">
          <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('admin.users.monthsShort', { count: price.months })}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">
            {formatRub(price.amount_rub, locale)}
          </p>
          {price.amount_stars != null && price.amount_stars > 0 && (
            <p className="mt-0.5 truncate text-[10px] tabular-nums text-muted-foreground">
              ★ {price.amount_stars}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/** Ручка перетаскивания: тянуть указателем или стрелками с клавиатуры. */
function GripHandle({
  dragging,
  onHandleDown,
  onHandleKey,
  className,
  iconClassName,
}: {
  dragging: boolean
  onHandleDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  onHandleKey: (dir: -1 | 1) => void
  className: string
  iconClassName: string
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      aria-label={t('admin.tariffs.reorderHint')}
      title={t('admin.tariffs.reorderHint')}
      onPointerDown={onHandleDown}
      // В плитке вся карточка открывает редактор: ручка не должна его открывать.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const dir =
          e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0
        if (dir) {
          e.preventDefault()
          e.stopPropagation()
          onHandleKey(dir)
        }
      }}
      className={cn(
        'flex shrink-0 touch-none items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
    >
      <GripVertical className={iconClassName} />
    </button>
  )
}

/** Цена за месяц при каждом периоде: на сколько дешевле месяц на длинном тарифе, чем на коротком. */
function perMonth(price: AdminTariffPrice): number {
  return Math.ceil(price.amount_rub / price.months)
}

/** Самая низкая цена за месяц среди периодов тарифа; null — цен нет. */
function minPerMonth(prices: AdminTariffPrice[]): number | null {
  const shown = shownPrices(prices)
  return shown.length ? Math.min(...shown.map(perMonth)) : null
}

/** Цена в плитке: одна, «от … ₽/мес». Остальные периоды видны в редакторе. */
function TilePrice({ prices, locale }: { prices: AdminTariffPrice[]; locale: string }) {
  const { t } = useTranslation()
  const min = minPerMonth(prices)
  if (min == null) {
    return <p className="mt-2 text-center text-[11px] text-muted-foreground">{t('admin.tariffs.noPrices')}</p>
  }
  return (
    <p className="mt-2 flex items-baseline gap-1 px-0.5 tabular-nums">
      <span className="text-[11px] text-muted-foreground">{t('admin.tariffs.fromPrice')}</span>
      <span className="whitespace-nowrap text-base font-bold leading-none">{formatRub(min, locale)}</span>
      <span className="text-[11px] text-muted-foreground">{t('admin.tariffs.perMonthShort')}</span>
    </p>
  )
}

/**
 * Карточка тарифа на ПК: цветная шапка, описание, лимиты чипами и лента периодов с
 * ценой за месяц и скидкой. Нажатие на карточку открывает редактор; удаление — там.
 */
function TariffShowcase({
  tariff,
  onEdit,
  locale,
  position,
  dragging,
  onHandleDown,
  onHandleKey,
}: {
  tariff: AdminTariff
  onEdit: () => void
  locale: string
  position: number
  dragging: boolean
  onHandleDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  onHandleKey: (dir: -1 | 1) => void
}) {
  const { t } = useTranslation()
  const update = useAdminTariffUpdate()
  const squadCount = tariff.active_internal_squad_uuids
    ? tariff.active_internal_squad_uuids.split(',').filter(Boolean).length
    : 0
  const title = tariff.name?.trim() || tariff.slug
  const accent = tariffTierAccent(position)
  const inactive = !tariff.is_active
  const prices = shownPrices(tariff.prices)
  const base = prices.find((p) => p.months === 1)
  const bypass = tariff.bypass_limit_bytes ?? 0
  const chip = 'inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/25 px-2.5 py-1 text-sm font-semibold tabular-nums'
  return (
    <Card
      role="button"
      tabIndex={0}
      title={t('admin.edit')}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onEdit()
        }
      }}
      className={cn(
        'cabinet-elevated-card relative flex h-full w-full min-w-0 cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        inactive && 'bg-muted/30',
        dragging && 'border-primary/60 shadow-2xl shadow-black/40',
      )}
    >
      <div className="relative flex items-center gap-2 border-b border-border/40 px-4 py-3">
        {/* Цвет уровня тарифа: плавно уходит вправо, чтобы не спорить с тумблером. */}
        <span
          aria-hidden
          className={cn('absolute inset-0 opacity-20', accent.bar, inactive && 'opacity-10')}
          style={{ maskImage: 'linear-gradient(to right, black, transparent 75%)', WebkitMaskImage: 'linear-gradient(to right, black, transparent 75%)' }}
        />
        <GripHandle
          dragging={dragging}
          onHandleDown={onHandleDown}
          onHandleKey={onHandleKey}
          className={cn('relative -ml-1.5 h-8 w-6 hover:bg-muted', accent.iconColor, inactive && 'opacity-40')}
          iconClassName="size-4"
        />
        <div className="relative min-w-0 flex-1">
          <h3 className={cn('truncate text-base font-bold', inactive && 'text-muted-foreground')}>{title}</h3>
          <p className="truncate font-mono text-[11px] text-muted-foreground/70">
            {tariff.slug} · #{tariff.sort_order}
          </p>
        </div>
        <span
          className="relative flex shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <AdminToggleSwitch
            checked={tariff.is_active}
            onChange={(next) => update.mutate({ id: tariff.id, fields: { is_active: next } })}
            busy={update.isPending}
            aria-label={t('admin.tariffs.toggleActive')}
          />
        </span>
      </div>

      <div className={cn('flex flex-1 flex-col px-4 pb-4 pt-3', inactive && 'opacity-55')}>
        {tariff.description?.trim() && (
          <p className="mb-3 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
            {tariff.description.trim()}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span className={chip} title={t('admin.tariffs.devices')}>
            <Smartphone className="size-3.5 text-muted-foreground" />
            {tariff.device_limit}
          </span>
          <span className={chip} title={t('admin.tariffs.squadsShort')}>
            <Server className="size-3.5 text-muted-foreground" />
            {squadCount > 0 ? squadCount : '∞'}
          </span>
          <span className={chip} title={trafficTitle(tariff, t)}>
            <TrafficIcon packs={tariff.traffic_packs ?? 0} className="size-3.5 text-muted-foreground" />
            <TrafficValue tariff={tariff} withUnit={false} />
          </span>
          {bypass > 0 && <span className="sr-only">{bypassLabel()}</span>}
        </div>

        {prices.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('admin.tariffs.noPrices')}</p>
        ) : (
          <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-xl border border-border/40">
            {prices.map((price, k) => {
              const pm = perMonth(price)
              const saving =
                base && price.months > 1 && base.amount_rub > 0 ? Math.round((1 - pm / base.amount_rub) * 100) : 0
              return (
                <div key={price.months} className={cn('min-w-0 px-2.5 py-2 tabular-nums', k > 0 && 'border-l border-border/40')}>
                  <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    {t('admin.users.monthsShort', { count: price.months })}
                  </p>
                  <p className="truncate text-[15px] font-bold">{formatRub(price.amount_rub, locale)}</p>
                  <p className="min-h-[15px] truncate text-[11px] text-muted-foreground">
                    {price.months > 1 && (
                      <>
                        {formatRub(pm, locale)}
                        {t('admin.tariffs.perMonthShort')}
                        {saving > 0 && <span className="ml-1 text-emerald-500">−{saving}%</span>}
                      </>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Плитка тарифа: две в ряд на телефоне. Только название, вкл/выкл, лимиты и цены;
 * описание и удаление — в редакторе, он открывается нажатием на плитку.
 */
function TariffTile({
  tariff,
  onEdit,
  locale,
  position,
  dragging,
  onHandleDown,
  onHandleKey,
}: {
  tariff: AdminTariff
  onEdit: () => void
  locale: string
  position: number
  dragging: boolean
  onHandleDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  onHandleKey: (dir: -1 | 1) => void
}) {
  const { t } = useTranslation()
  const update = useAdminTariffUpdate()

  const squadCount = tariff.active_internal_squad_uuids
    ? tariff.active_internal_squad_uuids.split(',').filter(Boolean).length
    : 0
  const title = tariff.name?.trim() || tariff.slug
  const accent = tariffTierAccent(position)
  const inactive = !tariff.is_active

  return (
    <Card
      role="button"
      tabIndex={0}
      title={t('admin.edit')}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onEdit()
        }
      }}
      className={cn(
        'cabinet-elevated-card relative flex h-full w-full min-w-0 cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        inactive && 'bg-muted/30',
        dragging && 'border-primary/60 shadow-2xl shadow-black/40',
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', accent.bar, inactive && 'opacity-30')} />

      <div className="flex flex-1 flex-col p-2 pl-3">
        <div className="flex min-w-0 items-center gap-1">
          <GripHandle
            dragging={dragging}
            onHandleDown={onHandleDown}
            onHandleKey={onHandleKey}
            className={cn('-ml-1.5 h-7 w-5 hover:bg-muted', accent.iconColor, inactive && 'opacity-40')}
            iconClassName="size-4"
          />
          <h3 className={cn('min-w-0 flex-1 truncate text-sm font-semibold', inactive && 'text-muted-foreground')}>
            {title}
          </h3>
          <span className="flex shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <AdminToggleSwitch
              size="sm"
              checked={tariff.is_active}
              onChange={(next) => update.mutate({ id: tariff.id, fields: { is_active: next } })}
              busy={update.isPending}
              aria-label={t('admin.tariffs.toggleActive')}
            />
          </span>
        </div>
        <p className="ml-[18px] truncate font-mono text-[10px] text-muted-foreground/70">
          {tariff.slug} · #{tariff.sort_order}
        </p>

        {/* mt-auto: лимиты и цены соседних плиток стоят на одной высоте. */}
        <div className={cn('mt-auto pt-2', inactive && 'opacity-55')}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-border/40 bg-muted/20 px-1.5 py-1 text-xs font-semibold tabular-nums">
            <span className="inline-flex items-center gap-[3px] whitespace-nowrap" title={t('admin.tariffs.devices')}>
              <Smartphone className="size-3 text-muted-foreground" />
              {tariff.device_limit}
            </span>
            <span className="inline-flex items-center gap-[3px] whitespace-nowrap" title={t('admin.tariffs.squadsShort')}>
              <Server className="size-3 text-muted-foreground" />
              {squadCount > 0 ? squadCount : '∞'}
            </span>
            <span className="inline-flex items-center gap-[3px] whitespace-nowrap" title={trafficTitle(tariff, t)}>
              <TrafficIcon packs={tariff.traffic_packs ?? 0} className="size-3 text-muted-foreground" />
              <TrafficValue tariff={tariff} withUnit={false} />
            </span>
          </div>
          <TilePrice prices={tariff.prices} locale={locale} />
        </div>
      </div>
    </Card>
  )
}

function TariffCard({
  tariff,
  onEdit,
  locale,
  position,
  dragging,
  onHandleDown,
  onHandleKey,
}: {
  tariff: AdminTariff
  onEdit: () => void
  locale: string
  /** Позиция в отсортированном списке — она задаёт цвет карточки. */
  position: number
  dragging: boolean
  onHandleDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  onHandleKey: (dir: -1 | 1) => void
}) {
  const { t } = useTranslation()
  const update = useAdminTariffUpdate()
  const del = useAdminTariffDelete()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const squadCount = tariff.active_internal_squad_uuids
    ? tariff.active_internal_squad_uuids.split(',').filter(Boolean).length
    : 0

  const title = tariff.name?.trim() || tariff.slug
  const accent = tariffTierAccent(position)
  const inactive = !tariff.is_active

  return (
    <Card
      className={cn(
        'cabinet-elevated-card relative flex h-full w-full flex-col overflow-hidden transition-shadow hover:shadow-md',
        inactive && 'bg-muted/30',
        dragging && 'border-primary/60 shadow-2xl shadow-black/40',
      )}
    >
      {/* Полоса уровня: идентичность тарифа, не статус (статус — бейдж справа). */}
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1', accent.bar, inactive && 'opacity-30')}
      />

      <div className="flex flex-1 flex-col p-5 pl-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <GripHandle
              dragging={dragging}
              onHandleDown={onHandleDown}
              onHandleKey={onHandleKey}
              className="-ml-2 h-9 w-6 text-muted-foreground hover:bg-muted hover:text-foreground"
              iconClassName="size-5"
            />
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                accent.iconBox,
                inactive && 'opacity-60',
              )}
            >
              <Zap className={cn('size-4', accent.iconColor)} />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  'break-words text-base font-semibold leading-snug',
                  inactive && 'text-muted-foreground',
                )}
              >
                {title}
              </h3>
              {/* slug и порядок витрины — рабочие идентификаторы, раньше их было не видно. */}
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/70">
                {tariff.slug} · #{tariff.sort_order}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
                    tariff.is_active
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {tariff.is_active ? t('admin.tariffs.active') : t('admin.promos.inactive')}
                </span>
                {tariff.tier_level != null && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
                      accent.badge,
                    )}
                  >
                    {t('admin.tariffs.tierLevel')} {tariff.tier_level}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 self-start">
            <AdminToggleSwitch
              checked={tariff.is_active}
              onChange={(next) => update.mutate({ id: tariff.id, fields: { is_active: next } })}
              busy={update.isPending}
              aria-label={t('admin.tariffs.toggleActive')}
            />
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              title={t('admin.edit')}
            >
              <Pencil className="size-4" />
            </button>
            {/* Удаление приглушено до наведения: необратимое действие не должно весить столько же, сколько «изменить». */}
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-lg p-2 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
              title={t('admin.delete')}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        <AdminConfirmModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => {
            del.mutate(tariff.id, { onSuccess: () => setDeleteOpen(false) })
          }}
          title={t('admin.tariffs.deleteTariff')}
          message={t('admin.tariffs.confirmDelete', { name: title })}
          confirmLabel={t('admin.delete')}
          variant="destructive"
          loading={del.isPending}
          icon={Trash2}
          iconAccent="rose"
        />

        {tariff.description?.trim() && (
          <div className="mt-4 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
            <TariffDescription text={tariff.description} className="text-sm text-muted-foreground" />
          </div>
        )}

        {/*
         * mt-auto прижимает лимиты и цены к низу карточки: описания у тарифов
         * разной длины, и без этого данные вставали на разной высоте в соседних
         * колонках — именно отсюда бралась асимметрия сетки.
         */}
        <div className="mt-auto space-y-2.5 pt-4">
          <div className="flex flex-wrap gap-1.5">
            <LimitChip
              icon={<Smartphone className="size-3.5 shrink-0 text-muted-foreground" />}
              value={String(tariff.device_limit)}
              label={t('admin.tariffs.devices')}
            />
            <LimitChip
              icon={<TrafficIcon packs={tariff.traffic_packs ?? 0} className="size-3.5 text-muted-foreground" />}
              value={<TrafficValue tariff={tariff} withUnit />}
              label={trafficTitle(tariff, t)}
            />
            <LimitChip
              icon={<Server className="size-3.5 shrink-0 text-muted-foreground" />}
              value={squadCount > 0 ? String(squadCount) : t('admin.tariffs.unlimited')}
              label={t('admin.tariffs.squadsShort')}
            />
          </div>

          <TariffPrices prices={tariff.prices} locale={locale} />
        </div>
      </div>
    </Card>
  )
}

export default function AdminTariffsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU'
  const { data: tariffs, isLoading } = useAdminTariffList()
  const create = useAdminTariffCreate()
  const update = useAdminTariffUpdate()
  const applySquadsMutation = useAdminTariffSquadsApply()
  const { feedback, clear, showSuccess, showError } = useAdminMutationFeedback()
  const queryClient = useQueryClient()

  // Порядок карточек = порядок у пользователей. Пока тянем и пока порядок сохраняется,
  // показываем локальную копию, а не ответ сервера.
  const [order, setOrder] = useState<AdminTariff[] | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const list = order ?? tariffs ?? []
  const listRef = useRef(list)
  listRef.current = list
  const gridRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<number, HTMLDivElement>())
  // Где карточка стояла в прошлый раз (offset не зависит от transform): по разнице играем анимацию переезда.
  const prevPos = useRef(new Map<number, { top: number; left: number }>())
  const pointer = useRef({ x: 0, y: 0 })
  // Когда отпустили перетаскиваемую плитку: «клик» после броска не должен открывать редактор.
  const dragEndedAt = useRef(0)
  const [view, setView] = useState<TariffsView>(readView)
  const isDesktop = useIsDesktop()
  const changeView = (next: TariffsView) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Хранилище недоступно (приватный режим) — вид просто не запомнится.
    }
  }
  // Смещение точки захвата относительно левого верхнего угла карточки.
  const grab = useRef({ x: 0, y: 0 })

  /** sort_order и tier_level всегда равны позиции в списке (см. formToCreateInput в редакторе). */
  const reindex = (items: AdminTariff[]) => items.map((item, i) => ({ ...item, sort_order: i, tier_level: i }))

  function placeDragged() {
    const el = dragId != null ? itemRefs.current.get(dragId) : undefined
    const grid = gridRef.current
    if (!el || !grid) return
    const rect = grid.getBoundingClientRect()
    const dx = pointer.current.x - grab.current.x - (rect.left + el.offsetLeft)
    const dy = pointer.current.y - grab.current.y - (rect.top + el.offsetTop)
    el.style.transition = 'none'
    el.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`
  }

  async function persist(next: AdminTariff[]) {
    const normalized = reindex(next)
    const changed = normalized.filter((item) => {
      const old = tariffs?.find((x) => x.id === item.id)
      return !old || old.sort_order !== item.sort_order || old.tier_level !== item.tier_level
    })
    if (changed.length === 0) {
      setOrder(null)
      return
    }
    setOrder(normalized)
    try {
      await Promise.all(
        changed.map((item) =>
          update.mutateAsync({ id: item.id, fields: { sort_order: item.sort_order, tier_level: item.tier_level } }),
        ),
      )
      await queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] })
      showSuccess(t('admin.tariffs.orderSaved'))
    } catch (err) {
      showError(err)
    } finally {
      setOrder(null)
    }
  }

  function moveByKey(id: number, dir: -1 | 1) {
    const items = listRef.current
    const from = items.findIndex((x) => x.id === id)
    const to = from + dir
    if (from < 0 || to < 0 || to >= items.length) return
    const copy = [...items]
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    void persist(copy)
  }

  function startDrag(e: React.PointerEvent<HTMLButtonElement>, id: number) {
    if (e.button !== 0) return
    e.preventDefault()
    const el = itemRefs.current.get(id)
    const box = el?.getBoundingClientRect()
    pointer.current = { x: e.clientX, y: e.clientY }
    grab.current = box ? { x: e.clientX - box.left, y: e.clientY - box.top } : { x: 0, y: 0 }
    setOrder(reindex(listRef.current))
    setDragId(id)
  }

  // Пока тянем, слушаем указатель на всём окне: React переставляет узлы, и захват на ручке мог бы потеряться.
  useEffect(() => {
    if (dragId == null) return
    function onMove(e: PointerEvent) {
      pointer.current = { x: e.clientX, y: e.clientY }
      placeDragged()
      const grid = gridRef.current
      if (!grid) return
      const rect = grid.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const items = listRef.current
      const from = items.findIndex((x) => x.id === dragId)
      const to = items.findIndex((x) => {
        if (x.id === dragId) return false
        const el = itemRefs.current.get(x.id)
        return (
          !!el &&
          px >= el.offsetLeft &&
          px <= el.offsetLeft + el.offsetWidth &&
          py >= el.offsetTop &&
          py <= el.offsetTop + el.offsetHeight
        )
      })
      if (from < 0 || to < 0 || to === from) return
      const copy = [...items]
      const [item] = copy.splice(from, 1)
      copy.splice(to, 0, item)
      setOrder(reindex(copy))
    }
    function onUp() {
      const el = dragId != null ? itemRefs.current.get(dragId) : undefined
      if (el) {
        // Карточка плавно садится на своё место.
        el.style.transition = 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        el.style.transform = ''
      }
      dragEndedAt.current = performance.now()
      setDragId(null)
      void persist(listRef.current)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    const prevCursor = document.body.style.cursor
    document.body.style.cursor = 'grabbing'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = prevCursor
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId])

  // Анимация переезда: после смены порядка соседи «отъезжают» от старого места к новому.
  useLayoutEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    itemRefs.current.forEach((el, id) => {
      const top = el.offsetTop
      const left = el.offsetLeft
      const prev = prevPos.current.get(id)
      if (!reduce && prev && (prev.top !== top || prev.left !== left) && id !== dragId) {
        el.style.transition = 'none'
        el.style.transform = `translate(${prev.left - left}px, ${prev.top - top}px)`
        void el.getBoundingClientRect()
        el.style.transition = 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        el.style.transform = ''
      }
      prevPos.current.set(id, { top, left })
    })
    placeDragged()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, dragId])

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTariff, setEditingTariff] = useState<AdminTariff | null>(null)

  const breadcrumbTail = editorOpen
    ? (editingTariff
      ? t('admin.breadcrumb.tariffEdit', { name: editingTariff.name ?? editingTariff.slug })
      : t('admin.breadcrumb.tariffCreate'))
    : undefined

  const openCreate = () => { setEditingTariff(null); setEditorOpen(true) }
  const openEdit = (tariff: AdminTariff) => { setEditingTariff(tariff); setEditorOpen(true) }
  const [extraSaving, setExtraSaving] = useState(false)
  const closeEditor = () => { setEditorOpen(false); setEditingTariff(null) }

  const handleSave = (
    data: CreateTariffInput | Record<string, unknown>,
    isEdit: boolean,
    applySquads?: { add: string[]; remove: string[] } | null,
    after?: () => Promise<unknown>,
  ) => {
    const savedMsg = t('admin.feedback.saved')
    if (isEdit && editingTariff) {
      const tariffId = editingTariff.id
      update.mutate(
        { id: tariffId, fields: data as Record<string, unknown> },
        {
          onSuccess: () => {
            const finish = () => {
              showSuccess(savedMsg)
              closeEditor()
              // Применяем только после успешного сохранения: иначе в панель уехал
              // бы состав, которого в тарифе нет.
              if (applySquads && (applySquads.add.length > 0 || applySquads.remove.length > 0)) {
                applySquadsMutation.mutate(
                  { id: tariffId, add: applySquads.add, remove: applySquads.remove },
                  {
                    onSuccess: (run) =>
                      showSuccess(t('admin.tariffs.squadsApply.started', { count: run.total })),
                    onError: showError,
                  },
                )
              }
            }
            if (!after) {
              finish()
              return
            }
            // Вкладка «Трафик» сохраняется следом; её ошибку показывает сама вкладка, окно остаётся открытым.
            setExtraSaving(true)
            after()
              .then(finish)
              .catch(() => {})
              .finally(() => setExtraSaving(false))
          },
          onError: showError,
        },
      )
    } else {
      // Новый тариф встаёт в конец списка; дальше его можно перетащить.
      const next = list.reduce((max, item) => Math.max(max, item.sort_order + 1), 0)
      create.mutate({ ...(data as CreateTariffInput), sort_order: next, tier_level: next }, {
        onSuccess: () => {
          showSuccess(savedMsg)
          closeEditor()
        },
        onError: showError,
      })
    }
  }

  return (
    <AdminLayout meta={{ breadcrumbTail }}>
      <AdminFeedback feedback={feedback} onDismiss={clear} />
      <div className="space-y-6">
        <AdminPageHeader
          icon={Zap}
          title={t('admin.tariffs.title')}
          subtitle={t('admin.tariffs.subtitle')}
          accent="emerald"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border/60 bg-muted/20 p-0.5 md:hidden">
                {(['list', 'grid'] as const).map((v) => {
                  const Icon = v === 'list' ? Rows2 : LayoutGrid
                  const label = t(v === 'list' ? 'admin.tariffs.viewList' : 'admin.tariffs.viewGrid')
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={view === v}
                      aria-label={label}
                      title={label}
                      onClick={() => changeView(v)}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-md transition-colors',
                        view === v ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-4" />
                {t('admin.tariffs.create')}
              </button>
            </div>
          }
        />

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">{t('admin.loading')}</div>
        ) : !tariffs || tariffs.length === 0 ? (
          <Card className="border-dashed p-12 text-center">
            <Zap className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('admin.tariffs.empty')}</p>
            <button type="button" onClick={openCreate} className="mt-4 text-sm text-primary hover:underline">
              {t('admin.tariffs.createFirst')}
            </button>
          </Card>
        ) : (
          <>
          <div
            ref={gridRef}
            className={cn(
              'relative grid items-stretch',
              isDesktop
                ? 'grid-cols-2 gap-4'
                : view === 'grid'
                  ? 'grid-cols-2 gap-2 sm:gap-3'
                  : 'gap-4',
              dragId != null && 'select-none',
            )}
          >
            {list.map((tariff, index) => (
              <div
                key={tariff.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(tariff.id, el)
                  else itemRefs.current.delete(tariff.id)
                }}
                className={cn('flex', dragId === tariff.id && 'relative z-20')}
              >
                {(() => {
                  const Item = isDesktop ? TariffShowcase : view === 'grid' ? TariffTile : TariffCard
                  return (
                    <Item
                      tariff={tariff}
                      locale={locale}
                      position={index}
                      dragging={dragId === tariff.id}
                      onHandleDown={(e) => startDrag(e, tariff.id)}
                      onHandleKey={(dir) => moveByKey(tariff.id, dir)}
                      onEdit={() => {
                        if (performance.now() - dragEndedAt.current < 400) return
                        openEdit(tariff)
                      }}
                    />
                  )
                })()}
              </div>
            ))}
          </div>
          </>
        )}

        {/* Настройки продукта — прайс доп. устройств, триал, курс звёзд — рядом с прайсом тарифов. */}
        <AdminProductSettingsPanel />
      </div>

      <AdminTariffEditor
        open={editorOpen}
        onClose={closeEditor}
        tariff={editingTariff}
        onSave={handleSave}
        saving={create.isPending || update.isPending || extraSaving}
      />
    </AdminLayout>
  )
}
