import { type ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
  LayoutDashboard,
  ChevronLeft,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAdminBootstrap } from '../hooks/useAdminBootstrap'
import { AdminChrome } from './AdminChrome'
import { AdminBreadcrumbs } from './AdminBreadcrumbs'
import { AdminPageMetaContext, type AdminPageMeta } from './useAdminPageMeta'
import { AdminShellProvider, useAdminShell } from './AdminShellContext'
import { useAdminLeftEdgeSwipe } from '../hooks/useAdminLeftEdgeSwipe'
import { useAdminMobileNavWidth } from '../hooks/useAdminMobileNavWidth'

interface AdminLayoutProps {
  children: ReactNode
}

interface AdminNavItem {
  to: string
  icon: LucideIcon
  labelKey: string
  condition?: boolean
}

interface AdminNavGroup {
  labelKey: string
  items: AdminNavItem[]
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminShellProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminShellProvider>
  )
}

function AdminLayoutInner({ children }: AdminLayoutProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { data: bootstrap } = useAdminBootstrap()
  const {
    mobileNavOpen,
    mobileNavOffsetPx,
    mobileNavDragging,
    closeMobileNav,
    mobileHeaderVisible,
  } = useAdminShell()
  const panelWidth = useAdminMobileNavWidth()
  const navProgress = panelWidth > 0 ? Math.min(1, mobileNavOffsetPx / panelWidth) : 0
  const navLayerVisible = mobileNavOpen || mobileNavOffsetPx > 0
  const [pageMeta, setPageMeta] = useState<AdminPageMeta>({})

  useAdminLeftEdgeSwipe(true)

  const salesModeTariffs = bootstrap?.sales_mode === 'tariffs'
  const loyaltyEnabled = bootstrap?.loyalty_enabled ?? false

  const navGroups: AdminNavGroup[] = [
    {
      labelKey: 'admin.nav.group.overview',
      items: [
        { to: '/admin', icon: LayoutDashboard, labelKey: 'admin.nav.dashboard' },
        { to: '/admin/stats', icon: BarChart3, labelKey: 'admin.nav.stats' },
      ],
    },
    {
      labelKey: 'admin.nav.group.clients',
      items: [
        { to: '/admin/users', icon: Users, labelKey: 'admin.nav.users' },
        { to: '/admin/promos', icon: TicketPercent, labelKey: 'admin.nav.promos' },
        { to: '/admin/broadcast', icon: Megaphone, labelKey: 'admin.nav.broadcast' },
      ],
    },
    {
      labelKey: 'admin.nav.group.commerce',
      items: [
        { to: '/admin/tariffs', icon: Zap, labelKey: 'admin.nav.tariffs', condition: salesModeTariffs },
        { to: '/admin/loyalty', icon: Gem, labelKey: 'admin.nav.loyalty', condition: loyaltyEnabled },
      ],
    },
    {
      labelKey: 'admin.nav.group.system',
      items: [
        { to: '/admin/infra', icon: Server, labelKey: 'admin.nav.infra' },
        { to: '/admin/sync', icon: RefreshCw, labelKey: 'admin.nav.sync' },
      ],
    },
  ]

  function isActive(to: string): boolean {
    if (to === '/admin') return location.pathname === '/admin'
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  const sidebarContent = (
    <>
      <div className="mb-6 flex items-center gap-2.5 px-1">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 dark:bg-primary/25">
          <ShieldCheck className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{t('admin.dashboard.title')}</p>
          <p className="truncate text-xs text-muted-foreground">{t('admin.dashboard.subtitle')}</p>
        </div>
      </div>

      <nav className="space-y-5" aria-label={t('admin.nav.label')}>
        {navGroups.map((group) => {
          const visible = group.items.filter((item) => item.condition !== false)
          if (visible.length === 0) return null
          return (
            <div key={group.labelKey}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t(group.labelKey)}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.to)
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={closeMobileNav}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary/12 text-primary shadow-sm dark:bg-primary/20'
                            : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                        )}
                      >
                        <Icon className={cn('size-4 shrink-0', active && 'text-primary')} />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-border/50 pt-4">
        <Link
          to="/dashboard"
          onClick={closeMobileNav}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {t('admin.backToCabinet')}
        </Link>
      </div>
    </>
  )

  return (
    <AdminPageMetaContext.Provider value={{ setMeta: setPageMeta }}>
      <AdminChrome>
        <div className="admin-shell relative z-[1] mx-auto w-full max-w-7xl px-3 pb-8 pt-2 sm:px-4 sm:pt-4">
          <div
            className={cn(
              'fixed inset-0 z-[210] lg:hidden',
              !navLayerVisible && 'pointer-events-none',
            )}
            aria-hidden={!navLayerVisible}
          >
            <div
              className={cn(
                'absolute inset-0 bg-black/50 backdrop-blur-sm',
                !mobileNavDragging && 'transition-opacity duration-300 ease-out',
              )}
              style={{ opacity: navProgress }}
              onClick={closeMobileNav}
            />
            <aside
              className={cn(
                'absolute bottom-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-background p-4 shadow-xl will-change-transform',
                !mobileNavDragging && 'transition-[transform,top] duration-300 ease-out',
                mobileHeaderVisible ? 'top-14' : 'top-0',
              )}
              style={{ transform: `translateX(${mobileNavOffsetPx - panelWidth}px)` }}
            >
              <button
                type="button"
                onClick={closeMobileNav}
                className="mb-4 self-end rounded-lg p-2 hover:bg-accent"
                aria-label={t('common.close')}
              >
                <X className="size-5" />
              </button>
              {sidebarContent}
            </aside>
          </div>

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-4">
            <AdminBreadcrumbs pathname={location.pathname} pageMeta={pageMeta} className="lg:col-start-2 lg:row-start-1" />

            <aside className="hidden w-56 shrink-0 lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
              <div className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm">
                {sidebarContent}
              </div>
            </aside>

            <main className="relative z-[1] min-w-0 lg:col-start-2 lg:row-start-2">
              {children}
            </main>
          </div>
        </div>
      </AdminChrome>
    </AdminPageMetaContext.Provider>
  )
}
