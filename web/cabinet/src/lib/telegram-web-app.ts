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

/** Цвет статус-бара Telegram в fullscreen (рекомендация Bot API 8.0). */
function syncTelegramChromeColors(tg: TelegramWebApp): void {
  const isDark = document.documentElement.classList.contains('dark')
  // Близко к --background светлой/тёмной темы кабинета
  const color = isDark ? '#0b1426' : '#f8fafc'
  try {
    tg.setHeaderColor?.(color)
    tg.setBackgroundColor?.(color)
  } catch {
    // старые клиенты / без поддержки
  }
}

/**
 * Полноэкранный Mini App (Bot API 8.0+): убирает верхний хедер Telegram
 * и на мобилке, и на ПК. Без поддержки API — no-op (остаётся обычный expand).
 */
export function requestFullscreenIfNeeded(): void {
  const tg = webApp()
  if (!tg) return
  if (tg.isFullscreen) return
  if (typeof tg.isVersionAtLeast === 'function' && !tg.isVersionAtLeast('8.0')) return
  syncTelegramChromeColors(tg)
  try {
    tg.requestFullscreen?.()
  } catch {
    // UNSUPPORTED / клиент без fullscreen
  }
}
