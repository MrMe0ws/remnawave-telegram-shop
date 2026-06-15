import { useEffect, useRef } from 'react'

import { getAdminMobileNavWidthPx } from '../layout/adminMobileNav'
import { useAdminShell } from '../layout/AdminShellContext'

const MOBILE_MQ = '(max-width: 1023px)'
/** Не с самого края — иначе срабатывает системный жест «назад». */
const EDGE_START_MIN_PX = 20
const EDGE_START_MAX_PX = 72
const CANCEL_VERTICAL_PX = 14

/**
 * Свайп вправо из левой зоны — плавно выдвигает мобильное админ-меню.
 */
export function useAdminLeftEdgeSwipe(enabled: boolean) {
  const { setMobileNavDrag, commitMobileNavDrag, mobileNavOpen, mobileNavOffsetPx } = useAdminShell()
  const mobileNavOpenRef = useRef(mobileNavOpen)
  const mobileNavOffsetRef = useRef(mobileNavOffsetPx)
  mobileNavOpenRef.current = mobileNavOpen
  mobileNavOffsetRef.current = mobileNavOffsetPx

  const trackingRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    preventBack: false,
    lastOffset: 0,
  })

  useEffect(() => {
    if (!enabled) return

    const mobileMq = window.matchMedia(MOBILE_MQ)

    function reset() {
      trackingRef.current = {
        active: false,
        startX: 0,
        startY: 0,
        preventBack: false,
        lastOffset: 0,
      }
    }

    function isFullyOpen() {
      const width = getAdminMobileNavWidthPx()
      return mobileNavOpenRef.current && mobileNavOffsetRef.current >= width * 0.98
    }

    function onTouchStart(e: TouchEvent) {
      if (!mobileMq.matches || isFullyOpen()) return
      const touch = e.touches[0]
      if (!touch) return
      const x = touch.clientX
      if (x < EDGE_START_MIN_PX || x > EDGE_START_MAX_PX) return
      trackingRef.current = {
        active: true,
        startX: x,
        startY: touch.clientY,
        preventBack: false,
        lastOffset: 0,
      }
    }

    function onTouchMove(e: TouchEvent) {
      const state = trackingRef.current
      if (!state.active || isFullyOpen()) return
      const touch = e.touches[0]
      if (!touch) return

      const dx = touch.clientX - state.startX
      const dy = Math.abs(touch.clientY - state.startY)

      if (dy > CANCEL_VERTICAL_PX && dy > dx) {
        reset()
        return
      }

      if (!state.preventBack && dx > 12 && dx > dy * 0.9) {
        state.preventBack = true
      }
      if (state.preventBack) {
        e.preventDefault()
      }

      if (dx > 0) {
        state.lastOffset = dx
        setMobileNavDrag(dx)
      }
    }

    function onTouchEnd() {
      const state = trackingRef.current
      if (state.active) {
        commitMobileNavDrag(state.lastOffset)
      }
      reset()
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
      reset()
    }
  }, [enabled, setMobileNavDrag, commitMobileNavDrag])
}
