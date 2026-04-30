import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Home,
  Sparkles,
  Zap,
  MessageCircle,
  User,
  Menu,
  CreditCard,
  TicketPercent,
  Info,
  Users,
  LogOut,
} from 'lucide-react'

import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { LangToggle } from './LangToggle'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface AppLayoutProps {
  children: ReactNode
}

type NavItem = {
  to: string
  icon: typeof Home
  labelKey: string
  /** Доп. пути, при которых считаем пункт активным (например /connections → подписка). */
  activePrefixes?: string[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: Home, labelKey: 'nav.dashboard' },
  { to: '/subscription', icon: Sparkles, labelKey: 'nav.subscription', activePrefixes: ['/connections'] },
  { to: '/tariffs', icon: Zap, labelKey: 'nav.tariffs' },
  { to: '/support', icon: MessageCircle, labelKey: 'nav.support' },
  { to: '/profile', icon: User, labelKey: 'nav.profile', activePrefixes: ['/accounts', '/link'] },
]

const overflowNavItems: { to: string; icon: typeof CreditCard; labelKey: string }[] = [
  { to: '/payments', icon: CreditCard, labelKey: 'nav.payments' },
  { to: '/promocodes', icon: TicketPercent, labelKey: 'nav.promocodes' },
  { to: '/info', icon: Info, labelKey: 'nav.info' },
  { to: '/referral', icon: Users, labelKey: 'nav.referral' },
]

function navItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.to) return true
  if (item.activePrefixes) {
    return item.activePrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  }
  return pathname.startsWith(`${item.to}/`)
}

function overflowActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      <header className="z-50 isolate shrink-0 border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-2 px-2.5 py-2 sm:gap-4 sm:px-3 sm:py-2">
          <Link
            to="/dashboard"
            className="flex min-w-0 shrink-0 items-center rounded-md outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Logo size="sm" />
          </Link>

          <nav
            className="hidden sm:flex flex-1 items-center justify-center gap-0.5 min-w-0 overflow-x-auto py-0.5"
            aria-label={t('nav.main')}
          >
            {navItems.map(({ to, icon: Icon, labelKey, activePrefixes }) => {
              const active = navItemActive(location.pathname, { to, icon: Icon, labelKey, activePrefixes })
              const label = t(labelKey)
              return (
                <Button
                  key={`${to}-${labelKey}`}
                  variant="ghost"
                  size="icon"
                  asChild
                  title={label}
                  className={cn(
                    'shrink-0 size-9 rounded-lg text-muted-foreground hover:text-foreground',
                    active && 'bg-secondary text-foreground',
                  )}
                >
                  <Link to={to} aria-current={active ? 'page' : undefined} aria-label={label}>
                    <Icon className="size-[18px]" strokeWidth={1.75} />
                  </Link>
                </Button>
              )
            })}
          </nav>

          <div className="flex items-center gap-0.5 sm:gap-1 ml-auto shrink-0">
            <LangToggle />
            <ThemeToggle />
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label={t('nav.moreMenu')}
                title={t('nav.moreMenu')}
                className="size-9"
                onClick={() => setMenuOpen((o) => !o)}
              >
                <Menu className="size-[18px]" strokeWidth={1.75} />
              </Button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 min-w-[11rem] rounded-lg border border-border bg-card py-1 shadow-2xl z-[500] ring-1 ring-border/60"
                >
                  {overflowNavItems.map(({ to, icon: Icon, labelKey }) => {
                    const label = t(labelKey)
                    const active = overflowActive(location.pathname, to)
                    return (
                      <Link
                        key={to}
                        to={to}
                        role="menuitem"
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted',
                          active && 'bg-secondary',
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                        {label}
                      </Link>
                    )
                  })}
                  <div className="my-1 border-t border-border/70" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setMenuOpen(false)
                      logout()
                    }}
                  >
                    <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
                    {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden touch-pan-y">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8 animate-fade-in pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-8 [&>*]:mx-auto [&>*]:w-full">
          {children}
        </div>
      </div>

      <nav
        className="z-50 shrink-0 border-t border-border bg-card/95 backdrop-blur-md sm:hidden pb-[max(0.35rem,env(safe-area-inset-bottom))]"
        aria-label={t('nav.mobile')}
      >
        <div className="flex items-stretch justify-around gap-0 overflow-x-auto px-1 py-1.5">
          {navItems.map(({ to, icon: Icon, labelKey, activePrefixes }) => {
            const active = navItemActive(location.pathname, { to, icon: Icon, labelKey, activePrefixes })
            const label = t(labelKey)
            return (
              <Link
                key={`${to}-${labelKey}-mob`}
                to={to}
                title={label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 max-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-muted-foreground transition-colors',
                  active && 'bg-secondary text-foreground',
                )}
              >
                <Icon className="size-[20px] shrink-0" strokeWidth={1.75} />
                <span className="w-full text-center text-[10px] leading-tight font-medium truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
