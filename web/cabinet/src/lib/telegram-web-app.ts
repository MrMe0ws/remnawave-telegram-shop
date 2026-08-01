/** Нативные десктоп-клиенты Telegram. */
const NATIVE_DESKTOP_PLATFORMS = new Set(['tdesktop', 'macos'])
/** Telegram Web — platform одинаковый на PC и телефоне, нужен доп. фильтр по UA. */
const WEB_PLATFORMS = new Set(['weba', 'webk', 'web'])

function webApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp
}

function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
}

/** Лёгкая вибрация (Bot API 6.1+). На десктопе/без поддержки — no-op. */
export function hapticImpactLight(): void {
  try {
    webApp()?.HapticFeedback?.impactOccurred?.('light')
  } catch {
    // Telegram может бросить, если haptic недоступен
  }
}

/** ПК-клиент Mini App (не мобильный Telegram Web). */
export function isTelegramDesktopPlatform(): boolean {
  const p = webApp()?.platform
  if (typeof p !== 'string') return false
  if (NATIVE_DESKTOP_PLATFORMS.has(p)) return true
  if (WEB_PLATFORMS.has(p) && !isMobileUserAgent()) return true
  return false
}

/**
 * На ПК Telegram открывает Mini App в компактном окне «как телефон».
 * Единственный способ сделать окно заметно больше — fullscreen (Bot API 8.0+).
 */
export function requestDesktopFullscreenIfNeeded(): void {
  const tg = webApp()
  if (!tg || !isTelegramDesktopPlatform()) return
  if (tg.isFullscreen) return
  if (typeof tg.isVersionAtLeast === 'function' && !tg.isVersionAtLeast('8.0')) return
  try {
    tg.requestFullscreen?.()
  } catch {
    // UNSUPPORTED / клиент без fullscreen
  }
}
