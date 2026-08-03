import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initCabinetI18n } from './i18n'
import { loadTelegramWebAppScriptIfNeeded } from '@/lib/telegram-web-app-loader'
import { configureTelegramViewport } from '@/lib/telegram-web-app'
import { useAuthStore } from '@/store/auth'

// Применяем тему до первого рендера (избегаем мигания).
const savedTheme = localStorage.getItem('cab_theme')
if (savedTheme === 'light') {
  document.documentElement.classList.remove('dark')
  document.documentElement.classList.add('light')
} else {
  document.documentElement.classList.add('dark')
}

function bootTelegramWebAppShell(): void {
  window.Telegram?.WebApp?.ready?.()
  window.Telegram?.WebApp?.expand?.()
  // Fullscreen Mini App (8.0+): mobile + desktop; отступы — CSS --tg-*-safe-area-inset-*.
  configureTelegramViewport()
}

bootTelegramWebAppShell()

void initCabinetI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  // Mini App: SDK в фоне; после загрузки — ready/expand и повтор автологина (первый initialize мог быть без initData).
  void loadTelegramWebAppScriptIfNeeded().then(() => {
    bootTelegramWebAppShell()
    void useAuthStore.getState().tryTelegramMiniAppAfterSdk()
  })
})
