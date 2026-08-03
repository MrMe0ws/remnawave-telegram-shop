import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { LangToggle } from './LangToggle'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { CabinetDecorLayer } from '@/features/decor/CabinetDecorLayer'
import { CabinetDecorHeader } from '@/features/decor/CabinetDecorHeader'

interface AuthLayoutProps {
  children: ReactNode
  showHeaderLogo?: boolean
}

const defaultBrand = 'Cabinet'

export function AuthLayout({ children, showHeaderLogo = true }: AuthLayoutProps) {
  const { data } = useAuthBootstrap()
  const footerName =
    (data?.brand_name?.trim() || defaultBrand).trim() || defaultBrand

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="cabinet-shell-gradient" aria-hidden />
      <CabinetDecorLayer />
      <header className="relative z-10 cabinet-app-header px-4 pb-2 sm:px-5 sm:pb-2.5">
        <CabinetDecorHeader />
        <div
          className={`flex items-center pt-2 sm:pt-2.5 ${showHeaderLogo ? 'justify-between' : 'justify-end'}`}
        >
          {showHeaderLogo && (
            <Link
              to="/dashboard"
              className="rounded-md outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Logo size="sm" />
            </Link>
          )}
          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm animate-fade-in">
          {children}
        </div>
      </main>

      <footer className="relative z-10 px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {footerName}
      </footer>
    </div>
  )
}
