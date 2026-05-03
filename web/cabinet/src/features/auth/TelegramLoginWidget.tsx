import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { getTelegramInitData } from '@/lib/utils'
import { mountTelegramLoginWidgetScript } from '@/lib/telegram-widget-mount'
import type { TelegramWidgetUser } from './telegram-widget-user'

export type { TelegramWidgetUser } from './telegram-widget-user'

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

    return mountTelegramLoginWidgetScript(el, {
      page,
      bot,
      onAuth: (user) => onAuthRef.current(user),
      onScriptFailed: () => setError(true),
    })
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
