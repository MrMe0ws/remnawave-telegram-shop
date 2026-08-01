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

function insetTop(inset: { top?: number } | undefined): number {
  const n = inset?.top
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0
}

/**
 * Пишет safe-area в CSS-переменные.
 * В fullscreen Telegram UI (✕ Закрыть / ⋯) рисуется поверх webview — без contentSafeAreaInset контент залезает под кнопки.
 */
export function syncTelegramSafeAreaCssVars(): void {
  const tg = webApp()
  if (!tg) return
  const root = document.documentElement
  const safeTop = insetTop(tg.safeAreaInset)
  const contentTop = insetTop(tg.contentSafeAreaInset)
  let top = Math.max(safeTop, contentTop)

  // Пока API ещё не прислал insets после requestFullscreen — резерв под status bar + ряд кнопок TG.
  if (tg.isFullscreen && top < 56) {
    top = 96
  }

  root.style.setProperty('--cabinet-tg-safe-top', `${top}px`)
  if (tg.safeAreaInset) {
    root.style.setProperty('--tg-safe-area-inset-top', `${safeTop}px`)
  }
  if (tg.contentSafeAreaInset) {
    root.style.setProperty('--tg-content-safe-area-inset-top', `${contentTop}px`)
  }
}

let safeAreaListenersBound = false

/** Подписка на смену safe area / fullscreen (идемпотентно). */
export function bindTelegramSafeAreaListeners(): void {
  const tg = webApp()
  if (!tg || safeAreaListenersBound) return
  const refresh = () => syncTelegramSafeAreaCssVars()
  if (typeof tg.onEvent !== 'function') {
    refresh()
    return
  }
  tg.onEvent('safeAreaChanged', refresh)
  tg.onEvent('contentSafeAreaChanged', refresh)
  tg.onEvent('fullscreenChanged', refresh)
  safeAreaListenersBound = true
  refresh()
}

/**
 * Полноэкранный Mini App (Bot API 8.0+): убирает непрозрачный хедер Telegram.
 * Кнопки ✕/⋯ остаются оверлеем — под них нужен contentSafeAreaInset.
 */
export function requestFullscreenIfNeeded(): void {
  const tg = webApp()
  if (!tg) return
  if (typeof tg.isVersionAtLeast === 'function' && !tg.isVersionAtLeast('8.0')) return
  syncTelegramChromeColors(tg)
  bindTelegramSafeAreaListeners()
  if (!tg.isFullscreen) {
    try {
      tg.requestFullscreen?.()
    } catch {
      // UNSUPPORTED / клиент без fullscreen
    }
  }
  syncTelegramSafeAreaCssVars()
  // Insets часто приходят кадром позже после входа в fullscreen.
  window.setTimeout(() => syncTelegramSafeAreaCssVars(), 50)
  window.setTimeout(() => syncTelegramSafeAreaCssVars(), 300)
}
