import type { TelegramWidgetUser } from '@/features/auth/telegram-widget-user'

const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22'

/** Таймаут загрузки виджета: при блокировке telegram.org onerror может не прийти сразу. */
const DEFAULT_WIDGET_LOAD_TIMEOUT_MS = 12_000

type MountOpts = {
  page: 'login' | 'register'
  bot: string
  onAuth: (user: TelegramWidgetUser) => Promise<void>
  onScriptFailed: () => void
  /** true — скрипт ещё грузится; false — onload, onerror или таймаут. */
  onScriptLoadingChange?: (loading: boolean) => void
  loadTimeoutMs?: number
}

/**
 * Встраивает Telegram Login Widget (скрипт + колбэк). Возвращает cleanup.
 */
export function mountTelegramLoginWidgetScript(container: HTMLElement, opts: MountOpts): () => void {
  const loadTimeoutMs = opts.loadTimeoutMs ?? DEFAULT_WIDGET_LOAD_TIMEOUT_MS
  const key = opts.page === 'login' ? 'cabinetTelegramLoginCallback' : 'cabinetTelegramRegisterCallback'

  container.innerHTML = ''
  opts.onScriptLoadingChange?.(true)
  ;(window as unknown as Record<string, unknown>)[key] = async (user: TelegramWidgetUser) => {
    try {
      await opts.onAuth(user)
    } catch {
      opts.onScriptFailed()
    }
  }

  let settled = false
  const markOk = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timer)
    opts.onScriptLoadingChange?.(false)
  }
  const settleFail = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timer)
    opts.onScriptLoadingChange?.(false)
    opts.onScriptFailed()
  }

  const timer = window.setTimeout(settleFail, loadTimeoutMs)

  const s = document.createElement('script')
  s.src = WIDGET_SRC
  s.async = true
  s.setAttribute('data-telegram-login', opts.bot)
  s.setAttribute('data-size', 'large')
  s.setAttribute('data-radius', '8')
  s.setAttribute('data-onauth', `${String(key)}(user)`)
  s.setAttribute('data-request-access', 'write')
  s.onload = () => {
    markOk()
  }
  s.onerror = () => {
    settleFail()
  }
  container.appendChild(s)

  return () => {
    window.clearTimeout(timer)
    opts.onScriptLoadingChange?.(false)
    container.innerHTML = ''
    delete (window as unknown as Record<string, unknown>)[key]
  }
}
