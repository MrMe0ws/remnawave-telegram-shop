import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Mail, XCircle } from 'lucide-react'
import { createPortal } from 'react-dom'

import { AppLayout } from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { maskEmail } from '@/lib/utils'
import { GoogleBrandIcon, TelegramBrandIcon, VKBrandIcon, YandexBrandIcon } from '@/components/BrandIcons'

function TelegramLinkButton() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onClick() {
    setErr(null)
    setLoading(true)
    try {
      await api.startTelegramOIDCLink()
    } catch (e) {
      setErr(e instanceof ApiError ? e.body || t('settings.telegram.linkStartError') : t('settings.telegram.linkStartError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="default" size="sm" loading={loading} disabled={loading} onClick={() => void onClick()}>
        {loading ? t('settings.telegram.linkStarting') : t('accounts.link')}
      </Button>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  )
}

function GoogleLinkButton() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onClick() {
    setErr(null)
    setLoading(true)
    try {
      await api.startGoogleOAuthLink()
    } catch (e) {
      setErr(e instanceof ApiError ? e.body || t('settings.google.linkStartError') : t('settings.google.linkStartError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="default" size="sm" loading={loading} disabled={loading} onClick={() => void onClick()}>
        {loading ? t('settings.google.linkStarting') : t('accounts.link')}
      </Button>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  )
}

function YandexLinkButton() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onClick() {
    setErr(null)
    setLoading(true)
    try {
      await api.startYandexOAuthLink()
    } catch (e) {
      setErr(e instanceof ApiError ? e.body || t('settings.yandex.linkStartError') : t('settings.yandex.linkStartError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="default" size="sm" loading={loading} disabled={loading} onClick={() => void onClick()}>
        {loading ? t('settings.yandex.linkStarting') : t('accounts.link')}
      </Button>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  )
}

function VKLinkButton() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onClick() {
    setErr(null)
    setLoading(true)
    try {
      await api.startVKOAuthLink()
    } catch (e) {
      setErr(e instanceof ApiError ? e.body || t('settings.vk.linkStartError') : t('settings.vk.linkStartError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="default" size="sm" loading={loading} disabled={loading} onClick={() => void onClick()}>
        {loading ? t('settings.vk.linkStarting') : t('accounts.link')}
      </Button>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user, fetchMe } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [unlinkBusy, setUnlinkBusy] = useState<'google' | 'yandex' | 'vk' | 'telegram' | 'email' | null>(null)
  const [unlinkConfirmProvider, setUnlinkConfirmProvider] = useState<'google' | 'yandex' | 'vk' | 'email' | null>(null)
  const [unlinkMsg, setUnlinkMsg] = useState<string | null>(null)
  const [unlinkErr, setUnlinkErr] = useState<string | null>(null)

  useEffect(() => {
    void fetchMe()
  }, [fetchMe])

  const googleLinked = user?.providers?.includes('google') ?? false
  const yandexLinked = user?.providers?.includes('yandex') ?? false
  const vkLinked = user?.providers?.includes('vk') ?? false
  const tgLinked = user?.has_telegram_link ?? false
  const tgEnabled = Boolean(user?.telegram_widget_bot || user?.telegram_oidc_enabled)
  const emailLogin = user?.can_use_email_password_login ?? user?.has_password ?? false
  const hasEmail = Boolean(user?.email && String(user.email).trim() !== '')
  const emailIdentity = user?.providers?.includes('email') ?? false
  const emailLinked = emailLogin
  const emailManagedByGoogle = googleLinked && hasEmail && !emailLogin
  const canUnlinkEmail = useMemo(() => {
    if (emailManagedByGoogle) return false
    const prov = user?.providers ?? []
    return emailIdentity && prov.filter((x) => x !== 'email').length > 0
  }, [user?.providers, emailIdentity, emailManagedByGoogle])

  const canUnlinkProvider = useMemo(() => {
    const prov = user?.providers ?? []
    const pwd = user?.has_password ?? false
    return (p: string) => {
      if (p === 'email') {
        return canUnlinkEmail
      }
      const rest = prov.filter((x) => x !== p).length
      return rest > 0 || pwd
    }
  }, [user?.providers, user?.has_password, canUnlinkEmail])

  const oauthLinkErr = useMemo(() => {
    const status = searchParams.get('status')
    const reason = searchParams.get('reason_code')
    const provider = (searchParams.get('provider') || '').toLowerCase()
    if (status !== 'error' || !reason) return null

    if (reason === 'social_account_occupied') {
      if (provider === 'google') return t('accounts.linkErrorSocialOccupiedGoogle')
      if (provider === 'telegram') return t('accounts.linkErrorSocialOccupiedTelegram')
      return t('accounts.linkErrorSocialOccupiedGeneric')
    }

    if (reason === 'link_provider_disabled') return t('accounts.linkErrorProviderDisabled')
    if (reason === 'state_invalid') return t('accounts.linkErrorStateInvalid')
    return t('accounts.linkErrorGeneric')
  }, [searchParams, t])
  const noticeText = unlinkErr || oauthLinkErr || unlinkMsg
  const noticeError = Boolean(unlinkErr || oauthLinkErr)
  const [noticeVisible, setNoticeVisible] = useState(false)

  useEffect(() => {
    if (!noticeText) {
      setNoticeVisible(false)
      return
    }
    setNoticeVisible(true)
    const id = window.setTimeout(() => setNoticeVisible(false), 4000)
    return () => window.clearTimeout(id)
  }, [noticeText])

  function parseUnlinkErrorBody(body: string): string | null {
    try {
      const j = JSON.parse(body) as { error?: string }
      return typeof j?.error === 'string' ? j.error : null
    } catch {
      return null
    }
  }

  async function unlink(provider: 'google' | 'yandex' | 'vk' | 'email') {
    setUnlinkErr(null)
    setUnlinkMsg(null)
    setUnlinkBusy(provider)
    try {
      await api.identityUnlink(provider)
      setUnlinkMsg(t('accounts.unlinkDone'))
      await fetchMe()
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        const code = parseUnlinkErrorBody(e.body)
        if (code === 'telegram_unlink_forbidden') {
          setUnlinkErr(t('accounts.unlinkTelegramForbidden'))
        } else {
          setUnlinkErr(t('accounts.unlinkLastMethod'))
        }
      } else {
        setUnlinkErr(t('errors.unknown'))
      }
    } finally {
      setUnlinkBusy(null)
    }
  }

  async function confirmUnlink(provider: 'google' | 'yandex' | 'vk' | 'email') {
    setUnlinkConfirmProvider(null)
    await unlink(provider)
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('accounts.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('accounts.subtitle')}</p>
        </div>

        {noticeText && noticeVisible && typeof document !== 'undefined'
          ? createPortal(
              <div
                className={
                  noticeError
                    ? 'fixed right-4 top-20 z-[1000] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-destructive/40 bg-background/95 px-4 py-3 text-sm font-medium text-destructive shadow-2xl backdrop-blur-sm'
                    : 'fixed right-4 top-20 z-[1000] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-emerald-400/50 bg-background/95 px-4 py-3 text-sm font-medium text-emerald-400 shadow-2xl backdrop-blur-sm'
                }
              >
                <div className="flex items-center gap-2">
                  {noticeError ? <XCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
                  <span>{noticeText}</span>
                </div>
              </div>,
              document.body,
            )
          : null}

        <div className="space-y-3">
          {/* Telegram */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
            <div className="size-8 shrink-0 rounded-full bg-[#229ED9]/15 flex items-center justify-center">
              <TelegramBrandIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">Telegram</p>
              {user?.telegram_id != null ? (
                <p className="text-xs text-muted-foreground tabular-nums">{user.telegram_id}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {tgLinked ? (
                <span className="text-sm font-medium text-emerald-500">{t('accounts.linked')}</span>
              ) : tgEnabled ? (
                <TelegramLinkButton />
              ) : (
                <span className="text-sm text-muted-foreground">{t('settings.telegram.disabled')}</span>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
            <div className="size-8 shrink-0 rounded-full border border-border flex items-center justify-center text-muted-foreground">
              <Mail className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{t('auth.email')}</p>
              {emailLinked && hasEmail ? (
                <p className="text-xs text-muted-foreground break-all">{maskEmail(String(user!.email))}</p>
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {emailLinked ? (
                <>
                  <span className="text-sm font-medium text-emerald-500">{t('accounts.linked')}</span>
                  {canUnlinkEmail ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={unlinkBusy === 'email'}
                      disabled={unlinkBusy !== null}
                      onClick={() => setUnlinkConfirmProvider('email')}
                    >
                      {t('accounts.unlink')}
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button type="button" variant="default" size="sm" asChild>
                  <Link to="/accounts/email">{t('accounts.link')}</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Google */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
            <div className="size-8 shrink-0 rounded-full border border-border/70 bg-card/80 flex items-center justify-center">
              <GoogleBrandIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">Google</p>
              {googleLinked ? (
                <p className="text-xs text-muted-foreground break-all">
                  {user?.google_masked_email?.trim() ? user.google_masked_email : '—'}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {googleLinked ? (
                <>
                  <span className="text-sm font-medium text-emerald-500">{t('accounts.linked')}</span>
                  {canUnlinkProvider('google') ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={unlinkBusy === 'google'}
                      disabled={unlinkBusy !== null}
                      onClick={() => setUnlinkConfirmProvider('google')}
                    >
                      {t('accounts.unlink')}
                    </Button>
                  ) : null}
                </>
              ) : user?.google_oauth_enabled ? (
                <GoogleLinkButton />
              ) : (
                <span className="text-sm text-muted-foreground">{t('settings.google.disabled')}</span>
              )}
            </div>
          </div>

          {/* Yandex */}
          {(yandexLinked || user?.yandex_oauth_enabled) && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
            <div className="size-8 shrink-0 rounded-full border border-border/70 bg-card/80 flex items-center justify-center">
              <YandexBrandIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">Yandex</p>
              {yandexLinked ? (
                <p className="text-xs text-muted-foreground break-all">
                  {user?.yandex_masked_email?.trim() ? user.yandex_masked_email : '—'}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {yandexLinked ? (
                <>
                  <span className="text-sm font-medium text-emerald-500">{t('accounts.linked')}</span>
                  {canUnlinkProvider('yandex') ? (
                    <Button type="button" variant="outline" size="sm" loading={unlinkBusy === 'yandex'} disabled={unlinkBusy !== null} onClick={() => setUnlinkConfirmProvider('yandex')}>
                      {t('accounts.unlink')}
                    </Button>
                  ) : null}
                </>
              ) : user?.yandex_oauth_enabled ? (
                <YandexLinkButton />
              ) : (
                <span className="text-sm text-muted-foreground">{t('settings.yandex.disabled')}</span>
              )}
            </div>
          </div>
          )}

          {/* VK */}
          {(vkLinked || user?.vk_oauth_enabled) && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
            <div className="size-8 shrink-0 rounded-full border border-border/70 bg-card/80 flex items-center justify-center">
              <VKBrandIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">VK</p>
              {vkLinked ? (
                <p className="text-xs text-muted-foreground break-all">
                  {user?.vk_masked_email?.trim() ? user.vk_masked_email : '—'}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {vkLinked ? (
                <>
                  <span className="text-sm font-medium text-emerald-500">{t('accounts.linked')}</span>
                  {canUnlinkProvider('vk') ? (
                    <Button type="button" variant="outline" size="sm" loading={unlinkBusy === 'vk'} disabled={unlinkBusy !== null} onClick={() => setUnlinkConfirmProvider('vk')}>
                      {t('accounts.unlink')}
                    </Button>
                  ) : null}
                </>
              ) : user?.vk_oauth_enabled ? (
                <VKLinkButton />
              ) : (
                <span className="text-sm text-muted-foreground">{t('settings.vk.disabled')}</span>
              )}
            </div>
          </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t('accounts.mergeHint')}</p>
      </div>

      {unlinkConfirmProvider && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-sm p-4">
                <p className="text-base font-medium text-foreground mb-4">Точно отвязать?</p>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={unlinkBusy !== null}
                    onClick={() => void confirmUnlink(unlinkConfirmProvider)}
                  >
                    да
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={unlinkBusy !== null}
                    onClick={() => setUnlinkConfirmProvider(null)}
                  >
                    нет
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </AppLayout>
  )
}
