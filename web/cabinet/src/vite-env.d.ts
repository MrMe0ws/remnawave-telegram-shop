/// <reference types="vite/client" />

declare global {
  /** Telegram Web Apps + Login Widget (minimal typings). */
  interface TelegramWebAppHapticFeedback {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => TelegramWebAppHapticFeedback
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => TelegramWebAppHapticFeedback
    selectionChanged?: () => TelegramWebAppHapticFeedback
  }

  interface TelegramSafeAreaInset {
    top: number
    bottom: number
    left: number
    right: number
  }

  interface TelegramWebApp {
    initData: string
    initDataUnsafe: Record<string, unknown>
    /** Например: ios, android, macos, tdesktop, weba, webk, unknown */
    platform?: string
    version?: string
    isFullscreen?: boolean
    safeAreaInset?: TelegramSafeAreaInset
    contentSafeAreaInset?: TelegramSafeAreaInset
    HapticFeedback?: TelegramWebAppHapticFeedback
    ready: () => void
    expand?: () => void
    close?: () => void
    isVersionAtLeast?: (version: string) => boolean
    setHeaderColor?: (color: string) => void
    setBackgroundColor?: (color: string) => void
    /**
     * Bot API 8.0+ fullscreen: контент на весь экран, ✕/⋯ оверлеем.
     * Отступы — safeAreaInset / contentSafeAreaInset и CSS --tg-*-safe-area-inset-*.
     */
    requestFullscreen?: () => void
    exitFullscreen?: () => void
    onEvent?: (eventType: string, callback: () => void) => void
    offEvent?: (eventType: string, callback: () => void) => void
    /** Открыть https-ссылку во внешнем браузере (нужно для обхода webview Desktop). */
    openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
  }

  interface TelegramNamespace {
    WebApp?: TelegramWebApp
  }

  interface TurnstileApi {
    render: (
      container: string | HTMLElement,
      options: {
        sitekey: string
        size?: 'normal' | 'compact' | 'invisible'
        action?: string
        callback?: (token: string) => void
        'error-callback'?: () => void
        'expired-callback'?: () => void
      },
    ) => string
    execute: (widgetId?: string) => void
  }

  interface Window {
    Telegram?: TelegramNamespace
    turnstile?: TurnstileApi
    /** Имя должно совпадать с data-onauth виджета привязки. */
    cabinetTelegramWidgetCallback?: (user: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
      auth_date: number
      hash: string
    }) => void
    /** Виджет входа на /login — отдельное имя, чтобы не пересекаться с привязкой в настройках. */
    cabinetTelegramLoginCallback?: (user: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
      auth_date: number
      hash: string
    }) => void
    cabinetTelegramRegisterCallback?: (user: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
      auth_date: number
      hash: string
    }) => void
  }
}

export {}
