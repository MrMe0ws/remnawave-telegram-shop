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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * Системная полоса: то, что читают, а не правят, — регистрация, тег панели, XP.
 * Единственное редактируемое поле здесь — описание, и оно вынесено в
 * отдельную строку, чтобы не превращать справку в форму.
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
    <Card className="cabinet-elevated-card p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75">
        {t('admin.users.overview.sectionSystem')}
      </h2>

      {hasRwUser && (
        <button
          type="button"
          onClick={() => onOpenModal('description')}
          title={t('admin.users.overview.clickToEdit')}
          className={cn(
            // Ширина по содержимому: карандаш должен стоять сразу за текстом,
            // а не у дальнего края карточки — иначе он снова ничей.
            'group admin-overview-clickable mb-3 flex w-fit max-w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm',
            'hover:border-border hover:bg-accent/40',
          )}
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground">{t('admin.users.subscription.description')}: </span>
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

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact
          label={t('admin.users.createdAt')}
          value={formatAdminDateTime(user.created_at, dateLocale)}
        />
        {rw?.tag && <Fact label={t('admin.users.subscription.tag')} value={rw.tag} />}
        <Fact
          label={t('admin.users.overview.statXp')}
          value={
            loyaltyDiscount == null
              ? String(user.loyalty_xp)
              : t('admin.users.overview.xpWithDiscount', {
                  xp: user.loyalty_xp,
                  discount: loyaltyDiscount,
                })
          }
        />
        {expireMismatch && dbExpire && (
          <Fact
            label={t('admin.users.expireDb')}
            value={formatAdminDateTime(dbExpire, dateLocale)}
          />
        )}
      </dl>
    </Card>
  )
}
