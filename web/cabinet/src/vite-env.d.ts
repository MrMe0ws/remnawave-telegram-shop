/// <reference types="vite/client" />

/** Telegram Web Apps + Login Widget (minimal typings). */
interface TelegramWebApp {
  initData: string
  initDataUnsafe: Record<string, unknown>
  ready: () => void
  expand?: () => void
  close?: () => void
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

declare global {
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
