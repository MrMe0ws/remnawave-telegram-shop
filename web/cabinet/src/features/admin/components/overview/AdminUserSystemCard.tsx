import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Pencil } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AdminCustomerDTO, AdminUserPanelDTO } from '@/lib/types/admin'
import { formatAdminDateTime } from '../../utils/datetime'
import type { UserEditModalKey } from '../user-modals/types'

interface Props {
  user: AdminCustomerDTO
  panel?: AdminUserPanelDTO | null
  hasRwUser: boolean
  loyaltyDiscount: number | null
  dateLocale: string
  onOpenModal: (key: UserEditModalKey) => void
}

/** Пара «подпись — значение» в строку: так системная справка выглядит на ПК. */
function InlineFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="text-xs text-muted-foreground">
      {label} <b className="font-semibold tabular-nums text-foreground/85">{children}</b>
    </span>
  )
}

/** Та же пара строкой «подпись слева, значение справа» — вид для телефона. */
function RowFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  )
}

/**
 * Системная справка: то, что читают, а не правят.
 *
 * На ПК это одна строка — регистрация, тег и XP не стоят отдельной сетки. На
 * телефоне ширины на строку не хватает, поэтому там макетный вид: заголовок
 * секции, описание и пары «подпись — значение» столбиком.
 */
export function AdminUserSystemCard({
  user,
  panel,
  hasRwUser,
  loyaltyDiscount,
  dateLocale,
  onOpenModal,
}: Props) {
  const { t } = useTranslation()
  const rw = panel?.rw
  const description = rw?.description?.trim()

  const panelExpire = rw?.expire_at
  const dbExpire = user.expire_at
  const expireMismatch = Boolean(panelExpire && dbExpire && panelExpire !== dbExpire)

  const registered = formatAdminDateTime(user.created_at, dateLocale)
  const xpValue =
    loyaltyDiscount == null
      ? String(user.loyalty_xp)
      : t('admin.users.overview.xpWithDiscount', {
          xp: user.loyalty_xp,
          discount: loyaltyDiscount,
        })

  const descriptionButton = (
    <button
      type="button"
      onClick={() => onOpenModal('description')}
      title={t('admin.users.overview.clickToEdit')}
      className={cn(
        'group admin-overview-clickable flex min-w-0 items-center gap-2 rounded-btn border border-transparent px-2 py-1.5 text-left text-xs',
        'hover:border-border hover:bg-accent/40',
      )}
    >
      <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate">
        <span className="text-muted-foreground lg:inline">
          {t('admin.users.subscription.description')}:{' '}
        </span>
        <span className={cn(!description && 'text-muted-foreground')}>
          {description || t('admin.users.overview.descriptionEmpty')}
        </span>
      </span>
      <Pencil
        className="ms-auto size-3.5 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary"
        aria-hidden
      />
    </button>
  )

  return (
    <Card className="cabinet-elevated-card px-4 py-3">
      {/* ПК: одна строка справки, описание прижато вправо. */}
      <div className="hidden flex-wrap items-center gap-x-6 gap-y-2 lg:flex">
        <InlineFact label={t('admin.users.overview.registeredShort')}>{registered}</InlineFact>
        {rw?.tag && <InlineFact label={t('admin.users.subscription.tag')}>{rw.tag}</InlineFact>}
        <InlineFact label={t('admin.users.overview.statXp')}>{xpValue}</InlineFact>
        {expireMismatch && dbExpire && (
          <InlineFact label={t('admin.users.expireDb')}>
            {formatAdminDateTime(dbExpire, dateLocale)}
          </InlineFact>
        )}
        {hasRwUser && <div className="ms-auto min-w-0 max-w-[280px]">{descriptionButton}</div>}
      </div>

      {/* Телефон: заголовок секции, описание и пары столбиком — как в макете. */}
      <div className="lg:hidden">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75">
          {t('admin.users.overview.sectionSystem')}
        </h2>
        {hasRwUser && <div className="-mx-2 mb-2">{descriptionButton}</div>}
        <div className="flex flex-col gap-1.5">
          <RowFact label={t('admin.users.overview.registeredShort')}>{registered}</RowFact>
          {rw?.tag && <RowFact label={t('admin.users.subscription.tag')}>{rw.tag}</RowFact>}
          <RowFact label={t('admin.users.overview.statXp')}>{xpValue}</RowFact>
          {expireMismatch && dbExpire && (
            <RowFact label={t('admin.users.expireDb')}>
              {formatAdminDateTime(dbExpire, dateLocale)}
            </RowFact>
          )}
        </div>
      </div>
    </Card>
  )
}
