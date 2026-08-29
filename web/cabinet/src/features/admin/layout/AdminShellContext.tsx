import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

import { getAdminMobileNavWidthPx } from './adminMobileNav'

const NAV_ANIM_MS = 300

interface AdminShellContextValue {
  mobileNavOpen: boolean
  mobileNavOffsetPx: number
  mobileNavDragging: boolean
  openMobileNav: () => void
  closeMobileNav: () => void
  toggleMobileNav: () => void
  /** Шторка видна пользователю (панель выдвинута), а не «помечена открытой». */
  mobileNavExpanded: boolean
  setMobileNavDrag: (offsetPx: number) => void
  commitMobileNavDrag: (offsetPx: number) => void
  mobileHeaderVisible: boolean
  setMobileHeaderVisible: (visible: boolean) => void
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null)

export function AdminShellProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileNavOffsetPx, setMobileNavOffsetPx] = useState(0)
  const [mobileNavDragging, setMobileNavDragging] = useState(false)
  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true)

  const closeMobileNav = useCallback(() => {
    setMobileNavDragging(false)
    setMobileNavOffsetPx(0)
    window.setTimeout(() => setMobileNavOpen(false), NAV_ANIM_MS)
  }, [])

  const openMobileNav = useCallback(() => {
    const width = getAdminMobileNavWidthPx()
    setMobileNavDragging(false)
    setMobileNavOpen(true)
    setMobileNavOffsetPx(0)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setMobileNavOffsetPx(width))
    })
  }, [])

  // Кнопка в шапке должна и закрывать шторку, а не только открывать.
  // Условие — по смещению панели, а не по mobileNavOpen: во время анимации
  // закрытия флаг ещё true, хотя панель уже уехала, и повторный тап тогда
  // «закрывал» бы уже закрытое вместо того, чтобы открыть заново.
  const toggleMobileNav = useCallback(() => {
    if (mobileNavOffsetPx > 0) {
      closeMobileNav()
      return
    }
    openMobileNav()
  }, [mobileNavOffsetPx, closeMobileNav, openMobileNav])

  const setMobileNavDrag = useCallback((offsetPx: number) => {
    const width = getAdminMobileNavWidthPx()
    const clamped = Math.min(Math.max(offsetPx, 0), width)
    setMobileNavDragging(true)
    setMobileNavOpen(true)
    setMobileNavOffsetPx(clamped)
  }, [])

  const commitMobileNavDrag = useCallback(
    (offsetPx: number) => {
      const width = getAdminMobileNavWidthPx()
      const shouldOpen = offsetPx >= width * 0.35
      setMobileNavDragging(false)
      if (shouldOpen) {
        setMobileNavOpen(true)
        setMobileNavOffsetPx(width)
        return
      }
      closeMobileNav()
    },
    [closeMobileNav],
  )

  return (
    <AdminShellContext.Provider
      value={{
        mobileNavOpen,
        mobileNavOffsetPx,
        mobileNavDragging,
        openMobileNav,
        closeMobileNav,
        toggleMobileNav,
        mobileNavExpanded: mobileNavOffsetPx > 0,
        setMobileNavDrag,
        commitMobileNavDrag,
        mobileHeaderVisible,
        setMobileHeaderVisible,
      }}
    >
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
