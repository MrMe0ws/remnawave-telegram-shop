import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
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
  TicketPercent,
  Users,
  Gift,
  LogOut,
} from 'lucide-react'

import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { LangToggle } from './LangToggle'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { useAuthStore } from '@/store/auth'
import { CabinetOnboarding } from '@/features/onboarding/CabinetOnboarding'
import { useSupportSummary } from '@/features/support/useSupportChat'

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

const mobileBottomNavItems: NavItem[] = [
  { to: '/dashboard', icon: Home, labelKey: 'nav.dashboard' },
  { to: '/subscription', icon: Sparkles, labelKey: 'nav.subscription', activePrefixes: ['/connections'] },
  { to: '/tariffs', icon: Zap, labelKey: 'nav.tariffs' },
  { to: '/support', icon: MessageCircle, labelKey: 'nav.support' },
  { to: '/profile', icon: User, labelKey: 'nav.profile', activePrefixes: ['/accounts', '/link'] },
]

const overflowNavMainItems: { to: string; icon: typeof Home; labelKey: string }[] = [
  { to: '/dashboard', icon: Home, labelKey: 'nav.dashboard' },
  { to: '/subscription', icon: Sparkles, labelKey: 'nav.subscription' },
  { to: '/tariffs', icon: Zap, labelKey: 'nav.tariffs' },
  { to: '/support', icon: MessageCircle, labelKey: 'nav.support' },
  { to: '/promocodes', icon: TicketPercent, labelKey: 'nav.promocodes' },
  { to: '/referral', icon: Users, labelKey: 'nav.referral' },
  { to: '/fortune', icon: Gift, labelKey: 'nav.fortune' },
]

const overflowNavProfileItem: { to: string; icon: typeof User; labelKey: string; activePrefixes: string[] } = {
  to: '/profile',
  icon: User,
  labelKey: 'nav.profile',
  activePrefixes: ['/accounts', '/link'],
}

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

function profileNavActive(pathname: string): boolean {
  if (pathname === overflowNavProfileItem.to) return true
  return overflowNavProfileItem.activePrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Активный пункт в выпадающем меню и нижней мобильной навигации (как у текста ссылки). */
const navAccentActiveClass = 'text-[rgb(2,132,199)] dark:text-[rgb(81,193,245)]'

function NavIconWithDot({ showDot, children }: { showDot: boolean; children: ReactNode }) {
  return (
    <span className="relative inline-flex">
      {children}
      {showDot ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-card" aria-hidden /> : null}
    </span>
  )
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { data: bootstrap } = useAuthBootstrap()
  const overflowMainNav = useMemo(() => {
    if (bootstrap?.fortune_nav_visible === false) {
      return overflowNavMainItems.filter((item) => item.to !== '/fortune')
    }
    return overflowNavMainItems
  }, [bootstrap?.fortune_nav_visible])
  const logout = useAuthStore((s) => s.logout)
  const supportChatEnabled = Boolean(bootstrap?.support_chat_enabled)
  const { data: supportSummary } = useSupportSummary(supportChatEnabled, 60_000)
  const supportUnread = supportSummary?.unread_count ?? 0
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [mobileChromeVisible, setMobileChromeVisible] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  const lastScrollYRef = useRef(0)
  const scrollTickingRef = useRef(false)
  const lastTouchYRef = useRef<number | null>(null)

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
  }, [location.pathname, location.hash])

  useEffect(() => {
    setMobileChromeVisible(true)
  }, [location.pathname])

  useEffect(() => {
    const mobileMq = window.matchMedia('(max-width: 639px)')

    function updateMobileChromeVisibility() {
      const y = window.scrollY
      const prevY = lastScrollYRef.current
      const delta = y - prevY
      const nearTop = y <= 8

      if (!mobileMq.matches) {
        setMobileChromeVisible((prev) => (prev ? prev : true))
        lastScrollYRef.current = y
        scrollTickingRef.current = false
        return
      }

      if (nearTop || delta < -4) {
        setMobileChromeVisible(true)
      } else if (delta > 6 && y > 40) {
        setMobileChromeVisible(false)
      }

      lastScrollYRef.current = y
      scrollTickingRef.current = false
    }

    function onScroll() {
      if (scrollTickingRef.current) return
      scrollTickingRef.current = true
      window.requestAnimationFrame(updateMobileChromeVisibility)
    }

    function onResize() {
      lastScrollYRef.current = window.scrollY
      setMobileChromeVisible(true)
    }

    function onTouchStart(e: TouchEvent) {
      if (!mobileMq.matches) return
      lastTouchYRef.current = e.touches[0]?.clientY ?? null
    }

    function onTouchMove(e: TouchEvent) {
      if (!mobileMq.matches) return
      const currentY = e.touches[0]?.clientY
      const prevY = lastTouchYRef.current
      if (currentY == null || prevY == null) return
      const deltaY = currentY - prevY
      if (deltaY > 6) {
        // Пользователь скроллит страницу вверх: сразу возвращаем шапку сайта,
        // даже если window.scrollY ещё почти не изменился из-за анимации браузера.
        setMobileChromeVisible(true)
      }
      lastTouchYRef.current = currentY
    }

    lastScrollYRef.current = window.scrollY
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

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
    <div className="relative flex min-h-dvh flex-col">
      <div className="cabinet-shell-gradient" aria-hidden />
      <header
        className={cn(
          'sticky top-0 z-50 isolate shrink-0 border-b border-border bg-card/60 backdrop-blur-sm shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] transition-transform duration-300 will-change-transform',
          !mobileChromeVisible && !menuOpen && 'max-sm:-translate-y-full',
        )}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-2 px-2.5 py-2 sm:gap-4 sm:px-3 sm:py-2">
          <Link
            to="/dashboard"
            className="flex min-w-0 shrink-0 items-center rounded-md outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Logo size="sm" />
          </Link>

          <nav
            className="hidden sm:flex flex-1 items-center justify-start gap-0.5 min-w-0 overflow-x-auto py-0.5"
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
                    'group shrink-0 h-9 !gap-1 rounded-xl px-2 text-muted-foreground hover:text-foreground transition-all duration-200',
                    active && 'bg-secondary text-foreground shadow-sm',
                  )}
                >
                  <Link
                    to={to}
                    id={to === '/profile' ? 'cabinet-onboarding-profile-nav-desktop' : undefined}
                    aria-current={active ? 'page' : undefined}
                    aria-label={label}
                    className="flex items-center"
                  >
                    <NavIconWithDot showDot={to === '/support' && supportUnread > 0}>
                      <Icon
                        className={cn(
                          'size-[18px]',
                          active ? 'text-foreground' : 'text-muted-foreground',
                          isTariffs && !active && 'tariffs-shine-icon',
                        )}
                        strokeWidth={1.75}
                      />
                    </NavIconWithDot>
                    <span
                      className={cn(
                        'max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-200',
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
                  className="hidden sm:block absolute right-0 top-full mt-1.5 min-w-[14rem] rounded-lg border border-border bg-card py-1 shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] z-[500] ring-1 ring-border/60"
                >
                  {overflowMainNav.map(({ to, icon: Icon, labelKey }) => {
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
                  {(() => {
                    const { to, icon: Icon, labelKey } = overflowNavProfileItem
                    const label = t(labelKey)
                    const active = profileNavActive(location.pathname)
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
                            active && navAccentActiveClass,
                          )}
                          strokeWidth={1.75}
                        />
                        {label}
                      </Link>
                    )
                  })()}
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
              {overflowMainNav.map(({ to, icon: Icon, labelKey }) => {
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
              {(() => {
                const { to, icon: Icon, labelKey } = overflowNavProfileItem
                const label = t(labelKey)
                const active = profileNavActive(location.pathname)
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
                        active && navAccentActiveClass,
                      )}
                      strokeWidth={1.75}
                    />
                    {label}
                  </Link>
                )
              })()}
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
            className="w-full max-w-sm rounded-2xl border border-border bg-background/95 p-4 shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)]"
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

      <div className="min-h-0 flex-1 overflow-x-hidden touch-pan-y">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8 animate-fade-in pb-[max(1rem,calc(5.75rem+env(safe-area-inset-bottom)))] sm:pb-8 [&>*]:mx-auto [&>*]:w-full">
          {children}
        </div>
      </div>

      <CabinetOnboarding />

      <nav
        className="fixed inset-x-0 bottom-0 z-50 sm:hidden px-2 pb-2 pointer-events-none"
        aria-label={t('nav.mobile')}
      >
        <div className="pointer-events-auto flex items-stretch justify-around gap-0 overflow-x-auto rounded-2xl border border-border bg-card/95 px-1 py-1.5 backdrop-blur-md shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)]">
          {mobileBottomNavItems.map(({ to, icon: Icon, labelKey, activePrefixes }) => {
            const active = navItemActive(location.pathname, { to, icon: Icon, labelKey, activePrefixes })
            const label = t(labelKey)
            const isTariffs = to === '/tariffs'
            return (
              <Link
                key={`${to}-${labelKey}-mob`}
                to={to}
                id={to === '/profile' ? 'cabinet-onboarding-profile-nav-mobile' : undefined}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 max-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-muted-foreground transition-colors',
                  active && cn('bg-secondary', navAccentActiveClass),
                )}
              >
                <NavIconWithDot showDot={to === '/support' && supportUnread > 0}>
                  <Icon
                    className={cn(
                      'size-[20px] shrink-0',
                      !active && 'text-muted-foreground',
                      isTariffs && !active && 'tariffs-shine-icon',
                      active && navAccentActiveClass,
                    )}
                    strokeWidth={1.75}
                  />
                </NavIconWithDot>
                <span className="w-full text-center text-[10px] leading-tight font-medium truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
