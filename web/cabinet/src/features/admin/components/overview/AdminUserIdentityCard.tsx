import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import type { AdminCustomerDTO } from '@/lib/types/admin'
import { accountStatusBadgeClasses } from '../../utils/accountStatus'
import type { UnifiedAccountStatus } from '../../utils/accountStatus'
import { formatAdminDateTime } from '../../utils/datetime'
import { AdminUserAvatar } from './AdminUserAvatar'

interface Props {
  user: AdminCustomerDTO
  displayName: string
  status: UnifiedAccountStatus
  /** Бейдж тарифа: кликабельный, когда режим продаж это позволяет. */
  tariffBadge?: ReactNode
  hasRwUser: boolean
  /** Итог по платежам — та же цифра, что в карточке «Платежи» ниже. */
  payments?: { rubSum: number; count: number } | null
  dateLocale: string
}

/**
 * Колонка личности: кто этот человек и в каком он состоянии.
 *
 * Отделена от данных подписки намеренно: на широком экране колонка липнет к
 * верху и не уезжает, пока админ листает платежи, — «на кого я смотрю»
 * остаётся перед глазами.
 */
export function AdminUserIdentityCard({
  user,
  displayName,
  status,
  tariffBadge,
  hasRwUser,
  payments,
  dateLocale,
}: Props) {
  const { t } = useTranslation()

  return (
    <Card className="cabinet-elevated-card p-4">
      <div className="flex items-center gap-3">
        <AdminUserAvatar url={user.avatar_url} name={displayName} tone={status.tone} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight">{displayName}</h1>
          <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
            {t('admin.users.overview.idLine', {
              id: user.telegram_id,
              lang: user.language.toUpperCase(),
            })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={accountStatusBadgeClasses(status.tone)}>{t(status.labelKey)}</span>
        {tariffBadge}
      </div>

      {!hasRwUser && (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {t('admin.users.subscription.noRwUser')}
        </p>
      )}

      <dl className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{t('admin.users.overview.customerSince')}</dt>
          <dd className="tabular-nums">{formatAdminDateTime(user.created_at, dateLocale)}</dd>
        </div>
        {payments && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('admin.users.overview.paidTotal')}</dt>
            <dd className={cn('tabular-nums', payments.count === 0 && 'text-muted-foreground')}>
              {t('admin.users.overview.paidTotalValue', {
                sum: formatNumber(payments.rubSum),
                count: payments.count,
              })}
            </dd>
          </div>
        )}
      </dl>
    </Card>
  )
}
