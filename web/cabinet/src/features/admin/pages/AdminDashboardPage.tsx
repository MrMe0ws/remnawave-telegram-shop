import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  CircleSlash,
  Clock,
  Cpu,
  Gauge,
  HardDrive,
  LayoutGrid,
  Loader2,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AdminBandwidthDTO } from '@/lib/types/admin'

import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { useAdminOverview } from '../hooks/useAdminOverview'
import { StatsIconChip, StatsPanel, StatsPanelHead } from '../stats/components/StatsPanel'
import { StatsKpiCard, StatsMiniCard } from '../stats/components/StatsKpiCard'
import { formatRub, statsNumberLocale } from '../stats/utils/statsFormat'
import { STATS_ACCENT } from '../stats/utils/statsPalette'

export default function AdminDashboardPage() {
  return (
    <AdminLayout>
      <AdminDashboardContent />
    </AdminLayout>
  )
}

/**
 * «Обзор» — оперативный экран: что происходит сейчас и что ждёт действия.
 *
 * Раньше здесь лежали плитки-ссылки на разделы админки, то есть меню внутри
 * бокового меню. Разделение со «Статистикой» — по горизонту: здесь «сейчас и
 * сегодня», там «как шёл период».
 *
 * Панель Remnawave — внешняя зависимость. Числа магазина показываются всегда;
 * если панель не отвечает, вместо её блоков стоит честная плашка, а не спиннер
 * и не нули, выдающие себя за данные.
 */
function AdminDashboardContent() {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const { data, isLoading, error, refetch, isFetching } = useAdminOverview()

  const panel = data?.panel
  const attention = data?.attention

  const attentionItems = [
    {
      key: 'partnerApplications',
      count: attention?.partner_applications ?? 0,
      to: '/admin/partners',
      label: t('admin.overview.attentionPartnerApplications', {
        count: attention?.partner_applications ?? 0,
      }),
    },
    {
      key: 'partnerPayouts',
      count: attention?.partner_payouts ?? 0,
      to: '/admin/partners',
      label: t('admin.overview.attentionPartnerPayouts', {
        count: attention?.partner_payouts ?? 0,
      }),
    },
    {
      key: 'openInvoices',
      count: attention?.open_invoices ?? 0,
      to: '/admin/payments',
      label: t('admin.overview.attentionOpenInvoices', {
        count: attention?.open_invoices ?? 0,
      }),
    },
  ].filter((item) => item.count > 0)

  return (
    <div className="space-y-4">
      <AdminPageHeader
        icon={LayoutGrid}
        title={t('admin.overview.title')}
        subtitle={t('admin.overview.subtitle')}
        accent="blue"
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t('admin.stats.refresh')}
            title={t('admin.stats.refresh')}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card transition-colors hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
          </button>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Card className="border-destructive/50 p-6 text-center text-sm text-destructive">
          {t('admin.overview.error')}
        </Card>
      )}

      {data && (
        <>
          {/* 1. Сейчас */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatsKpiCard
              icon={Radio}
              color={STATS_ACCENT.green}
              label={t('admin.overview.onlineNow')}
              value={
                panel?.available ? panel.online.now.toLocaleString(numberLocale) : '—'
              }
              hint={
                <span className="text-muted-foreground">
                  {t('admin.overview.onlineNowHint')}
                </span>
              }
            />
            <StatsKpiCard
              icon={ShieldCheck}
              color={STATS_ACCENT.cyan}
              label={t('admin.overview.activeSubscriptions')}
              value={data.shop.active_subscriptions.toLocaleString(numberLocale)}
              hint={
                <span className="text-muted-foreground">
                  {t('admin.overview.ofCustomers', {
                    value: data.shop.total_customers.toLocaleString(numberLocale),
                  })}
                </span>
              }
            />
            <StatsKpiCard
              icon={Server}
              color={STATS_ACCENT.blue}
              label={t('admin.overview.nodesOnline')}
              value={
                panel?.available ? panel.system.nodes_online.toLocaleString(numberLocale) : '—'
              }
              hint={
                <span className="text-muted-foreground">
                  {t('admin.overview.nodesOnlineHint')}
                </span>
              }
            />
            <StatsKpiCard
              icon={Gauge}
              color={STATS_ACCENT.amber}
              label={t('admin.overview.trafficToday')}
              value={panel?.available ? panel.traffic.today.current : '—'}
              hint={
                panel?.available ? (
                  <TrafficDelta value={panel.traffic.today.difference} note={t('admin.overview.vsYesterday')} />
                ) : undefined
              }
            />
          </div>

          {/* 2. Требует внимания */}
          {attentionItems.length > 0 && (
            <Card className="cabinet-elevated-card stats-ring flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-5">
              <span className="flex items-center gap-2 text-sm font-medium">
                <StatsIconChip icon={AlertTriangle} color={STATS_ACCENT.amber} size="sm" />
                {t('admin.overview.attentionTitle')}
              </span>
              {attentionItems.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-[13px] transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {item.label}
                  <ArrowRight className="size-3.5 shrink-0" />
                </Link>
              ))}
            </Card>
          )}

          {!panel?.available && (
            <Card className="flex items-center gap-3 border-amber-500/40 p-4 text-sm sm:px-5">
              <CircleSlash className="size-4 shrink-0 text-amber-500" />
              <span className="text-muted-foreground">
                {panel?.reason === 'not_configured'
                  ? t('admin.overview.panelNotConfigured')
                  : t('admin.overview.panelUnreachable')}
              </span>
            </Card>
          )}

          {/* 3. Трафик */}
          {panel?.available && (
            <StatsPanel>
              <StatsPanelHead
                icon={Gauge}
                color={STATS_ACCENT.cyan}
                title={t('admin.overview.trafficTitle')}
                subtitle={t('admin.overview.trafficSubtitle')}
              />
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
                <TrafficCell
                  icon={CalendarDays}
                  color={STATS_ACCENT.cyan}
                  label={t('admin.overview.periodToday')}
                  data={panel.traffic.today}
                />
                <TrafficCell
                  icon={CalendarRange}
                  color={STATS_ACCENT.green}
                  label={t('admin.overview.periodWeek')}
                  data={panel.traffic.last_seven_days}
                />
                <TrafficCell
                  icon={CalendarRange}
                  color={STATS_ACCENT.blue}
                  label={t('admin.overview.periodThirty')}
                  data={panel.traffic.last_thirty_days}
                />
                <TrafficCell
                  icon={CalendarDays}
                  color={STATS_ACCENT.orange}
                  label={t('admin.overview.periodCalendarMonth')}
                  data={panel.traffic.calendar_month}
                />
                <TrafficCell
                  icon={CalendarRange}
                  color={STATS_ACCENT.violet}
                  label={t('admin.overview.periodYear')}
                  data={panel.traffic.current_year}
                />
              </div>
            </StatsPanel>
          )}

          {/* 4. Онлайн и система */}
          {panel?.available && (
            <div className="grid gap-4 lg:grid-cols-2">
              <StatsPanel>
                <StatsPanelHead
                  icon={Activity}
                  color={STATS_ACCENT.green}
                  title={t('admin.overview.onlineTitle')}
                  subtitle={t('admin.overview.onlineSubtitle')}
                />
                <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                  <PlainCell
                    icon={Radio}
                    label={t('admin.overview.onlineNow')}
                    value={panel.online.now.toLocaleString(numberLocale)}
                  />
                  <PlainCell
                    icon={Clock}
                    label={t('admin.overview.onlineToday')}
                    value={panel.online.today.toLocaleString(numberLocale)}
                  />
                  <PlainCell
                    icon={UsersRound}
                    label={t('admin.overview.onlineWeek')}
                    value={panel.online.week.toLocaleString(numberLocale)}
                  />
                  <PlainCell
                    icon={CircleSlash}
                    label={t('admin.overview.onlineNever')}
                    value={panel.online.never_online.toLocaleString(numberLocale)}
                    muted
                  />
                </div>
              </StatsPanel>

              <StatsPanel>
                <StatsPanelHead
                  icon={Server}
                  color={STATS_ACCENT.blue}
                  title={t('admin.overview.systemTitle')}
                  subtitle={t('admin.overview.systemSubtitle', {
                    total: panel.panel_users.total.toLocaleString(numberLocale),
                  })}
                />
                <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                  <PlainCell
                    icon={Server}
                    label={t('admin.overview.nodesOnline')}
                    value={panel.system.nodes_online.toLocaleString(numberLocale)}
                  />
                  <PlainCell
                    icon={HardDrive}
                    label={t('admin.overview.totalTraffic')}
                    value={panel.system.total_bytes_lifetime || '—'}
                  />
                  <PlainCell
                    icon={Cpu}
                    label={t('admin.overview.memory')}
                    value={`${formatGiB(panel.system.memory_used)} / ${formatGiB(panel.system.memory_total)}`}
                  />
                  <PlainCell
                    icon={Clock}
                    label={t('admin.overview.uptime')}
                    value={formatUptime(panel.system.uptime_seconds, t)}
                  />
                </div>
              </StatsPanel>
            </div>
          )}

          {/* 5. Деньги коротко */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatsMiniCard
              icon={Wallet}
              color={STATS_ACCENT.cyan}
              label={t('admin.overview.revenueToday')}
              value={formatRub(data.shop.revenue_today_rub, numberLocale)}
              hint={t('admin.overview.salesToday', { count: data.shop.sales_today })}
            />
            <StatsMiniCard
              icon={Wallet}
              color={STATS_ACCENT.green}
              label={t('admin.overview.revenueMonth')}
              value={formatRub(data.shop.revenue_month_rub, numberLocale)}
              hint={t('admin.overview.revenueMonthHint')}
            />
            <StatsMiniCard
              icon={UsersRound}
              color={STATS_ACCENT.blue}
              label={t('admin.overview.payersToday')}
              value={data.shop.payers_today.toLocaleString(numberLocale)}
              hint={t('admin.overview.payersTodayHint')}
            />
            <Link
              to="/admin/stats"
              className="cabinet-elevated-card stats-ring flex flex-col justify-center gap-1 p-4 transition-colors hover:text-primary sm:px-5"
            >
              <span className="text-[13px] text-muted-foreground">
                {t('admin.overview.moreStats')}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[17px] font-semibold">
                {t('admin.overview.moreStatsLink')}
                <ArrowRight className="size-4 shrink-0" />
              </span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

/** Разница за период. Знак приходит от панели, цвет ставим по нему. */
function TrafficDelta({ value, note }: { value: string; note?: string }) {
  const trimmed = value.trim()
  const down = trimmed.startsWith('-') || trimmed.startsWith('−')
  const up = trimmed.length > 0 && !down && trimmed !== '0'
  return (
    <span className="tabular-nums">
      <span
        className={cn(
          'font-semibold',
          up && 'text-emerald-500',
          down && 'text-rose-500',
          !up && !down && 'text-muted-foreground',
        )}
      >
        {trimmed || '—'}
      </span>
      {note && <span className="ml-1.5 font-normal text-muted-foreground">{note}</span>}
    </span>
  )
}

function TrafficCell({
  icon,
  color,
  label,
  data,
}: {
  icon: LucideIcon
  color: string
  label: string
  data: AdminBandwidthDTO
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <StatsIconChip icon={icon} color={color} size="sm" />
        <span className="min-w-0 truncate text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 truncate font-heading text-xl font-bold tabular-nums">
        {data.current || '—'}
      </p>
      <p className="mt-0.5 truncate text-xs">
        <TrafficDelta value={data.difference} />
      </p>
    </div>
  )
}

function PlainCell({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: LucideIcon
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 truncate text-[13px] text-muted-foreground">{label}</span>
      </div>
      <p
        className={cn(
          'mt-1 truncate text-[22px] font-semibold tabular-nums',
          muted && 'text-muted-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function formatGiB(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`
}

function formatUptime(seconds: number, t: TFunction): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return t('admin.overview.uptimeDays', { days, hours })
  return t('admin.overview.uptimeHours', { hours })
}
