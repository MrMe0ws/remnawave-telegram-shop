import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight,
  ChevronRight,
  Edit,
  Gem,
  Layers,
  Lock,
  Percent,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'

import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminSectionCard } from '../components/AdminSectionCard'
import { AdminConfirmModal } from '../components/AdminConfirmModal'
import { useAdminToast } from '../hooks/useAdminToast'
import {
  useAdminLoyaltyTiers,
  useAdminLoyaltyCreateTier,
  useAdminLoyaltyUpdateTier,
  useAdminLoyaltyDeleteTier,
  useAdminLoyaltyRecalc,
  type AdminLoyaltyTier,
} from '../hooks/useAdminLoyalty'
import { useAdminLoyaltyStats } from '../hooks/useAdminLoyaltyStats'
import { LoyaltyTierModal, type LoyaltyTierFormValues } from '../loyalty/LoyaltyTierModal'
import { LoyaltyHowCard, LoyaltyProgramCard, LoyaltyRecalcCard } from '../loyalty/LoyaltySidePanels'
import {
  isBaseTier,
  loyaltyTierTone,
  sortTiersByXp,
  tierTrack,
  type LoyaltyTierTone,
} from '../loyalty/loyaltyTiers'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

/** Всё, что строка уровня показывает, посчитано один раз на список. */
interface TierRowModel {
  tier: AdminLoyaltyTier
  tone: LoyaltyTierTone
  next: AdminLoyaltyTier | null
  track: { left: number; width: number }
  /** undefined — счётчиков нет (программа выключена или статистика не пришла). */
  users?: number
  share?: number
}

function LevelBadge({ tone, n, className }: { tone: LoyaltyTierTone; n: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold tabular-nums',
        tone.bg,
        tone.text,
        className,
      )}
    >
      {n}
    </span>
  )
}

function DiscountPill({ tone, pct }: { tone: LoyaltyTierTone; pct: number }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', tone.bg, tone.text)}>
      {pct}%
    </span>
  )
}

function Track({ tone, track, className }: { tone: LoyaltyTierTone; track: TierRowModel['track']; className?: string }) {
  return (
    <div className={cn('relative h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('absolute inset-y-0 rounded-full', tone.bar)}
        style={{ left: `${track.left}%`, width: `${track.width}%` }}
      />
    </div>
  )
}

function NextStep({ row, fmt, short }: { row: TierRowModel; fmt: (n: number) => string; short?: boolean }) {
  const { t } = useTranslation()
  if (!row.next) {
    return (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {t(short ? 'admin.loyalty.maxLevelShort' : 'admin.loyalty.maxLevel')}
      </span>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
        +{fmt(row.next.xp_min - row.tier.xp_min)} XP
      </span>
      <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
        +{row.next.discount_percent - row.tier.discount_percent}%
      </span>
    </span>
  )
}

function TierActions({ row, onEdit, onDelete }: { row: TierRowModel; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="inline-flex gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        aria-label={t('admin.edit')}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Edit className="size-4" />
      </button>
      {isBaseTier(row.tier) ? (
        <span
          title={t('admin.loyalty.cannotDeleteBase')}
          aria-label={t('admin.loyalty.cannotDeleteBase')}
          className="inline-flex p-1.5 text-muted-foreground/50"
        >
          <Lock className="size-4" />
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={t('admin.delete')}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}

function rangeLabel(row: TierRowModel, fmt: (n: number) => string): string {
  return row.next ? `${fmt(row.tier.xp_min)} – ${fmt(row.next.xp_min - 1)}` : `${fmt(row.tier.xp_min)} +`
}

/**
 * Уровень на телефоне: карточка с теми же данными, что строка таблицы.
 * Вся карточка открывает редактирование, удаление — отдельной кнопкой.
 */
function TierMobileCard({
  row,
  fmt,
  onEdit,
  onDelete,
}: {
  row: TierRowModel
  fmt: (n: number) => string
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const base = isBaseTier(row.tier)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit()
        }
      }}
      className="cursor-pointer px-4 py-3 transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none active:bg-primary/10"
    >
      <div className="flex items-center gap-2.5">
        <LevelBadge tone={row.tone} n={row.tier.sort_order} />
        <span className="text-sm font-semibold">{t('admin.loyalty.levelN', { n: row.tier.sort_order })}</span>
        <DiscountPill tone={row.tone} pct={row.tier.discount_percent} />
        <div className="ml-auto flex items-center">
          {base ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Lock className="size-3" />
              {t('admin.loyalty.base')}
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label={t('admin.delete')}
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <ChevronRight className="ml-1 size-4 shrink-0 text-muted-foreground" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold tabular-nums">{rangeLabel(row, fmt)} XP</span>
        {row.users != null && (
          <span className="tabular-nums">
            <span className="font-semibold">{fmt(row.users)}</span>{' '}
            <span className="text-muted-foreground">
              {t('admin.loyalty.peopleShort')} · {row.share}%
            </span>
          </span>
        )}
      </div>
      <Track tone={row.tone} track={row.track} className="mt-2" />
      <div className="mt-2 flex items-center gap-2">
        {row.next && <span className="text-xs text-muted-foreground">{t('admin.loyalty.colNext')}</span>}
        <NextStep row={row} fmt={fmt} />
      </div>
    </div>
  )
}

export default function AdminLoyaltyPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { data: tiers, isLoading } = useAdminLoyaltyTiers()
  const { data: stats } = useAdminLoyaltyStats()
  const createMut = useAdminLoyaltyCreateTier()
  const updateMut = useAdminLoyaltyUpdateTier()
  const deleteMut = useAdminLoyaltyDeleteTier()
  const recalcMut = useAdminLoyaltyRecalc()
  // Раньше отказ сервера тут нигде не показывался: форма просто не закрывалась, удаление «не срабатывало».
  const { showError, showSuccess } = useAdminToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editTier, setEditTier] = useState<AdminLoyaltyTier | null>(null)
  const [recalcOpen, setRecalcOpen] = useState(false)
  const [deleteTier, setDeleteTier] = useState<AdminLoyaltyTier | null>(null)

  const numberLocale = i18n.language?.startsWith('ru') ? 'ru-RU' : 'en-US'
  const fmt = (n: number) => n.toLocaleString(numberLocale)

  const sorted = useMemo(() => sortTiersByXp(tiers ?? []), [tiers])

  // Счётчики по уровням бэк отдаёт только при включённой программе.
  const userCounts = useMemo(() => {
    if (!stats?.enabled || !stats.tiers.length) return undefined
    return new Map(stats.tiers.map((s) => [s.sort_order, s.user_count]))
  }, [stats])
  const totalUsers = userCounts ? [...userCounts.values()].reduce((a, b) => a + b, 0) : undefined

  const rows: TierRowModel[] = useMemo(
    () =>
      sorted.map((tier, i) => {
        const users = userCounts?.get(tier.sort_order)
        return {
          tier,
          tone: loyaltyTierTone(i, sorted.length),
          next: sorted[i + 1] ?? null,
          track: tierTrack(sorted, i),
          users,
          share: users == null ? undefined : totalUsers ? Math.round((users * 100) / totalUsers) : 0,
        }
      }),
    [sorted, userCounts, totalUsers],
  )

  // Мутации уровней инвалидируют только список уровней; счётчики клиентов
  // зависят от порогов, поэтому после правки освежаем и их.
  function refreshStats() {
    void queryClient.invalidateQueries({ queryKey: ['admin-loyalty-stats'] })
  }

  function openCreate() {
    setEditTier(null)
    setFormOpen(true)
  }

  function openEdit(tier: AdminLoyaltyTier) {
    setEditTier(tier)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
  }

  function handleSubmit(values: LoyaltyTierFormValues) {
    const onSuccess = () => {
      closeForm()
      refreshStats()
      showSuccess(t('admin.feedback.saved'))
    }
    if (editTier) {
      updateMut.mutate(
        { id: editTier.id, fields: { sort_order: editTier.sort_order, ...values } },
        { onSuccess, onError: showError },
      )
    } else {
      createMut.mutate(values, { onSuccess, onError: showError })
    }
  }

  function handleRecalcConfirm() {
    recalcMut.mutate(undefined, {
      onSuccess: () => {
        setRecalcOpen(false)
        refreshStats()
        showSuccess(t('admin.loyalty.recalcStarted'))
      },
      onError: (e) => {
        setRecalcOpen(false)
        showError(e)
      },
    })
  }

  const levelsCard = (
    <AdminSectionCard
      title={t('admin.loyalty.tiers')}
      icon={Layers}
      iconAccent="rose"
      flushHeader
      headerRightInline
      headerRight={
        totalUsers != null ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t('admin.loyalty.clientsTotal', { value: fmt(totalUsers) })}
          </span>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !rows.length ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('admin.noData')}</p>
      ) : (
        // Строки во всю ширину карточки: тело карточки со своими отступами, а ховер строки должен доходить до краёв.
        <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5">
          <div className="admin-stagger divide-y divide-border/40 border-t border-border/50 md:hidden">
            {rows.map((row) => (
              <TierMobileCard
                key={row.tier.id}
                row={row}
                fmt={fmt}
                onEdit={() => openEdit(row.tier)}
                onDelete={() => setDeleteTier(row.tier)}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border/50 text-muted-foreground">
                  <th className="whitespace-nowrap px-2.5 py-2 xl:px-3 text-left font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Gem className="size-3.5" />
                      {t('admin.loyalty.colLevel')}
                    </span>
                  </th>
                  <th className="whitespace-nowrap px-2.5 py-2 xl:px-3 text-left font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="size-3.5" />
                      {t('admin.loyalty.colRange')}
                    </span>
                  </th>
                  <th className="whitespace-nowrap px-2.5 py-2 xl:px-3 text-left font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Percent className="size-3.5" />
                      {t('admin.loyalty.colDiscount')}
                    </span>
                  </th>
                  <th className="whitespace-nowrap px-2.5 py-2 xl:px-3 text-left font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {t('admin.loyalty.colClients')}
                    </span>
                  </th>
                  <th className="whitespace-nowrap px-2.5 py-2 xl:px-3 text-left font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <ArrowUpRight className="size-3.5" />
                      {t('admin.loyalty.colNext')}
                    </span>
                  </th>
                  <th className="px-2.5 py-2 xl:px-3" />
                </tr>
              </thead>
              <tbody className="admin-stagger">
                {rows.map((row) => (
                  <tr
                    key={row.tier.id}
                    onClick={() => openEdit(row.tier)}
                    className="cursor-pointer border-b border-border/30 transition-colors last:border-b-0 hover:bg-primary/5"
                  >
                    <td className="px-2.5 py-2.5 xl:px-3">
                      <div className="flex items-center gap-2.5">
                        <LevelBadge tone={row.tone} n={row.tier.sort_order} />
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-medium">
                            {t('admin.loyalty.levelN', { n: row.tier.sort_order })}
                          </p>
                          {isBaseTier(row.tier) && (
                            <p className="text-xs text-muted-foreground">{t('admin.loyalty.base')}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 xl:px-3">
                      <p className="whitespace-nowrap font-medium tabular-nums">{rangeLabel(row, fmt)}</p>
                      <Track tone={row.tone} track={row.track} className="mt-1.5 w-20 xl:w-36" />
                    </td>
                    <td className="px-2.5 py-2.5 xl:px-3">
                      <DiscountPill tone={row.tone} pct={row.tier.discount_percent} />
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 xl:px-3 tabular-nums">
                      {row.users != null ? (
                        <>
                          <span className="font-semibold">{fmt(row.users)}</span>{' '}
                          <span className="text-muted-foreground">{row.share}%</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2.5 xl:px-3">
                      <NextStep row={row} fmt={fmt} short />
                    </td>
                    <td className="px-2.5 py-2.5 xl:px-3 text-right">
                      <TierActions
                        row={row}
                        onEdit={() => openEdit(row.tier)}
                        onDelete={() => setDeleteTier(row.tier)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminSectionCard>
  )

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          icon={Gem}
          title={t('admin.loyalty.title')}
          subtitle={t('admin.loyalty.subtitle')}
          accent="rose"
          actionsEnd
          actions={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-4" />
              {/* На телефоне кнопка стоит справа от заголовка, полная подпись туда не влезает. */}
              <span className="sm:hidden">{t('admin.loyalty.addTierShort')}</span>
              <span className="hidden sm:inline">{t('admin.loyalty.addTier')}</span>
            </button>
          }
        />

        {/*
         * От 1680px — таблица слева и панель программы справа. На экране уже
         * панель распадается: «Программа» встаёт над уровнями (включена ли —
         * первое, что надо видеть), справка и пересчёт уходят под них.
         */}
        <div className="grid grid-cols-1 gap-4 min-[1680px]:grid-cols-[minmax(0,1fr)_360px] min-[1680px]:items-start">
          <div className="order-2 min-w-0 min-[1680px]:order-1">{levelsCard}</div>
          <div className="contents min-[1680px]:order-2 min-[1680px]:block min-[1680px]:space-y-4">
            <div className="order-1">
              <LoyaltyProgramCard onSaved={() => showSuccess(t('admin.settings.saved'))} onError={showError} />
            </div>
            <div className="order-3">
              <LoyaltyHowCard />
            </div>
            <div className="order-4">
              <LoyaltyRecalcCard
                pending={recalcMut.isPending}
                onRecalc={() => setRecalcOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <LoyaltyTierModal
        open={formOpen}
        onClose={closeForm}
        editing={editTier}
        sorted={sorted}
        userCounts={userCounts}
        saving={createMut.isPending || updateMut.isPending}
        onSubmit={handleSubmit}
      />

      <AdminConfirmModal
        open={recalcOpen}
        onClose={() => setRecalcOpen(false)}
        onConfirm={handleRecalcConfirm}
        title={t('admin.loyalty.recalc')}
        message={t('admin.loyalty.recalcConfirm')}
        confirmLabel={t('admin.loyalty.recalc')}
        loading={recalcMut.isPending}
        icon={RefreshCw}
        iconAccent="rose"
      />

      <AdminConfirmModal
        open={deleteTier != null}
        onClose={() => setDeleteTier(null)}
        onConfirm={() => {
          if (!deleteTier) return
          deleteMut.mutate(deleteTier.id, {
            onSuccess: () => {
              setDeleteTier(null)
              refreshStats()
              showSuccess(t('admin.feedback.saved'))
            },
            onError: (e) => {
              setDeleteTier(null)
              showError(e)
            },
          })
        }}
        title={t('admin.loyalty.deleteTier')}
        message={t('admin.loyalty.confirmDeleteLevel', { n: deleteTier?.sort_order ?? '' })}
        confirmLabel={t('admin.delete')}
        variant="destructive"
        loading={deleteMut.isPending}
        icon={Trash2}
        iconAccent="rose"
      />
    </AdminLayout>
  )
}
