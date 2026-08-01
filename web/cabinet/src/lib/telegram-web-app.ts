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

function isTelegramDesktopPlatform(): boolean {
  const p = webApp()?.platform
  if (typeof p !== 'string') return false
  if (NATIVE_DESKTOP_PLATFORMS.has(p)) return true
  if (WEB_PLATFORMS.has(p) && !isMobileUserAgent()) return true
  return false
}

function syncTelegramChromeColors(tg: TelegramWebApp): void {
  const isDark = document.documentElement.classList.contains('dark')
  const color = isDark ? '#0b1426' : '#f8fafc'
  try {
    tg.setHeaderColor?.(color)
    tg.setBackgroundColor?.(color)
  } catch {
    // ignore
  }
}

/**
 * Мобилка: обычный Mini App с отдельной полосой «✕ Закрыть» (не requestFullscreen).
 * Desktop: fullscreen — единственный способ сделать окно больше «телефонного».
 * Если на телефоне уже залипли в fullscreen после старого билда — выходим из него.
 */
export function configureTelegramViewport(): void {
  const tg = webApp()
  if (!tg) return

  syncTelegramChromeColors(tg)

  if (!isTelegramDesktopPlatform()) {
    if (tg.isFullscreen) {
      try {
        tg.exitFullscreen?.()
      } catch {
        // ignore
      }
    }
    return
  }

  if (tg.isFullscreen) return
  if (typeof tg.isVersionAtLeast === 'function' && !tg.isVersionAtLeast('8.0')) return
  try {
    tg.requestFullscreen?.()
  } catch {
    // UNSUPPORTED
  }
}
