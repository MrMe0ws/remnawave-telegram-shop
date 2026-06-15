import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CalendarPlus,
  PowerOff,
  Trash2,
  CreditCard,
  Users,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'

import { AdminLayout } from '../layout/AdminLayout'
import { useAdminPageMeta } from '../layout/useAdminPageMeta'
import { AdminSectionCard } from '../components/AdminSectionCard'
import { AdminUserOverview } from '../components/AdminUserOverview'
import { AdminUserOverviewActions } from '../components/overview/AdminUserOverviewActions'
import { AdminSetExpireModal } from '../components/AdminSetExpireModal'
import { AdminFeedback } from '../components/AdminFeedback'
import { AdminUserEditModals } from '../components/user-modals/AdminUserEditModals'
import { AdminUserActionsModal } from '../components/user-modals/AdminUserActionsModal'
import type { UserEditModalKey } from '../components/user-modals/types'
import { useAdminMutationFeedback } from '../hooks/useAdminMutationFeedback'
import { formatAdminApiError } from '../utils/formatAdminApiError'
import { formatInvoiceType } from '../utils/formatInvoiceType'
import { formatPaymentAmount } from '../utils/formatPaymentAmount'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  useAdminUser,
  useAdminUserPanel,
  useAdminUserPayments,
  useAdminUserReferrals,
  useAdminUserSetExpire,
  useAdminUserDisable,
  useAdminUserEnable,
  useAdminUserDelete,
  type AdminPurchaseDTO,
  type AdminRefereeDTO,
} from '../hooks/useAdminUsers'

import { formatAdminDateTime } from '../utils/datetime'
import { resolveTariffLabel } from '../utils/resolveTariffLabel'
import { useAdminTariffList } from '../hooks/useAdminTariffs'
import { useAdminBootstrap } from '../hooks/useAdminBootstrap'
import type { AdminTariffBriefDTO } from '@/lib/types/admin'
import { AdminModal } from '../components/AdminModal'
import { AdminTablePagination } from '../components/AdminTablePagination'

const LIST_PAGE_LIMIT = 20

export default function AdminUserDetailPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const userId = id ? parseInt(id, 10) : null
  const { data: user, isLoading, isError } = useAdminUser(userId)
  const { data: panel, isLoading: panelLoading } = useAdminUserPanel(userId)
  const { data: allTariffs } = useAdminTariffList()
  const { data: bootstrap } = useAdminBootstrap()
  const salesModeTariffs = bootstrap?.sales_mode === 'tariffs'

  const tariffOptions = useMemo((): AdminTariffBriefDTO[] => {
    if (panel?.tariffs?.length) return panel.tariffs
    return (allTariffs ?? []).map((tariff) => ({
      id: tariff.id,
      slug: tariff.slug,
      name: tariff.name?.trim() || tariff.slug,
    }))
  }, [panel?.tariffs, allTariffs])

  const canEditTariff = salesModeTariffs && tariffOptions.length > 0

  const hasRwUser = panel?.has_rw_user ?? false
  const rwStatus = panel?.rw?.status?.toUpperCase()

  const [extendModal, setExtendModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [disableError, setDisableError] = useState<string | null>(null)
  const [actionsModal, setActionsModal] = useState(false)
  const [editModal, setEditModal] = useState<UserEditModalKey | null>(null)
  const [paymentsPage, setPaymentsPage] = useState(1)
  const [referralsPage, setReferralsPage] = useState(1)
  const [extendError, setExtendError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [overviewFeedback, setOverviewFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { feedback, clear, handlers, showSuccess } = useAdminMutationFeedback()

  const setExpireMut = useAdminUserSetExpire(userId)
  const disableMut = useAdminUserDisable(userId)
  const enableMut = useAdminUserEnable(userId)
  const deleteMut = useAdminUserDelete(userId)

  const { data: paymentsData, isLoading: paymentsLoading } = useAdminUserPayments(userId, paymentsPage, LIST_PAGE_LIMIT)
  const { data: referralsData, isLoading: referralsLoading } = useAdminUserReferrals(userId, referralsPage, LIST_PAGE_LIMIT)

  const breadcrumbTail = user
    ? (user.telegram_username ? `@${user.telegram_username}` : `#${user.id}`)
    : undefined

  const openExtendModal = () => {
    setExtendError(null)
    setExtendModal(true)
  }

  useAdminPageMeta({ breadcrumbTail })

  const paymentsTotalPages = paymentsData
    ? Math.max(1, Math.ceil(paymentsData.total / LIST_PAGE_LIMIT))
    : 1

  const referralsTotalPages = referralsData
    ? Math.max(1, Math.ceil(referralsData.stats.total / LIST_PAGE_LIMIT))
    : 1

  useEffect(() => {
    setPaymentsPage(1)
    setReferralsPage(1)
  }, [userId])

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    )
  }

  if (isError || !user) {
    return (
      <AdminLayout>
        <button onClick={() => navigate('/admin/users')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> {t('admin.users.backToList')}
        </button>
        <Card className="border-dashed p-8 text-center">
          <p className="text-muted-foreground">{t('admin.users.notFound')}</p>
        </Card>
      </AdminLayout>
    )
  }

  const displayName = user.telegram_username ? `@${user.telegram_username}` : `#${user.id}`
  const tariffId = user.current_tariff_id ?? panel?.customer?.current_tariff_id ?? null
  const tariffName = resolveTariffLabel(tariffId, panel?.tariffs, allTariffs)
  const dateLocale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'

  const handleOverviewSuccess = (message: string) => setOverviewFeedback({ type: 'success', message })
  const handleOverviewError = (message: string) => setOverviewFeedback({ type: 'error', message })

  return (
    <AdminLayout>
      <AdminFeedback feedback={feedback} onDismiss={clear} />
      {overviewFeedback && (
        <AdminFeedback
          feedback={overviewFeedback}
          onDismiss={() => setOverviewFeedback(null)}
        />
      )}
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
        <AdminUserOverview
          user={user}
          userId={userId!}
          panel={panel}
          panelLoading={panelLoading}
          tariffName={tariffName}
          canEditTariff={canEditTariff}
          onExpireSuccess={handleOverviewSuccess}
          onExpireError={handleOverviewError}
          onOpenModal={setEditModal}
          onOpenActions={() => setActionsModal(true)}
          actionsFooter={
            <AdminUserOverviewActions
              hasRwUser={hasRwUser}
              rwStatus={rwStatus}
              onExtend={openExtendModal}
              onDisable={() => setConfirmDisable(true)}
              onEnable={() => enableMut.mutate(undefined, handlers(t('admin.feedback.enableSuccess')))}
              onDelete={() => setConfirmDelete(true)}
              disablePending={disableMut.isPending}
              enablePending={enableMut.isPending}
            />
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
          <AdminSectionCard
            title={t('admin.users.payments')}
            icon={CreditCard}
            iconAccent="emerald"
            fillHeight
            className="min-w-0"
          >
            {paymentsLoading ? (
              <div className="flex flex-1 items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : paymentsData ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{t('admin.users.paymentsRub')}</p>
                    <p className="text-lg font-semibold tabular-nums">{paymentsData.rub_sum.toLocaleString('ru-RU')} ₽</p>
                    <p className="text-xs text-muted-foreground">{paymentsData.rub_count} {t('admin.users.paymentsCount')}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{t('admin.users.paymentsStars')}</p>
                    <p className="text-lg font-semibold tabular-nums">{paymentsData.stars_sum} ⭐</p>
                    <p className="text-xs text-muted-foreground">{paymentsData.stars_count} {t('admin.users.paymentsCount')}</p>
                    {paymentsData.stars_rub_equiv > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('admin.users.starsRubEquiv', {
                          value: paymentsData.stars_rub_equiv.toLocaleString('ru-RU', { maximumFractionDigits: 2 }),
                          rate: paymentsData.rub_per_star,
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  {paymentsData.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('admin.noData')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="pb-2 pr-4">{t('admin.users.paymentDate')}</th>
                            <th className="pb-2 pr-4">{t('admin.users.paymentAmount')}</th>
                            <th className="pb-2 pr-4">{t('admin.users.paymentType')}</th>
                            <th className="pb-2">{t('admin.users.paymentPeriod')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {paymentsData.items.map((p: AdminPurchaseDTO) => (
                            <tr key={p.id}>
                              <td className="py-2 pr-4 tabular-nums">{formatAdminDateTime(p.paid_at, dateLocale)}</td>
                              <td className="py-2 pr-4 font-mono">
                                {formatPaymentAmount(p.amount, p.currency || '', p.invoice_type).text}
                              </td>
                              <td className="py-2 pr-4">{formatInvoiceType(p.invoice_type, t)}</td>
                              <td className="py-2">{p.month > 0 ? t('admin.users.monthsShort', { count: p.month }) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <AdminTablePagination
                  page={paymentsPage}
                  totalPages={paymentsTotalPages}
                  onPageChange={setPaymentsPage}
                  className="mt-auto flex items-center justify-between border-t border-border pt-3"
                />
              </div>
            ) : null}
          </AdminSectionCard>

          <AdminSectionCard
            title={t('admin.users.referrals')}
            icon={Users}
            iconAccent="rose"
            fillHeight
            className="min-w-0"
          >
            {referralsLoading ? (
              <div className="flex flex-1 items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : referralsData ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    { labelKey: 'admin.users.referralsTotal', value: referralsData.stats.total },
                    { labelKey: 'admin.users.referralsPaid', value: referralsData.stats.paid },
                    { labelKey: 'admin.users.referralsActive', value: referralsData.stats.active },
                    { labelKey: 'admin.users.referralsConversion', value: `${referralsData.stats.conversion}%` },
                    { labelKey: 'admin.users.referralsDays', value: referralsData.stats.earned_total },
                  ].map(({ labelKey, value }) => (
                    <div key={labelKey} className="rounded-lg border bg-muted/30 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{t(labelKey)}</p>
                      <p className="font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="min-h-0 flex-1">
                  {referralsData.referees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('admin.noData')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="pb-2 pr-4">{t('admin.users.telegramId')}</th>
                            <th className="pb-2 pr-4">{t('admin.users.username')}</th>
                            <th className="pb-2">{t('admin.users.status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {referralsData.referees.map((ref: AdminRefereeDTO) => (
                            <tr key={ref.telegram_id}>
                              <td className="py-2 pr-4 font-mono">{ref.telegram_id}</td>
                              <td className="py-2 pr-4">{ref.telegram_username ? `@${ref.telegram_username}` : '—'}</td>
                              <td className="py-2">
                                <span className={cn('rounded-full px-2 py-0.5 text-xs', ref.active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                                  {ref.active ? t('admin.users.statusActive') : t('admin.users.referralInactive')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <AdminTablePagination
                  page={referralsPage}
                  totalPages={referralsTotalPages}
                  onPageChange={setReferralsPage}
                  className="mt-auto flex items-center justify-between border-t border-border pt-3"
                />
              </div>
            ) : null}
          </AdminSectionCard>
        </div>
      </div>

      <AdminUserEditModals
        userId={userId!}
        panel={panel}
        customer={user}
        tariffs={tariffOptions}
        tariffsEnabled={salesModeTariffs}
        activeModal={editModal}
        onClose={() => setEditModal(null)}
        onSuccess={handleOverviewSuccess}
        onError={handleOverviewError}
      />

      <AdminUserActionsModal
        open={actionsModal}
        onClose={() => setActionsModal(false)}
        hasRwUser={hasRwUser}
        rwStatus={rwStatus}
        onExtend={openExtendModal}
        onDisable={() => setConfirmDisable(true)}
        onEnable={() => enableMut.mutate(undefined, handlers(t('admin.feedback.enableSuccess')))}
        onDelete={() => setConfirmDelete(true)}
        disablePending={disableMut.isPending}
        enablePending={enableMut.isPending}
      />

      <AdminSetExpireModal
        open={extendModal}
        onClose={() => { setExtendModal(false); setExtendError(null) }}
        title={t('admin.users.extend')}
        icon={CalendarPlus}
        iconAccent="amber"
        minDate={new Date()}
        currentExpireAt={panel?.rw?.expire_at ?? user.expire_at}
        isPending={setExpireMut.isPending}
        error={extendError}
        onClearError={() => setExtendError(null)}
        onApply={(iso) => {
          setExtendError(null)
          setExpireMut.mutate(iso, {
            onSuccess: () => {
              setExtendModal(false)
              showSuccess(t('admin.feedback.extendSuccess'))
            },
            onError: (e) => setExtendError(formatAdminApiError(e, t)),
          })
        }}
      />

      <AdminModal
        open={confirmDisable}
        onClose={() => { setConfirmDisable(false); setDisableError(null) }}
        title={t('admin.users.disable')}
        icon={PowerOff}
        iconTone="danger"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {t('admin.users.disableWarning', { name: displayName })}
            </p>
          </div>
          {disableError && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {disableError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setConfirmDisable(false); setDisableError(null) }}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
            >
              {t('admin.cancel')}
            </button>
            <button
              onClick={() => {
                setDisableError(null)
                disableMut.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmDisable(false)
                    showSuccess(t('admin.feedback.disableSuccess'))
                  },
                  onError: (e) => setDisableError(formatAdminApiError(e, t)),
                })
              }}
              disabled={disableMut.isPending}
              className="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-50"
            >
              {disableMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('admin.users.disable')}
            </button>
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={confirmDelete}
        onClose={() => { setConfirmDelete(false); setDeleteError(null) }}
        title={t('admin.users.delete')}
        icon={Trash2}
        iconTone="danger"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
            <p className="text-sm text-muted-foreground">{t('admin.users.deleteWarning', { name: displayName })}</p>
          </div>
          {deleteError && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setConfirmDelete(false); setDeleteError(null) }} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">
              {t('admin.cancel')}
            </button>
            <button
              onClick={() => {
                setDeleteError(null)
                deleteMut.mutate(undefined, {
                  onSuccess: () => navigate('/admin/users'),
                  onError: (e) => setDeleteError(formatAdminApiError(e, t)),
                })
              }}
              disabled={deleteMut.isPending}
              className="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-50"
            >
              {deleteMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('admin.delete')}
            </button>
          </div>
        </div>
      </AdminModal>
    </AdminLayout>
  )
}
