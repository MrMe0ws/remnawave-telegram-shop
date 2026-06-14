import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface AdminShellContextValue {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  openMobileNav: () => void
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null)

export function AdminShellProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const openMobileNav = useCallback(() => setMobileNavOpen(true), [])

  return (
    <AdminShellContext.Provider value={{ mobileNavOpen, setMobileNavOpen, openMobileNav }}>
      {children}
    </AdminShellContext.Provider>
  )
}

export function useAdminShell() {
  const ctx = useContext(AdminShellContext)
  if (!ctx) {
    throw new Error('useAdminShell must be used within AdminShellProvider')
  }
  return ctx
}
