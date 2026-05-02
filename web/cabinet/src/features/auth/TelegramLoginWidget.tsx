import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { getTelegramInitData } from '@/lib/utils'

export type TelegramWidgetUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

type Page = 'login' | 'register'

type Props = {
  page: Page
  botUsername: string
  onTelegramAuth: (user: TelegramWidgetUser) => Promise<void>
}

/** Telegram Login Widget 1.0: скрипт telegram.org, iframe с их стилем. */
export function TelegramLoginWidget({ page, botUsername, onTelegramAuth }: Props) {
  const { t } = useTranslation()
  const [error, setError] = useState(false)
  const mountRef = useRef<HTMLDivElement>(null)
  const onAuthRef = useRef(onTelegramAuth)
  onAuthRef.current = onTelegramAuth

  const initData = typeof window !== 'undefined' ? getTelegramInitData() : ''
  const bot = botUsername.trim()
  const active = initData.length === 0 && bot !== ''

  useLayoutEffect(() => {
    setError(false)
    const el = mountRef.current
    if (!active || !el) return

    const key = page === 'login' ? 'cabinetTelegramLoginCallback' : 'cabinetTelegramRegisterCallback'
    el.innerHTML = ''
    ;(window as unknown as Record<string, unknown>)[key] = async (user: TelegramWidgetUser) => {
      try {
        await onAuthRef.current(user)
      } catch {
        setError(true)
      }
    }
    const s = document.createElement('script')
    s.src = 'https://telegram.org/js/telegram-widget.js?22'
    s.async = true
    s.setAttribute('data-telegram-login', bot)
    s.setAttribute('data-size', 'large')
    s.setAttribute('data-radius', '8')
    s.setAttribute('data-onauth', `${String(key)}(user)`)
    s.setAttribute('data-request-access', 'write')
    s.onerror = () => setError(true)
    el.appendChild(s)

    return () => {
      el.innerHTML = ''
      delete (window as unknown as Record<string, unknown>)[key]
    }
  }, [active, bot, page])

  if (!active) return null

  return (
    <div className="flex min-h-[48px] w-full flex-col items-stretch justify-center gap-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t('auth.telegramWidgetLoadError')}</AlertDescription>
        </Alert>
      )}
      <div ref={mountRef} className="flex w-full justify-center [&_iframe]:max-w-full" />
    </div>
  )
}
