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

/** Пара «подпись — значение» в одну строку, как в макете. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="text-xs text-muted-foreground">
      {label} <b className="font-semibold text-foreground/85 tabular-nums">{children}</b>
    </span>
  )
}

/**
 * Системная строка: то, что читают, а не правят.
 *
 * Одна строка вместо сетки подписей: регистрация, тег панели и XP — справка,
 * которой достаточно беглого взгляда. Единственное редактируемое поле,
 * описание, прижато к правому краю и отделено от справки.
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

  return (
    <Card className="cabinet-elevated-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Fact label={t('admin.users.overview.registeredShort')}>
          {formatAdminDateTime(user.created_at, dateLocale)}
        </Fact>
        {rw?.tag && <Fact label={t('admin.users.subscription.tag')}>{rw.tag}</Fact>}
        <Fact label={t('admin.users.overview.statXp')}>
          {loyaltyDiscount == null
            ? user.loyalty_xp
            : t('admin.users.overview.xpWithDiscount', {
                xp: user.loyalty_xp,
                discount: loyaltyDiscount,
              })}
        </Fact>
        {expireMismatch && dbExpire && (
          <Fact label={t('admin.users.expireDb')}>{formatAdminDateTime(dbExpire, dateLocale)}</Fact>
        )}

        {hasRwUser && (
          <button
            type="button"
            onClick={() => onOpenModal('description')}
            title={t('admin.users.overview.clickToEdit')}
            className={cn(
              'group admin-overview-clickable flex w-full min-w-0 items-center gap-2 rounded-btn border border-transparent px-2 py-1.5 text-left text-xs',
              'hover:border-border hover:bg-accent/40 sm:ms-auto sm:w-auto sm:max-w-[280px]',
            )}
          >
            <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">
                {t('admin.users.subscription.description')}:{' '}
              </span>
              <span className={cn(!description && 'text-muted-foreground')}>
                {description || t('admin.users.overview.descriptionEmpty')}
              </span>
            </span>
            <Pencil
              className="size-3.5 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary"
              aria-hidden
            />
          </button>
        )}
      </div>
    </Card>
  )
}
