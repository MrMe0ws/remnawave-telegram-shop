import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api, type AuthTokenResponse } from '@/lib/api'
import { getTelegramInitData, getTelegramMiniAppStartParam } from '@/lib/utils'

export type OAuthFlags = {
  google: boolean
  telegramBot?: string
  telegramOIDCEnabled?: boolean
  telegramWebAuthMode?: 'widget' | 'oidc'
}

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
  /** ref из ?ref= (реферальная регистрация); уходит в Google OAuth state и в POST /auth/telegram. */
  referralCode?: string
  /** Для legacy Telegram Login Widget 1.0. */
  onTelegramAuth?: (user: TelegramWidgetUser) => Promise<void>
  /** Mini App: после успешного POST /auth/telegram с init_data. */
  onTelegramMiniAppSuccess: (data: AuthTokenResponse) => Promise<void>
  /** Ошибка входа через Telegram (виджет или Mini App). */
  onTelegramFlowError: (err: unknown) => void
}

/**
 * Блок «или» + Google + Telegram Login Widget для /login и /register.
 * Bootstrap с бэка; глобальный колбэк виджета разный для страниц, чтобы не затирать друг друга при навигации.
 */
export function AuthSocialProviders({
  page,
  referralCode,
  onTelegramAuth,
  onTelegramMiniAppSuccess,
  onTelegramFlowError,
}: Props) {
  const { t } = useTranslation()
  const [oauth, setOauth] = useState<OAuthFlags | null>(null)
  const [tgWidgetError, setTgWidgetError] = useState(false)
  const [miniLoading, setMiniLoading] = useState(false)
  const tgMountRef = useRef<HTMLDivElement>(null)
  const onTelegramAuthRef = useRef(onTelegramAuth)
  onTelegramAuthRef.current = onTelegramAuth
  const miniOkRef = useRef(onTelegramMiniAppSuccess)
  miniOkRef.current = onTelegramMiniAppSuccess
  const flowErrRef = useRef(onTelegramFlowError)
  flowErrRef.current = onTelegramFlowError

  const initData = typeof window !== 'undefined' ? getTelegramInitData() : ''
  const inMiniApp = initData.length > 0

  const bot = oauth?.telegramBot
  const oidcEnabled = oauth?.telegramOIDCEnabled ?? false
  const showWidget = !!bot && !inMiniApp
  const showOIDC = oidcEnabled && !inMiniApp
  const showSocial = inMiniApp || (oauth !== null && (!!oauth.google || showWidget || showOIDC))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const b = await api.authBootstrap()
        if (cancelled) return
        setOauth({
          google: b.google_oauth_enabled,
          telegramBot: b.telegram_widget_bot,
          telegramOIDCEnabled: b.telegram_oidc_enabled ?? false,
          telegramWebAuthMode: b.telegram_web_auth_mode,
        })
      } catch {
        if (cancelled) return
        setOauth({ google: true, telegramBot: undefined, telegramOIDCEnabled: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!inMiniApp) return
    try {
      window.Telegram?.WebApp?.ready?.()
      window.Telegram?.WebApp?.expand?.()
    } catch {
      /* ignore */
    }
  }, [inMiniApp])

  useLayoutEffect(() => {
    setTgWidgetError(false)
    const el = tgMountRef.current
    if (!showWidget || !el || !onTelegramAuthRef.current) return

    const key = page === 'login' ? 'cabinetTelegramLoginCallback' : 'cabinetTelegramRegisterCallback'
    el.innerHTML = ''
    ;(window as unknown as Record<string, unknown>)[key] = async (user: TelegramWidgetUser) => {
      try {
        await onTelegramAuthRef.current?.(user)
      } catch {
        setTgWidgetError(true)
      }
    }
    const s = document.createElement('script')
    s.src = 'https://telegram.org/js/telegram-widget.js?22'
    s.async = true
    s.setAttribute('data-telegram-login', bot ?? '')
    s.setAttribute('data-size', 'large')
    s.setAttribute('data-radius', '8')
    s.setAttribute('data-onauth', `${String(key)}(user)`)
    s.setAttribute('data-request-access', 'write')
    s.onerror = () => setTgWidgetError(true)
    el.appendChild(s)

    return () => {
      el.innerHTML = ''
      delete (window as unknown as Record<string, unknown>)[key]
    }
  }, [bot, page, showWidget])

  if (!showSocial) return null

  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs text-muted-foreground">
          <span className="bg-card px-2">{t('common.or')}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {oauth?.google && (
          <Button
            variant="outline"
            className="w-full"
            type="button"
            onClick={() => {
              const ref = referralCode?.trim()
              const start = '/cabinet/api/auth/google/start'
              window.location.href = ref
                ? `${start}?ref=${encodeURIComponent(ref)}`
                : start
            }}
          >
            <GoogleIcon />
            {t('auth.continueWithGoogle')}
          </Button>
        )}
        {inMiniApp && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            loading={miniLoading}
            onClick={async () => {
              setMiniLoading(true)
              try {
                const ref = referralCode?.trim() || getTelegramMiniAppStartParam() || undefined
                const data = await api.telegramAuthMiniApp(getTelegramInitData(), ref)
                await miniOkRef.current(data)
              } catch (e) {
                flowErrRef.current(e)
              } finally {
                setMiniLoading(false)
              }
            }}
          >
            {t('auth.continueWithTelegram')}
          </Button>
        )}
        {showOIDC && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              const ref = referralCode?.trim()
              const start = '/cabinet/api/auth/telegram/start'
              window.location.href = ref ? `${start}?ref=${encodeURIComponent(ref)}` : start
            }}
          >
            {t('auth.continueWithTelegram')}
          </Button>
        )}
        {showWidget && (
          <div className="flex min-h-[48px] w-full flex-col items-stretch justify-center gap-2">
            {tgWidgetError && (
              <Alert variant="destructive">
                <AlertDescription>{t('auth.telegramWidgetLoadError')}</AlertDescription>
              </Alert>
            )}
            <div ref={tgMountRef} className="flex w-full justify-center [&_iframe]:max-w-full" />
          </div>
        )}
      </div>
    </>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
