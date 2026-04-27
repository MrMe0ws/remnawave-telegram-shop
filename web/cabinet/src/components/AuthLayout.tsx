import { ReactNode } from 'react'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { LangToggle } from './LangToggle'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

interface AuthLayoutProps {
  children: ReactNode
}

const defaultBrand = 'Cabinet'

export function AuthLayout({ children }: AuthLayoutProps) {
  const { data } = useAuthBootstrap()
  const footerName =
    (data?.brand_name?.trim() || defaultBrand).trim() || defaultBrand

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4">
        <Logo size="sm" />
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
