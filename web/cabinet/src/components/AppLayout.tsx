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
  X,
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
  { to: '/info', icon: Info, labelKey: 'nav.info' },
  { to: '/profile', icon: User, labelKey: 'nav.profile', activePrefixes: ['/accounts', '/link'] },
]

const mobileBottomNavItems: NavItem[] = [
  { to: '/dashboard', icon: Home, labelKey: 'nav.dashboard' },
  { to: '/subscription', icon: Sparkles, labelKey: 'nav.subscription', activePrefixes: ['/connections'] },
  { to: '/tariffs', icon: Zap, labelKey: 'nav.tariffs' },
  { to: '/support', icon: MessageCircle, labelKey: 'nav.support' },
  { to: '/profile', icon: User, labelKey: 'nav.profile', activePrefixes: ['/accounts', '/link'] },
]

const overflowNavItems: { to: string; icon: typeof CreditCard; labelKey: string }[] = [
  { to: '/dashboard', icon: Home, labelKey: 'nav.dashboard' },
  { to: '/subscription', icon: Sparkles, labelKey: 'nav.subscription' },
  { to: '/tariffs', icon: Zap, labelKey: 'nav.tariffs' },
  { to: '/support', icon: MessageCircle, labelKey: 'nav.support' },
  { to: '/info', icon: Info, labelKey: 'nav.info' },
  { to: '/profile', icon: User, labelKey: 'nav.profile' },
  { to: '/promocodes', icon: TicketPercent, labelKey: 'nav.promocodes' },
  { to: '/referral', icon: Users, labelKey: 'nav.referral' },
  { to: '/payments', icon: CreditCard, labelKey: 'nav.payments' },
  { to: '/loyalty', icon: Sparkles, labelKey: 'nav.loyalty' },
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

/** Активный пункт в выпадающем меню и нижней мобильной навигации (как у текста ссылки). */
const navAccentActiveClass = 'text-[rgb(2,132,199)] dark:text-[rgb(81,193,245)]'

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    if (!window.matchMedia('(min-width: 640px)').matches) return
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

  useEffect(() => {
    if (!menuOpen) return
    if (window.matchMedia('(min-width: 640px)').matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  useEffect(() => {
    if (!logoutConfirmOpen) return
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setLogoutConfirmOpen(false)
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [logoutConfirmOpen])

  function requestLogoutConfirm() {
    setMenuOpen(false)
    setLogoutConfirmOpen(true)
  }

  function confirmLogout() {
    setLogoutConfirmOpen(false)
    logout()
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      <header className="z-50 isolate shrink-0 border-b border-border bg-card/60 backdrop-blur-sm shadow-[0_4px_30px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.05)]">
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
              const isTariffs = to === '/tariffs'
              const label = t(labelKey)
              return (
                <Button
                  key={`${to}-${labelKey}`}
                  variant="ghost"
                  size="sm"
                  asChild
                  className={cn(
                    'group shrink-0 h-9 !gap-1 rounded-xl px-2 text-muted-foreground hover:text-foreground transition-all duration-500',
                    active && 'bg-secondary text-foreground shadow-sm',
                  )}
                >
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    aria-label={label}
                    className="flex items-center"
                  >
                    <Icon
                      className={cn(
                        'size-[18px]',
                        active ? 'text-foreground' : 'text-muted-foreground',
                        isTariffs && !active && 'tariffs-shine-icon',
                      )}
                      strokeWidth={1.75}
                    />
                    <span
                      className={cn(
                        'max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-500',
                        'group-hover:max-w-[9rem] group-hover:opacity-100',
                      )}
                    >
                      {label}
                    </span>
                  </Link>
                </Button>
              )
            })}
          </nav>

          <div className="flex items-center gap-0.5 sm:gap-1 ml-auto shrink-0">
            <LangToggle className="h-10 px-4" />
            <ThemeToggle className="size-10 [&_svg]:size-[18px]" />
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label={t('nav.moreMenu')}
                title={t('nav.moreMenu')}
                className="size-10"
                onClick={() => setMenuOpen((o) => !o)}
              >
                {menuOpen ? <X className="size-[18px]" strokeWidth={1.75} /> : <Menu className="size-[18px]" strokeWidth={1.75} />}
              </Button>
              {menuOpen && (
                <div
                  role="menu"
                  className="hidden sm:block absolute right-0 top-full mt-1.5 min-w-[14rem] rounded-lg border border-border bg-card py-1 shadow-2xl z-[500] ring-1 ring-border/60"
                >
                  {overflowNavItems.map(({ to, icon: Icon, labelKey }) => {
                    const label = t(labelKey)
                    const active = overflowActive(location.pathname, to)
                    const isTariffs = to === '/tariffs'
                    return (
                      <Link
                        key={to}
                        to={to}
                        role="menuitem"
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-muted dark:text-slate-300',
                          active && cn('bg-secondary', navAccentActiveClass),
                        )}
                      >
                        <Icon
                          className={cn(
                            'size-4 shrink-0',
                            !active && 'text-muted-foreground',
                            isTariffs && !active && 'tariffs-shine-icon',
                            active && navAccentActiveClass,
                          )}
                          strokeWidth={1.75}
                        />
                        {label}
                      </Link>
                    )
                  })}
                  <div className="my-1 border-t border-border/70" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    onClick={requestLogoutConfirm}
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

      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[56px] z-40 flex min-h-0 flex-col bg-background sm:hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border bg-background">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background pt-2 pb-[calc(5.75rem+env(safe-area-inset-bottom))]">
              {overflowNavItems.map(({ to, icon: Icon, labelKey }) => {
                const label = t(labelKey)
                const active = overflowActive(location.pathname, to)
                const isTariffs = to === '/tariffs'
                return (
                  <Link
                    key={`mobile-${to}`}
                    to={to}
                    role="menuitem"
                    className={cn(
                      'flex items-center gap-3 pl-8 pr-4 py-3 text-base text-slate-700 hover:bg-muted dark:text-slate-300',
                      active && cn('bg-secondary', navAccentActiveClass),
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-5 shrink-0',
                        !active && 'text-muted-foreground',
                        isTariffs && !active && 'tariffs-shine-icon',
                        active && navAccentActiveClass,
                      )}
                      strokeWidth={1.75}
                    />
                    {label}
                  </Link>
                )
              })}
              <div className="my-1 mx-4 border-t border-border/70" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 pl-8 pr-4 py-3 text-base text-destructive hover:bg-destructive/10"
                onClick={requestLogoutConfirm}
              >
                <LogOut className="size-5 shrink-0" strokeWidth={1.75} />
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {logoutConfirmOpen && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setLogoutConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-background/95 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-base font-medium text-foreground">{t('nav.logoutConfirmTitle')}</p>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setLogoutConfirmOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={confirmLogout}>
                {t('nav.logoutConfirmYes')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden touch-pan-y">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8 animate-fade-in pb-[max(1rem,calc(5.75rem+env(safe-area-inset-bottom)))] sm:pb-8 [&>*]:mx-auto [&>*]:w-full">
          {children}
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 sm:hidden px-2 pb-2 pointer-events-none"
        aria-label={t('nav.mobile')}
      >
        <div className="pointer-events-auto flex items-stretch justify-around gap-0 overflow-x-auto rounded-2xl border border-border bg-card/95 px-1 py-1.5 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          {mobileBottomNavItems.map(({ to, icon: Icon, labelKey, activePrefixes }) => {
            const active = navItemActive(location.pathname, { to, icon: Icon, labelKey, activePrefixes })
            const label = t(labelKey)
            const isTariffs = to === '/tariffs'
            return (
              <Link
                key={`${to}-${labelKey}-mob`}
                to={to}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 max-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-muted-foreground transition-colors',
                  active && cn('bg-secondary', navAccentActiveClass),
                )}
              >
                <Icon
                  className={cn(
                    'size-[20px] shrink-0',
                    !active && 'text-muted-foreground',
                    isTariffs && !active && 'tariffs-shine-icon',
                    active && navAccentActiveClass,
                  )}
                  strokeWidth={1.75}
                />
                <span className="w-full text-center text-[10px] leading-tight font-medium truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
