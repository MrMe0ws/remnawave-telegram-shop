export const ADMIN_MOBILE_NAV_MAX_WIDTH_PX = 288

export function getAdminMobileNavWidthPx(): number {
  if (typeof window === 'undefined') return ADMIN_MOBILE_NAV_MAX_WIDTH_PX
  return Math.min(window.innerWidth * 0.85, ADMIN_MOBILE_NAV_MAX_WIDTH_PX)
}
