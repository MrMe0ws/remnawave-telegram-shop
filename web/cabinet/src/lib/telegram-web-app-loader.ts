const TG_WEBAPP_SRC = 'https://telegram.org/js/telegram-web-app.js'

/** URL Mini App / WebApp — без этого скрипт telegram.org не нужен (обычный браузер). */
export function urlIndicatesTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.location.hash.includes('tgWebAppData=') || window.location.search.includes('tgWebAppData=')
  )
}

let webAppScriptInflight: Promise<void> | null = null

/**
 * Подгружает telegram-web-app.js только в контексте Mini App (не блокирует первый рендер).
 * Разрешается по onload/onerror; при «вечной» блокировке UI уже показан, автологин не сработает.
 */
export function loadTelegramWebAppScriptIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.Telegram?.WebApp) return Promise.resolve()
  if (!urlIndicatesTelegramWebApp()) return Promise.resolve()
  if (webAppScriptInflight) return webAppScriptInflight

  webAppScriptInflight = new Promise((resolve) => {
    const done = () => {
      webAppScriptInflight = null
      resolve()
    }
    const s = document.createElement('script')
    s.src = TG_WEBAPP_SRC
    s.async = true
    s.onload = done
    s.onerror = done
    document.head.appendChild(s)
  })
  return webAppScriptInflight
}
