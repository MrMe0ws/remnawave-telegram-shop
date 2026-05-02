import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { LangToggle } from './LangToggle'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className={`flex items-center px-4 py-2 sm:px-5 sm:py-2.5 ${showHeaderLogo ? 'justify-between' : 'justify-end'}`}>
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
      </header>

      {/* Centered card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm animate-fade-in">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {footerName}
      </footer>
    </div>
  )
}
