import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'

// Применяем тему до первого рендера (избегаем мигания).
const savedTheme = localStorage.getItem('cab_theme')
if (savedTheme === 'light') {
  document.documentElement.classList.remove('dark')
  document.documentElement.classList.add('light')
} else {
  document.documentElement.classList.add('dark')
}

// Telegram Mini App: сообщаем клиенту, что страница готова.
window.Telegram?.WebApp?.ready()
window.Telegram?.WebApp?.expand?.()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
