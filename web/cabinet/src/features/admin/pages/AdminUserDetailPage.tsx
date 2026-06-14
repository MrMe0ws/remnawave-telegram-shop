import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CalendarPlus,
  RotateCcw,
  Power,
  PowerOff,
  Trash2,
  CreditCard,
  Users,
  Loader2,
  AlertTriangle,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'

import { AdminLayout } from '../layout/AdminLayout'
import { useAdminPageMeta } from '../layout/useAdminPageMeta'
import { AdminSectionCard } from '../components/AdminSectionCard'
import { AdminUserOverview } from '../components/AdminUserOverview'
import { AdminUserSubscriptionPanel } from '../components/AdminUserSubscriptionPanel'
import { AdminSetExpireModal } from '../components/AdminSetExpireModal'
import { AdminFeedback } from '../components/AdminFeedback'
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
  useAdminUserResetTraffic,
  type AdminPurchaseDTO,
  type AdminRefereeDTO,
} from '../hooks/useAdminUsers'

import { formatAdminDateTime } from '../utils/datetime'
import { resolveTariffLabel } from '../utils/resolveTariffLabel'
import { useAdminTariffList } from '../hooks/useAdminTariffs'
import { AdminModal } from '../components/AdminModal'

const PAYMENTS_PAGE_LIMIT = 20

export default function AdminUserDetailPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const userId = id ? parseInt(id, 10) : null
  const { data: user, isLoading, isError } = useAdminUser(userId)
  const { data: panel, isLoading: panelLoading, isError: panelError } = useAdminUserPanel(userId)
  const { data: allTariffs } = useAdminTariffList()

  const hasRwUser = panel?.has_rw_user ?? false
  const rwStatus = panel?.rw?.status?.toUpperCase()

  const [extendModal, setExtendModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [paymentsPage, setPaymentsPage] = useState(1)
  const [extendError, setExtendError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [overviewFeedback, setOverviewFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { feedback, clear, handlers, showSuccess } = useAdminMutationFeedback()

  const setExpireMut = useAdminUserSetExpire(userId)
  const disableMut = useAdminUserDisable(userId)
  const enableMut = useAdminUserEnable(userId)
  const deleteMut = useAdminUserDelete(userId)
  const resetTrafficMut = useAdminUserResetTraffic(userId)

  const { data: paymentsData, isLoading: paymentsLoading } = useAdminUserPayments(userId, paymentsPage, PAYMENTS_PAGE_LIMIT)
  const { data: referralsData, isLoading: referralsLoading } = useAdminUserReferrals(userId)

  const breadcrumbTail = user
    ? (user.telegram_username ? `@${user.telegram_username}` : `#${user.id}`)
    : undefined

  const openExtendModal = () => {
    setExtendError(null)
    setExtendModal(true)
  }

  const userActionsCard = useMemo(
    () => (
      <AdminSectionCard title={t('admin.actions')} icon={Shield} iconAccent="indigo" fillHeight>
        <div className="grid flex-1 content-start gap-2">
          <button onClick={openExtendModal} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm hover:bg-accent">
            <CalendarPlus className="size-4 shrink-0 text-primary" /> {t('admin.users.extend')}
          </button>
          {hasRwUser && (
            <>
              <button
                onClick={() => resetTrafficMut.mutate(undefined, handlers(t('admin.feedback.resetTrafficSuccess')))}
                disabled={resetTrafficMut.isPending}
                className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                {resetTrafficMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4 shrink-0" />}
                {t('admin.users.resetTraffic')}
              </button>
              {rwStatus === 'ACTIVE' ? (
                <button
                  onClick={() => disableMut.mutate(undefined, handlers(t('admin.feedback.disableSuccess')))}
                  disabled={disableMut.isPending}
                  className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-500/15 disabled:opacity-50 dark:text-orange-400"
                >
                  <PowerOff className="size-4 shrink-0" /> {t('admin.users.disable')}
                </button>
              ) : (
                <button
                  onClick={() => enableMut.mutate(undefined, handlers(t('admin.feedback.enableSuccess')))}
                  disabled={enableMut.isPending}
                  className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400"
                >
                  <Power className="size-4 shrink-0" /> {t('admin.users.enable')}
                </button>
              )}
            </>
          )}
          {!hasRwUser && (
            <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {t('admin.users.subscription.noRwUser')}
            </p>
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-500/15 disabled:opacity-50 dark:text-red-400"
          >
            <Trash2 className="size-4 shrink-0" /> {t('admin.users.delete')}
          </button>
        </div>
      </AdminSectionCard>
    ),
    [t, hasRwUser, rwStatus, resetTrafficMut, disableMut, enableMut, handlers],
  )

  useAdminPageMeta({ breadcrumbTail })

  const paymentsTotalPages = paymentsData
    ? Math.max(1, Math.ceil(paymentsData.total / PAYMENTS_PAGE_LIMIT))
    : 1

  useEffect(() => {
    setPaymentsPage(1)
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
        <div className="grid min-w-0 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <AdminUserOverview
            user={user}
            userId={userId!}
            panel={panel}
            panelLoading={panelLoading}
            tariffName={tariffName}
            onExpireSuccess={(msg) => setOverviewFeedback({ type: 'success', message: msg })}
            onExpireError={(msg) => setOverviewFeedback({ type: 'error', message: msg })}
          />
          <aside className="hidden h-full min-w-0 lg:sticky lg:top-16 lg:block">
            {userActionsCard}
          </aside>
        </div>

        <div className="lg:hidden">{userActionsCard}</div>

        <AdminUserSubscriptionPanel
              userId={userId!}
              panel={panel}
              panelLoading={panelLoading}
              panelError={panelError}
            />

            <AdminSectionCard title={t('admin.users.payments')} icon={CreditCard} iconAccent="emerald">
              {paymentsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : paymentsData ? (
                <>
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
                  {paymentsTotalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <button
                        type="button"
                        disabled={paymentsPage <= 1}
                        onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                      >
                        <ChevronLeft className="size-4" />
                        {t('admin.prev')}
                      </button>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {paymentsPage} / {paymentsTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={paymentsPage >= paymentsTotalPages}
                        onClick={() => setPaymentsPage((p) => Math.min(paymentsTotalPages, p + 1))}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                      >
                        {t('admin.next')}
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </AdminSectionCard>

            <AdminSectionCard title={t('admin.users.referrals')} icon={Users} iconAccent="rose">
              {referralsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : referralsData ? (
                <>
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
                </>
              ) : null}
            </AdminSectionCard>
      </div>

      <AdminSetExpireModal
        open={extendModal}
        onClose={() => { setExtendModal(false); setExtendError(null) }}
        title={t('admin.users.extend')}
        icon={CalendarPlus}
        iconAccent="amber"
        initialIso={panel?.rw?.expire_at ?? user.expire_at}
        minDate={new Date()}
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
