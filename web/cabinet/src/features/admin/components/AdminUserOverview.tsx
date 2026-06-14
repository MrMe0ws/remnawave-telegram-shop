import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  User,
  Copy,
  Check,
  Loader2,
  Calendar,
  Star,
  Cpu,
  Users,
  Share2,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AdminCustomerDTO, AdminUserPanelDTO } from '@/lib/types/admin'
import { unifiedAccountStatus, accountStatusBadgeClasses } from '../utils/accountStatus'
import { rwIconToneClassNames } from '../utils/rwStatusStyles'
import { formatAdminDateTime } from '../utils/datetime'
import { copyToClipboard } from '../utils/copyToClipboard'
import { formatAdminApiError } from '../utils/formatAdminApiError'
import { AdminSetExpireModal } from './AdminSetExpireModal'
import { useAdminUserSetExpire, useAdminUserDevices } from '../hooks/useAdminUsers'

const GB = 1024 * 1024 * 1024

const STRATEGY_KEYS: Record<string, string> = {
  DAY: 'admin.users.subscription.strategies.day',
  WEEK: 'admin.users.subscription.strategies.week',
  MONTH: 'admin.users.subscription.strategies.month',
  MONTH_ROLLING: 'admin.users.subscription.strategies.monthRolling',
  NO_RESET: 'admin.users.subscription.strategies.noReset',
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '∞'
  const gb = bytes / GB
  return `${gb.toFixed(1)} GB`
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

function TrafficBar({
  used,
  limit,
  unlimitedLabel,
  hideCaption = false,
}: {
  used: number
  limit: number
  unlimitedLabel: string
  hideCaption?: boolean
}) {
  const isUnlimited = limit <= 0
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0

  return (
    <div className="space-y-2">
      {!hideCaption &&
        (isUnlimited ? (
          <p className="text-sm text-foreground">{unlimitedLabel}</p>
        ) : (
          <div className="flex justify-between gap-2 text-sm">
            <span className="font-medium text-primary tabular-nums">{formatBytes(used)}</span>
            <span className="text-muted-foreground tabular-nums">{formatBytes(limit)}</span>
          </div>
        ))}
      <div className="h-2.5 overflow-hidden rounded-full bg-muted/80">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isUnlimited
              ? 'w-full bg-gradient-to-r from-primary/35 via-primary/55 to-sky-400/45'
              : 'bg-gradient-to-r from-primary to-sky-400',
          )}
          style={{ width: isUnlimited ? '100%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}

function DesktopStatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Star
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-base font-semibold leading-snug text-foreground">{value}</p>
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

function TariffBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
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
  onExpireSuccess?: (message: string) => void
  onExpireError?: (message: string) => void
}

export function AdminUserOverview({
  user,
  userId,
  panel,
  panelLoading,
  tariffName,
  onExpireSuccess,
  onExpireError,
}: Props) {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'

  const [expireModalOpen, setExpireModalOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkCopyError, setLinkCopyError] = useState(false)

  const setExpire = useAdminUserSetExpire(userId)
  const { data: devicesData } = useAdminUserDevices(userId)

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

  const strategyLabel = (s: string) => {
    const key = STRATEGY_KEYS[s]
    return key ? t(key) : s
  }

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
  const expireFormatted = expireDisplay ? formatAdminDateTime(expireDisplay, dateLocale) : null
  const registeredFormatted = formatAdminDateTime(user.created_at, dateLocale)
  const lastResetFormatted = rw?.last_traffic_reset_at
    ? formatAdminDateTime(rw.last_traffic_reset_at, dateLocale)
    : null

  const hwidLimit = rw?.hwid_device_limit ?? 0
  const hwidUsed = devicesData?.items?.length ?? 0
  const hwidValue =
    hwidLimit > 0
      ? t('admin.users.overview.statHwidValue', { used: hwidUsed, limit: hwidLimit })
      : hwidUsed > 0
        ? String(hwidUsed)
        : '0'

  const tariffBadge =
    tariffName && user.subscription_period_months != null && user.subscription_period_months > 0
      ? t('admin.users.overview.tariffWithPeriod', {
          name: tariffName,
          period: t('admin.users.monthsShort', { count: user.subscription_period_months }),
        })
      : tariffName ?? null

  const resetStrategy = rw ? strategyLabel(rw.traffic_limit_strategy) : null

  const expireMeta =
    resetStrategy && lastResetFormatted
      ? t('admin.users.overview.resetInfo', { strategy: resetStrategy, date: lastResetFormatted })
      : resetStrategy
        ? t('admin.users.overview.resetStrategyOnly', { strategy: resetStrategy })
        : null

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

  return (
    <>
      <Card className="cabinet-elevated-card overflow-hidden">
        {/* ── Шапка ── */}
        <OverviewSection first>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full',
                iconStyles.boxClassName,
              )}
            >
              <User className={cn('size-5', iconStyles.iconClassName)} />
            </div>

            <div className="min-w-0 flex-1">
              {/* Desktop header row */}
              <div className="hidden flex-wrap items-center gap-2 sm:flex">
                <h1 className="text-xl font-semibold leading-tight">{displayName}</h1>
                <StatusBadge tone={accountStatus.tone}>{t(accountStatus.labelKey)}</StatusBadge>
                {tariffBadge && <TariffBadge>{tariffBadge}</TariffBadge>}
              </div>

              {/* Mobile header row */}
              <div className="flex items-start justify-between gap-2 sm:hidden">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold leading-tight">{displayName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('admin.users.overview.idLine', {
                      id: user.telegram_id,
                      lang: user.language.toUpperCase(),
                    })}
                  </p>
                </div>
                {copyIconButton}
              </div>

              <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                {t('admin.users.overview.idLine', {
                  id: user.telegram_id,
                  lang: user.language.toUpperCase(),
                })}
              </p>

              {/* Mobile status + tariff */}
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                <StatusBadge tone={accountStatus.tone}>{t(accountStatus.labelKey)}</StatusBadge>
                {tariffBadge && <TariffBadge>{tariffBadge}</TariffBadge>}
              </div>

              {panelExpire && dbExpire && panelExpire !== dbExpire && (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {t('admin.users.expireDb')}: {formatAdminDateTime(dbExpire, dateLocale)}
                </p>
              )}
            </div>

            {copyTextButton}
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
            {/* ── Desktop: трафик и подписка ── */}
            <OverviewSection title={t('admin.users.overview.sectionTraffic')} className="hidden sm:block">
              <TrafficBar
                used={rw.traffic_used_bytes}
                limit={rw.traffic_limit_bytes}
                unlimitedLabel={t('admin.users.overview.unlimitedTraffic')}
              />
              <button
                type="button"
                onClick={() => setExpireModalOpen(true)}
                className="mt-3 w-full text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="text-foreground">
                  {expireFormatted
                    ? t('admin.users.overview.expireLine', { date: expireFormatted })
                    : t('admin.users.pickExpireDate')}
                </span>
                {expireMeta && <span className="text-muted-foreground"> ({expireMeta})</span>}
              </button>
            </OverviewSection>

            {/* ── Mobile: подписка ── */}
            <OverviewSection title={t('admin.users.overview.sectionSubscription')} className="sm:hidden">
              <button
                type="button"
                onClick={() => setExpireModalOpen(true)}
                className="mb-3 text-left text-sm text-foreground tabular-nums"
              >
                {expireFormatted
                  ? t('admin.users.overview.expireLine', { date: expireFormatted })
                  : t('admin.users.pickExpireDate')}
              </button>
              <p className="mb-2 text-sm text-muted-foreground">
                {rw.traffic_limit_bytes <= 0
                  ? t('admin.users.overview.trafficLabelUnlimited')
                  : t('admin.users.overview.trafficLabel', {
                      used: formatBytes(rw.traffic_used_bytes),
                    })}
              </p>
              <TrafficBar
                used={rw.traffic_used_bytes}
                limit={rw.traffic_limit_bytes}
                unlimitedLabel={t('admin.users.overview.unlimitedTraffic')}
                hideCaption
              />
              {resetStrategy && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {lastResetFormatted
                    ? t('admin.users.overview.resetInfoMobile', {
                        strategy: resetStrategy,
                        date: lastResetFormatted,
                      })
                    : t('admin.users.overview.resetStrategyOnly', { strategy: resetStrategy })}
                </p>
              )}
            </OverviewSection>

            {/* ── Desktop: дополнительно ── */}
            <OverviewSection title={t('admin.users.overview.sectionAdditional')} className="hidden sm:block">
              <div className="grid gap-3 sm:grid-cols-3">
                <DesktopStatCard
                  icon={Star}
                  label={t('admin.users.overview.statXp')}
                  value={t('admin.users.overview.statXpValue', { n: user.loyalty_xp })}
                />
                <DesktopStatCard
                  icon={Cpu}
                  label={t('admin.users.overview.statHwid')}
                  value={hwidValue}
                />
                <DesktopStatCard
                  icon={Users}
                  label={t('admin.users.overview.statSquad')}
                  value={primarySquad ?? t('admin.users.overview.statSquadEmpty')}
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {t('admin.users.overview.registeredLine', { date: registeredFormatted })}
                {rw.tag && (
                  <>
                    {' '}
                    • {t('admin.users.overview.tagLine', { tag: rw.tag })}
                  </>
                )}
              </p>
            </OverviewSection>

            {/* ── Mobile: параметры ── */}
            <OverviewSection title={t('admin.users.overview.sectionParams')} className="sm:hidden">
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center gap-2">
                  <Star className="size-4 shrink-0 text-amber-500" aria-hidden />
                  <span>{t('admin.users.overview.experienceMobile', { n: user.loyalty_xp })}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Cpu className="size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    {hwidLimit > 0
                      ? t('admin.users.overview.statHwidMobile', { used: hwidUsed, limit: hwidLimit })
                      : t('admin.users.overview.statHwidMobileShort', { used: hwidUsed })}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Users className="size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    {t('admin.users.overview.squadMobile', {
                      name: primarySquad ?? t('admin.users.overview.statSquadEmpty'),
                    })}
                  </span>
                </li>
              </ul>
            </OverviewSection>

            {/* ── Mobile: системное ── */}
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
              {expireFormatted && (
                <button
                  type="button"
                  onClick={() => setExpireModalOpen(true)}
                  className="mt-2 text-sm text-foreground tabular-nums hover:text-primary"
                >
                  {t('admin.users.overview.expireLine', { date: expireFormatted })}
                </button>
              )}
            </OverviewSection>
          )
        )}
      </Card>

      <AdminSetExpireModal
        open={expireModalOpen}
        onClose={() => setExpireModalOpen(false)}
        title={t('admin.users.subscription.expire')}
        icon={Calendar}
        iconAccent="amber"
        initialIso={panelExpire ?? dbExpire ?? undefined}
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
