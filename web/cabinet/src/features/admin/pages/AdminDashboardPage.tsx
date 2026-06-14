import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Users,
  TicketPercent,
  Zap,
  Gem,
  Megaphone,
  Server,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { cn } from '@/lib/utils'
import { useAdminBootstrap } from '../hooks/useAdminBootstrap'

interface DashAccent {
  /** RGB triplet for gradient border, e.g. "59 130 246" */
  from: string
  to: string
  glow: string
}

interface QuickLink {
  to: string
  icon: LucideIcon
  titleKey: string
  descKey: string
  bg: string
  iconBg: string
  accent: DashAccent
  condition?: boolean
}

export default function AdminDashboardPage() {
  const { t } = useTranslation()
  const { data: bootstrap } = useAdminBootstrap()

  const salesModeTariffs = bootstrap?.sales_mode === 'tariffs'
  const loyaltyEnabled = bootstrap?.loyalty_enabled ?? false

  const links: QuickLink[] = [
    {
      to: '/admin/stats',
      icon: BarChart3,
      titleKey: 'admin.nav.stats',
      descKey: 'admin.dashboard.linkStats',
      bg: 'from-blue-500/12 via-cyan-500/6 to-card',
      iconBg: 'bg-blue-500/12 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
      accent: { from: '59 130 246', to: '34 211 238', glow: '59 130 246' },
    },
    {
      to: '/admin/users',
      icon: Users,
      titleKey: 'admin.nav.users',
      descKey: 'admin.dashboard.linkUsers',
      bg: 'from-violet-500/12 via-purple-500/6 to-card',
      iconBg: 'bg-violet-500/12 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
      accent: { from: '139 92 246', to: '168 85 247', glow: '139 92 246' },
    },
    {
      to: '/admin/promos',
      icon: TicketPercent,
      titleKey: 'admin.nav.promos',
      descKey: 'admin.dashboard.linkPromos',
      bg: 'from-amber-500/12 via-orange-500/6 to-card',
      iconBg: 'bg-amber-500/12 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
      accent: { from: '245 158 11', to: '249 115 22', glow: '245 158 11' },
    },
    {
      to: '/admin/tariffs',
      icon: Zap,
      titleKey: 'admin.nav.tariffs',
      descKey: 'admin.dashboard.linkTariffs',
      bg: 'from-emerald-500/12 via-teal-500/6 to-card',
      iconBg: 'bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      accent: { from: '16 185 129', to: '20 184 166', glow: '16 185 129' },
      condition: salesModeTariffs,
    },
    {
      to: '/admin/loyalty',
      icon: Gem,
      titleKey: 'admin.nav.loyalty',
      descKey: 'admin.dashboard.linkLoyalty',
      bg: 'from-rose-500/12 via-pink-500/6 to-card',
      iconBg: 'bg-rose-500/12 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
      accent: { from: '244 63 94', to: '236 72 153', glow: '244 63 94' },
      condition: loyaltyEnabled,
    },
    {
      to: '/admin/broadcast',
      icon: Megaphone,
      titleKey: 'admin.nav.broadcast',
      descKey: 'admin.dashboard.linkBroadcast',
      bg: 'from-indigo-500/12 via-blue-500/6 to-card',
      iconBg: 'bg-indigo-500/12 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
      accent: { from: '99 102 241', to: '59 130 246', glow: '99 102 241' },
    },
    {
      to: '/admin/infra',
      icon: Server,
      titleKey: 'admin.nav.infra',
      descKey: 'admin.dashboard.linkInfra',
      bg: 'from-slate-500/12 via-zinc-500/6 to-card',
      iconBg: 'bg-slate-500/12 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
      accent: { from: '100 116 139', to: '161 161 170', glow: '100 116 139' },
    },
    {
      to: '/admin/sync',
      icon: RefreshCw,
      titleKey: 'admin.nav.sync',
      descKey: 'admin.dashboard.linkSync',
      bg: 'from-cyan-500/12 via-sky-500/6 to-card',
      iconBg: 'bg-cyan-500/12 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
      accent: { from: '6 182 212', to: '14 165 233', glow: '6 182 212' },
    },
  ]

  const visible = links.filter((l) => l.condition !== false)

  return (
    <AdminLayout>
      <div className="space-y-8">
        <AdminPageHeader
          icon={ShieldCheck}
          title={t('admin.dashboard.title')}
          subtitle={t('admin.dashboard.subtitle')}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((link) => {
            const Icon = link.icon
            const accentStyle = {
              '--dash-accent-from': link.accent.from,
              '--dash-accent-to': link.accent.to,
              '--dash-accent-glow': link.accent.glow,
            } as CSSProperties

            return (
              <Link
                key={link.to}
                to={link.to}
                className="admin-dash-link group"
                style={accentStyle}
              >
                <div className="admin-dash-card-frame">
                  <div
                    className={cn(
                      'admin-dash-card-inner bg-gradient-to-br p-5 text-card-foreground',
                      link.bg,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          'flex size-10 items-center justify-center rounded-lg backdrop-blur-sm transition-transform duration-300 ease-out motion-safe:group-hover:scale-110',
                          link.iconBg,
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-300 ease-out motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:opacity-100"
                        aria-hidden
                      />
                    </div>
                    <h3 className="mt-4 font-semibold transition-colors duration-300 group-hover:text-foreground">
                      {t(link.titleKey)}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground transition-colors duration-300 group-hover:text-muted-foreground/90">
                      {t(link.descKey)}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </AdminLayout>
  )
}
