/**
 * Проверка цели для страницы редиректа: только non-http(s) custom scheme, без javascript:/data:.
 */
export function isSafeDeepLinkTarget(url: string): boolean {
  const s = url.trim()
  if (!s || s.length > 8192) return false
  if (/[\s\n\r\x00-\x1f<>]/.test(s)) return false
  if (/^(javascript|data|vbscript):/i.test(s)) return false
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return false
  if (/^https?:\/\//i.test(s)) return false
  return true
}

/**
 * Баг с custom scheme из mini app встречается в Telegram Desktop / Web на Windows и часто на Linux.
 * На macOS обычно всё открывается нормально — обход не включаем.
 */
function isTelegramDeepLinkBuggyDesktopOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('android')) return false
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return false
  if (ua.includes('mac os') || ua.includes('macintosh')) return false
  if (/windows|win32|wow64/i.test(ua)) return true
  if (ua.includes('linux')) return true
  return false
}

/**
 * Промежуточная страница того же origin + location.assign обходит поломку window.open для deep link.
 */
export function needsTelegramDeepLinkWorkaround(): boolean {
  if (typeof window === 'undefined') return false
  if (!window.Telegram?.WebApp) return false
  if (!isTelegramDeepLinkBuggyDesktopOS()) return false
  const p = window.Telegram.WebApp.platform
  return p === 'tdesktop' || p === 'weba' || p === 'webk'
}

/**
 * Полный https-URL страницы /deeplink?redirectTo=… для открытия во внешнем браузере.
 * Параметр содержит целевой custom scheme (happ://… и т.д.) — страница публичная, без сессии.
 */
export function buildCabinetDeepLinkRedirectUrl(deepLinkHref: string): string {
  const origin = window.location.origin
  const base = `${origin}${import.meta.env.BASE_URL.replace(/\/?$/, '/')}`
  const u = new URL('deeplink', base)
  u.searchParams.set('redirectTo', deepLinkHref)
  return u.href
}

/**
 * Открыть промежуточную страницу во внешнем браузере (Chrome/Edge и т.д.), минуя webview мини-приложения.
 */
export function openCabinetDeepLinkRedirectExternally(deepLinkHref: string): void {
  const url = buildCabinetDeepLinkRedirectUrl(deepLinkHref)
  const openLink = window.Telegram?.WebApp?.openLink
  if (typeof openLink === 'function') {
    openLink(url, { try_instant_view: false })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
