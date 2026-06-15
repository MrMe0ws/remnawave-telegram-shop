import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  User,
  Copy,
  Check,
  Loader2,
  Calendar,
  Star,
  Smartphone,
  Users,
  Share2,
  Shield,
  FileText,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { TrafficUsageBar } from '@/components/TrafficUsageBar'
import { SubscriptionExpireAtBlock } from '@/components/SubscriptionExpireAtBlock'
import { cn, daysUntil } from '@/lib/utils'
import type { AdminCustomerDTO, AdminUserPanelDTO } from '@/lib/types/admin'
import { unifiedAccountStatus, accountStatusBadgeClasses } from '../utils/accountStatus'
import { rwIconToneClassNames } from '../utils/rwStatusStyles'
import { formatAdminDateTime } from '../utils/datetime'
import { copyToClipboard } from '../utils/copyToClipboard'
import { formatAdminApiError } from '../utils/formatAdminApiError'
import { AdminSetExpireModal } from './AdminSetExpireModal'
import { ClickableOverviewControl } from './overview/ClickableOverviewControl'
import type { UserEditModalKey } from './user-modals/types'
import { useAdminUserSetExpire, useAdminUserDevices } from '../hooks/useAdminUsers'
import { useAdminBootstrap } from '../hooks/useAdminBootstrap'
import { useAdminLoyaltyTiers, type AdminLoyaltyTier } from '../hooks/useAdminLoyalty'

const GB = 1024 * 1024 * 1024

function resolveLoyaltyDiscountPercent(
  user: AdminCustomerDTO,
  tiers: AdminLoyaltyTier[] | undefined,
  loyaltyEnabled: boolean,
): number | null {
  if (!loyaltyEnabled) return null
  if (user.loyalty_discount_percent != null) return user.loyalty_discount_percent
  if (!tiers?.length) return null

  let discount = tiers[0].discount_percent
  for (const tier of tiers) {
    if (user.loyalty_xp >= tier.xp_min) {
      discount = tier.discount_percent
    }
  }
  return discount
}

function XpOverviewValue({ xp, discount }: { xp: number; discount: number | null }) {
  if (discount == null) {
    return <span className="tabular-nums">{xp}</span>
  }
  return (
    <span>
      <span className="tabular-nums">{xp}</span>
      <span className="font-medium text-muted-foreground"> · {discount}%</span>
    </span>
  )
}

function bytesToGb(bytes: number): number {
  return bytes / GB
}

function OverviewSection({
  title,
  children,
  className,
  first,
}: {
  title?: string
  children: ReactNode
  className?: string
  first?: boolean
}) {
  return (
    <section
      className={cn(
        'px-4 py-4 sm:px-5',
        !first && 'border-t border-border/50',
        className,
      )}
    >
      {title ? (
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  )
}

function DesktopStatCard({
  icon: Icon,
  label,
  value,
  onClick,
  clickTitle,
}: {
  icon: typeof Star
  label: string
  value: ReactNode
  onClick?: () => void
  clickTitle?: string
}) {
  const inner = (
    <>
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-base font-semibold leading-snug text-foreground">{value}</p>
    </>
  )

  if (onClick) {
    return (
      <ClickableOverviewControl variant="card" onClick={onClick} title={clickTitle}>
        {inner}
      </ClickableOverviewControl>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3">
      {inner}
    </div>
  )
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: 'success' | 'danger' | 'warning' | 'default' }) {
  return (
    <span className={accountStatusBadgeClasses(tone)}>
      {children}
    </span>
  )
}

interface Props {
  user: AdminCustomerDTO
  userId: number
  panel?: AdminUserPanelDTO | null
  panelLoading?: boolean
  tariffName?: string | null
  canEditTariff?: boolean
  onExpireSuccess?: (message: string) => void
  onExpireError?: (message: string) => void
  onOpenModal?: (key: UserEditModalKey) => void
  onOpenActions?: () => void
  actionsFooter?: ReactNode
}

export function AdminUserOverview({
  user,
  userId,
  panel,
  panelLoading,
  tariffName,
  canEditTariff,
  onExpireSuccess,
  onExpireError,
  onOpenModal,
  onOpenActions,
  actionsFooter,
}: Props) {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'
  const clickTitle = t('admin.users.overview.clickToEdit')

  const [expireModalOpen, setExpireModalOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkCopyError, setLinkCopyError] = useState(false)

  const setExpire = useAdminUserSetExpire(userId)
  const { data: devicesData } = useAdminUserDevices(userId)
  const { data: bootstrap } = useAdminBootstrap()
  const loyaltyEnabled = bootstrap?.loyalty_enabled ?? false
  const { data: loyaltyTiers } = useAdminLoyaltyTiers()
  const loyaltyDiscount = resolveLoyaltyDiscountPercent(user, loyaltyTiers, loyaltyEnabled)
  const xpValue = <XpOverviewValue xp={user.loyalty_xp} discount={loyaltyDiscount} />

  const rw = panel?.rw
  const hasRwUser = panel?.has_rw_user && rw
  const panelExpire = rw?.expire_at
  const dbExpire = user.expire_at
  const expireDisplay = panelExpire ?? dbExpire
  const subscriptionLink = user.subscription_link?.trim() || rw?.subscription_url?.trim() || ''

  const accountStatus = unifiedAccountStatus({
    status: user.status,
    rwStatus: rw?.status ?? user.rw_status,
    expireAt: expireDisplay,
  })

  const iconStyles = rwIconToneClassNames(accountStatus.tone)
  const displayName = user.telegram_username ? `@${user.telegram_username}` : `#${user.id}`

  const handleCopyLink = async () => {
    if (!subscriptionLink) return
    setLinkCopyError(false)
    const ok = await copyToClipboard(subscriptionLink)
    if (ok) {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } else {
      setLinkCopyError(true)
    }
  }

  const activeSquads = rw?.active_squads ?? []
  const primarySquad = activeSquads[0]?.name ?? null
  const squadDisplay =
    activeSquads.length > 1
      ? `${primarySquad} +${activeSquads.length - 1}`
      : primarySquad ?? t('admin.users.overview.statSquadEmpty')

  const registeredFormatted = formatAdminDateTime(user.created_at, dateLocale)

  const hwidUsed = devicesData?.items?.length ?? 0
  const devicesLimit = rw?.hwid_device_limit ?? 1
  const devicesValue = t('admin.users.overview.statDevicesValue', {
    used: hwidUsed,
    limit: devicesLimit,
  })

  const descriptionText = rw?.description?.trim() || t('admin.users.overview.descriptionEmpty')

  const tariffBadge = tariffName ?? null

  const copyIconButton = subscriptionLink ? (
    <button
      type="button"
      onClick={() => void handleCopyLink()}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
      title={linkCopied ? t('admin.users.copyLinkSuccess') : t('admin.users.copySubscriptionLink')}
      aria-label={t('admin.users.copySubscriptionLink')}
    >
      {linkCopied ? <Check className="size-4 text-emerald-600" /> : <Share2 className="size-4" />}
    </button>
  ) : null

  const actionsIconButton = onOpenActions ? (
    <button
      type="button"
      onClick={onOpenActions}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-600 transition-colors hover:bg-violet-500/15 dark:text-violet-400 sm:hidden"
      title={t('admin.actions')}
      aria-label={t('admin.actions')}
    >
      <Shield className="size-4" />
    </button>
  ) : null

  const copyTextButton = subscriptionLink ? (
    <button
      type="button"
      onClick={() => void handleCopyLink()}
      className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 sm:inline-flex"
    >
      {linkCopied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      {linkCopied ? t('admin.users.copyLinkSuccess') : t('admin.users.copySubscriptionLink')}
    </button>
  ) : null

  const lang = i18n.language?.startsWith('en') ? 'en' : 'ru'
  const subscriptionDays = expireDisplay ? daysUntil(expireDisplay) : null
  const isSubscriptionActive =
    accountStatus.key === 'active' || accountStatus.key === 'trial'

  const openModal = (key: UserEditModalKey) => onOpenModal?.(key)

  const renderTariffBadge = () => {
    if (canEditTariff && onOpenModal) {
      const label = tariffBadge ?? t('admin.users.subscription.assignTariff')
      return (
        <ClickableOverviewControl
          variant="badge"
          onClick={() => openModal('tariff')}
          title={clickTitle}
          className={
            tariffBadge
              ? undefined
              : 'border-dashed border-muted-foreground/40 bg-muted/20 text-muted-foreground'
          }
        >
          {label}
        </ClickableOverviewControl>
      )
    }
    if (tariffBadge) {
      return (
        <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {tariffBadge}
        </span>
      )
    }
    return null
  }

  const subscriptionMetricsRowClass =
    'rounded-lg px-1 py-1 -mx-1 transition-colors hover:bg-muted/30 active:bg-muted/40'

  const renderTrafficMetric = (trafficUsedGb: number, trafficLimitGb: number) =>
    onOpenModal ? (
      <ClickableOverviewControl
        variant="row"
        onClick={() => openModal('traffic')}
        title={clickTitle}
        className={cn('items-center', subscriptionMetricsRowClass)}
      >
        <TrafficUsageBar
          usedGb={trafficUsedGb}
          limitGb={trafficLimitGb}
          usageTitle={t('dashboard.trafficUsage')}
          gigabytesLabel={t('dashboard.gigabytes')}
          unlimitedLabel={t('subscriptionPage.unlimited')}
          className="w-full"
        />
      </ClickableOverviewControl>
    ) : (
      <TrafficUsageBar
        usedGb={trafficUsedGb}
        limitGb={trafficLimitGb}
        usageTitle={t('dashboard.trafficUsage')}
        gigabytesLabel={t('dashboard.gigabytes')}
        unlimitedLabel={t('subscriptionPage.unlimited')}
      />
    )

  const renderExpireMetric = () => (
    <ClickableOverviewControl
      variant="row"
      onClick={() => setExpireModalOpen(true)}
      title={clickTitle}
      className={cn('mt-3 items-center', subscriptionMetricsRowClass)}
    >
      <SubscriptionExpireAtBlock
        expireAt={expireDisplay}
        lang={lang}
        days={subscriptionDays}
        isActive={isSubscriptionActive}
        className="min-w-0 flex-1"
      />
    </ClickableOverviewControl>
  )

  return (
    <>
      <Card className="cabinet-elevated-card overflow-hidden">
        <OverviewSection first>
          <div className="flex items-center gap-3 sm:items-start">
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full',
                iconStyles.boxClassName,
              )}
            >
              <User className={cn('size-5', iconStyles.iconClassName)} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="hidden sm:flex sm:items-start sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold leading-tight">{displayName}</h1>
                  <StatusBadge tone={accountStatus.tone}>{t(accountStatus.labelKey)}</StatusBadge>
                  {renderTariffBadge()}
                </div>
                {copyTextButton}
              </div>

              <div className="flex items-center justify-between gap-2 sm:hidden">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold leading-tight">{displayName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('admin.users.overview.idLine', {
                      id: user.telegram_id,
                      lang: user.language.toUpperCase(),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {actionsIconButton}
                  {copyIconButton}
                </div>
              </div>

              <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                {t('admin.users.overview.idLine', {
                  id: user.telegram_id,
                  lang: user.language.toUpperCase(),
                })}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                <StatusBadge tone={accountStatus.tone}>{t(accountStatus.labelKey)}</StatusBadge>
                {renderTariffBadge()}
              </div>

              {panelExpire && dbExpire && panelExpire !== dbExpire && (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {t('admin.users.expireDb')}: {formatAdminDateTime(dbExpire, dateLocale)}
                </p>
              )}
            </div>
          </div>
          {linkCopyError && (
            <p className="mt-2 text-xs text-destructive">{t('admin.users.copyLinkError')}</p>
          )}
        </OverviewSection>

        {panelLoading ? (
          <div className="flex justify-center border-t border-border/50 py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasRwUser && rw ? (
          <>
            <OverviewSection title={t('admin.users.overview.sectionTraffic')}>
              {renderTrafficMetric(
                bytesToGb(rw.traffic_used_bytes),
                rw.traffic_limit_bytes > 0 ? bytesToGb(rw.traffic_limit_bytes) : 0,
              )}
              {renderExpireMetric()}
            </OverviewSection>

            <OverviewSection title={t('admin.users.overview.sectionAdditional')} className="hidden sm:block">
              <div className="grid gap-3 sm:grid-cols-3">
                <DesktopStatCard
                  icon={Smartphone}
                  label={t('admin.users.overview.statDevices')}
                  value={devicesValue}
                  onClick={onOpenModal ? () => openModal('devices') : undefined}
                  clickTitle={clickTitle}
                />
                <DesktopStatCard
                  icon={Users}
                  label={t('admin.users.overview.statSquad')}
                  value={squadDisplay}
                  onClick={onOpenModal ? () => openModal('squads') : undefined}
                  clickTitle={clickTitle}
                />
                <DesktopStatCard
                  icon={Star}
                  label={t('admin.users.overview.statXp')}
                  value={xpValue}
                />
              </div>
              {onOpenModal ? (
                <ClickableOverviewControl
                  variant="row"
                  onClick={() => openModal('description')}
                  title={clickTitle}
                  className="mt-4 items-center gap-2 text-sm text-muted-foreground"
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{t('admin.users.overview.descriptionLine', { text: descriptionText })}</span>
                  </span>
                </ClickableOverviewControl>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t('admin.users.overview.descriptionLine', { text: descriptionText })}
                </p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">
                {t('admin.users.overview.registeredLine', { date: registeredFormatted })}
                {rw.tag && (
                  <>
                    {' '}
                    • {t('admin.users.overview.tagLine', { tag: rw.tag })}
                  </>
                )}
              </p>
            </OverviewSection>

            <OverviewSection title={t('admin.users.overview.sectionParams')} className="sm:hidden">
              <ul className="space-y-2.5 text-sm">
                {onOpenModal ? (
                  <li>
                    <ClickableOverviewControl
                      variant="inline"
                      onClick={() => openModal('devices')}
                      title={clickTitle}
                      className="flex w-full items-center gap-2"
                    >
                      <Smartphone className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 text-left">
                        {t('admin.users.overview.statDevicesMobile', {
                          used: hwidUsed,
                          limit: devicesLimit,
                        })}
                      </span>
                    </ClickableOverviewControl>
                  </li>
                ) : (
                  <li className="flex items-center gap-2">
                    <Smartphone className="size-4 shrink-0 text-primary" aria-hidden />
                    <span>
                      {t('admin.users.overview.statDevicesMobile', {
                        used: hwidUsed,
                        limit: devicesLimit,
                      })}
                    </span>
                  </li>
                )}
                {onOpenModal ? (
                  <li>
                    <ClickableOverviewControl
                      variant="inline"
                      onClick={() => openModal('squads')}
                      title={clickTitle}
                      className="flex w-full items-center gap-2"
                    >
                      <Users className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 text-left">
                        {t('admin.users.overview.squadMobile', { name: squadDisplay })}
                      </span>
                    </ClickableOverviewControl>
                  </li>
                ) : (
                  <li className="flex items-center gap-2">
                    <Users className="size-4 shrink-0 text-primary" aria-hidden />
                    <span>{t('admin.users.overview.squadMobile', { name: squadDisplay })}</span>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Star className="size-4 shrink-0 text-amber-500" aria-hidden />
                  <span className="text-sm">{xpValue}</span>
                </li>
                {onOpenModal && (
                  <li>
                    <ClickableOverviewControl
                      variant="inline"
                      onClick={() => openModal('description')}
                      title={clickTitle}
                      className="flex w-full items-center gap-2"
                    >
                      <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 text-left">
                        {t('admin.users.overview.descriptionLine', { text: descriptionText })}
                      </span>
                    </ClickableOverviewControl>
                  </li>
                )}
              </ul>
            </OverviewSection>

            <OverviewSection title={t('admin.users.overview.sectionSystem')} className="sm:hidden">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>{t('admin.users.overview.registeredLine', { date: registeredFormatted })}</li>
                {rw.tag && <li>{t('admin.users.overview.tagLine', { tag: rw.tag })}</li>}
              </ul>
            </OverviewSection>
          </>
        ) : (
          !panelLoading && (
            <OverviewSection title={t('admin.users.overview.sectionTraffic')}>
              <p className="text-sm text-muted-foreground">{t('admin.users.subscription.noRwUser')}</p>
              {expireDisplay && (
                <ClickableOverviewControl
                  variant="row"
                  onClick={() => setExpireModalOpen(true)}
                  title={clickTitle}
                  className={cn('mt-3 items-center', subscriptionMetricsRowClass)}
                >
                  <SubscriptionExpireAtBlock
                    expireAt={expireDisplay}
                    lang={lang}
                    days={subscriptionDays}
                    isActive={isSubscriptionActive}
                    className="min-w-0 flex-1"
                  />
                </ClickableOverviewControl>
              )}
            </OverviewSection>
          )
        )}

        {actionsFooter ? (
          <OverviewSection title={t('admin.actions')} className="hidden lg:block">
            {actionsFooter}
          </OverviewSection>
        ) : null}
      </Card>

      <AdminSetExpireModal
        open={expireModalOpen}
        onClose={() => setExpireModalOpen(false)}
        title={t('admin.users.subscription.expire')}
        icon={Calendar}
        iconAccent="amber"
        currentExpireAt={expireDisplay}
        isPending={setExpire.isPending}
        onApply={(iso) => {
          setExpire.mutate(iso, {
            onSuccess: () => {
              setExpireModalOpen(false)
              onExpireSuccess?.(t('admin.feedback.extendSuccess'))
            },
            onError: (e) => onExpireError?.(formatAdminApiError(e, t)),
          })
        }}
      />
    </>
  )
}
