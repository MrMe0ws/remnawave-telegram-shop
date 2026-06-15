import { useEffect, useRef } from 'react'

import { useAdminShell } from '../layout/AdminShellContext'

const MOBILE_MQ = '(max-width: 767px)'
/** Заметный скролл вверх, чтобы не дёргать хедер от инерции/микродвижений. */
const SHOW_HEADER_UP_DELTA = -32
const HIDE_HEADER_DOWN_DELTA = 12
const HIDE_HEADER_MIN_Y = 64
const NEAR_TOP_Y = 12

/**
 * На мобилке прячет админ-хедер при скролле вниз и показывает при осмысленном скролле вверх.
 * Используется на странице статистики, где остаётся липкая панель периода.
 */
export function useAdminMobileHeaderAutoHide(enabled: boolean) {
  const { setMobileHeaderVisible } = useAdminShell()
  const lastScrollYRef = useRef(0)
  const scrollTickingRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      setMobileHeaderVisible(true)
      return
    }

    const mobileMq = window.matchMedia(MOBILE_MQ)

    function updateHeaderVisibility() {
      const y = window.scrollY
      const prevY = lastScrollYRef.current
      const delta = y - prevY
      const nearTop = y <= NEAR_TOP_Y

      if (!mobileMq.matches) {
        setMobileHeaderVisible(true)
        lastScrollYRef.current = y
        scrollTickingRef.current = false
        return
      }

      if (nearTop) {
        setMobileHeaderVisible(true)
      } else if (delta <= SHOW_HEADER_UP_DELTA) {
        setMobileHeaderVisible(true)
      } else if (delta >= HIDE_HEADER_DOWN_DELTA && y > HIDE_HEADER_MIN_Y) {
        setMobileHeaderVisible(false)
      }

      lastScrollYRef.current = y
      scrollTickingRef.current = false
    }

    function onScroll() {
      if (scrollTickingRef.current) return
      scrollTickingRef.current = true
      window.requestAnimationFrame(updateHeaderVisibility)
    }

    function onResize() {
      lastScrollYRef.current = window.scrollY
      setMobileHeaderVisible(true)
    }

    lastScrollYRef.current = window.scrollY
    setMobileHeaderVisible(true)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      setMobileHeaderVisible(true)
    }
  }, [enabled, setMobileHeaderVisible])
}
