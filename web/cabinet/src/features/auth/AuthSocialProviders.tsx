import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api, type AuthTokenResponse } from '@/lib/api'
import { getTelegramInitData, getTelegramMiniAppStartParam } from '@/lib/utils'
import { GoogleBrandIcon, TelegramBrandIcon, VKBrandIcon, YandexBrandIcon } from '@/components/BrandIcons'
import type { TelegramWidgetUser } from './TelegramLoginWidget'

export type { TelegramWidgetUser } from './TelegramLoginWidget'

export type OAuthFlags = {
  google: boolean
  yandex?: boolean
  vk?: boolean
  telegramBot?: string
  telegramOIDCEnabled?: boolean
  telegramWebAuthMode?: 'widget' | 'oidc'
}

type Page = 'login' | 'register'

type Props = {
  page: Page
  /** ref из ?ref= (реферальная регистрация); уходит в Google OAuth state и в POST /auth/telegram. */
  referralCode?: string
  /** true — виджет уже отрисован выше (widget mode); не монтировать второй раз в сетке. */
  telegramWidgetRenderedAbove?: boolean
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
  telegramWidgetRenderedAbove = false,
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
  const embedTelegramWidget =
    showWidget && !telegramWidgetRenderedAbove && oauth?.telegramWebAuthMode === 'widget'
  const showOIDC = oidcEnabled && !inMiniApp
  const showSocial = inMiniApp || (oauth !== null && (!!oauth.google || !!oauth.yandex || !!oauth.vk || showWidget || showOIDC))
  const socialButtons: Array<{ key: string; label: string; icon: ReactNode; onClick: () => void; loading?: boolean }> = []

  if (oauth?.google) {
    socialButtons.push({
      key: 'google',
      label: t('auth.socialGoogle'),
      icon: <GoogleBrandIcon className="size-5" />,
      onClick: () => {
        const ref = referralCode?.trim()
        const start = '/cabinet/api/auth/google/start'
        window.location.href = ref ? `${start}?ref=${encodeURIComponent(ref)}` : start
      },
    })
  }
  if (oauth?.yandex) {
    socialButtons.push({
      key: 'yandex',
      label: t('auth.socialYandex'),
      icon: <YandexBrandIcon className="size-5" />,
      onClick: () => {
        const ref = referralCode?.trim()
        const start = '/cabinet/api/auth/yandex/start'
        window.location.href = ref ? `${start}?ref=${encodeURIComponent(ref)}` : start
      },
    })
  }
  if (oauth?.vk) {
    socialButtons.push({
      key: 'vk',
      label: t('auth.socialVK'),
      icon: <VKBrandIcon className="size-5" />,
      onClick: () => {
        const ref = referralCode?.trim()
        const start = '/cabinet/api/auth/vk/start'
        window.location.href = ref ? `${start}?ref=${encodeURIComponent(ref)}` : start
      },
    })
  }
  if (inMiniApp) {
    socialButtons.push({
      key: 'telegram-miniapp',
      label: t('auth.socialTelegram'),
      icon: <TelegramBrandIcon className="size-5" />,
      loading: miniLoading,
      onClick: async () => {
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
      },
    })
  }
  if (showOIDC) {
    socialButtons.push({
      key: 'telegram-oidc',
      label: t('auth.socialTelegram'),
      icon: <TelegramBrandIcon className="size-5" />,
      onClick: () => {
        const ref = referralCode?.trim()
        const start = '/cabinet/api/auth/telegram/start'
        window.location.href = ref ? `${start}?ref=${encodeURIComponent(ref)}` : start
      },
    })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const b = await api.authBootstrap()
        if (cancelled) return
        setOauth({
          google: b.google_oauth_enabled,
          yandex: b.yandex_oauth_enabled ?? false,
          vk: b.vk_oauth_enabled ?? false,
          telegramBot: b.telegram_widget_bot,
          telegramOIDCEnabled: b.telegram_oidc_enabled ?? false,
          telegramWebAuthMode: b.telegram_web_auth_mode,
        })
      } catch {
        if (cancelled) return
        setOauth({ google: true, yandex: false, vk: false, telegramBot: undefined, telegramOIDCEnabled: false })
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
    if (!embedTelegramWidget || !el || !onTelegramAuthRef.current) return

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
  }, [bot, page, embedTelegramWidget])

  if (!showSocial) return null

  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs text-[rgb(100,116,139)] dark:text-[rgb(107,114,128)]">
          <span className="bg-card px-2">{t('common.or')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {socialButtons.map((btn, i) => {
          const isOddTail = socialButtons.length % 2 === 1 && i === socialButtons.length - 1
          return (
            <Button
              key={btn.key}
              type="button"
              variant="outline"
              loading={btn.loading}
              className={`h-16 w-full flex-col justify-center gap-1 rounded-xl border-border/80 bg-card/70 hover:bg-muted/60 ${
                isOddTail ? 'col-span-2 mx-auto max-w-[220px]' : ''
              }`}
              onClick={() => void btn.onClick()}
            >
              {btn.icon}
              <span className="text-sm font-medium text-[rgb(100,116,139)] dark:text-[rgb(107,114,128)]">{btn.label}</span>
            </Button>
          )
        })}
        {embedTelegramWidget && (
          <div className="col-span-2 flex min-h-[48px] w-full flex-col items-stretch justify-center gap-2">
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
