function webApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp
}

/** Лёгкая вибрация (Bot API 6.1+). На десктопе/без поддержки — no-op. */
export function hapticImpactLight(): void {
  try {
    webApp()?.HapticFeedback?.impactOccurred?.('light')
  } catch {
    // Telegram может бросить, если haptic недоступен
  }
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
 * Fullscreen Mini App (Bot API 8.0+): mobile и desktop.
 * На мобилке ✕/⋯ — оверлей; отступы через CSS --tg-*-safe-area-inset-*
 * на `.cabinet-app-header`. Вне Telegram / на клиентах ниже 8.0 — no-op.
 */
export function configureTelegramViewport(): void {
  const tg = webApp()
  if (!tg) return

  syncTelegramChromeColors(tg)

  if (tg.isFullscreen) return
  if (typeof tg.isVersionAtLeast === 'function' && !tg.isVersionAtLeast('8.0')) return
  try {
    tg.requestFullscreen?.()
  } catch {
    // UNSUPPORTED
  }
}
