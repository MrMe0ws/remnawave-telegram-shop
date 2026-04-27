import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { maskEmail } from '@/lib/utils'

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
      <Button type="button" variant="outline" loading={loading} disabled={loading} onClick={() => void onClick()}>
        {loading ? t('settings.telegram.linkStarting') : t('settings.telegram.notLinked')}
      </Button>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user, fetchMe } = useAuthStore()

  useEffect(() => {
    void fetchMe()
  }, [fetchMe])

  const googleLinked = user?.providers?.includes('google') ?? false
  const tgLinked = user?.has_telegram_link ?? false
  const tgEnabled = Boolean(user?.telegram_widget_bot || user?.telegram_oidc_enabled)

  return (
    <AppLayout>
      <div className="space-y-6 max-w-xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-semibold">{t('accounts.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('accounts.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('accounts.loginMethodsTitle')}</CardTitle>
            <CardDescription>{t('accounts.loginMethodsHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">{t('auth.email')}</span>
              <span className="font-medium text-right break-all">
                {user?.email && String(user.email).trim() !== '' ? maskEmail(String(user.email)) : '—'}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Google</span>
              <span className="font-medium">
                {googleLinked
                  ? t('settings.google.linked')
                  : user?.google_oauth_enabled
                    ? t('settings.google.unlinkedShort')
                    : t('settings.google.disabled')}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Telegram</span>
              <span className="font-medium">
                {tgLinked
                  ? t('settings.telegram.linked')
                  : tgEnabled
                    ? t('settings.telegram.notLinkedShort')
                    : t('settings.telegram.disabled')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">{t('accounts.mergeHint')}</p>
            <Link
              to="/link/merge"
              className="text-sm text-primary underline-offset-4 hover:underline inline-block"
            >
              {t('accounts.mergePageLink')}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.google.title')}</CardTitle>
            <CardDescription>
              {user?.google_oauth_enabled ? t('settings.google.linkHint') : t('settings.google.disabled')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {googleLinked ? (
              <Badge variant="success" className="gap-1">
                <Check size={12} />
                {t('settings.google.linked')}
              </Badge>
            ) : user?.google_oauth_enabled ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => { window.location.href = '/cabinet/api/auth/google/start' }}
              >
                {t('settings.google.notLinked')}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.telegram.title')}</CardTitle>
            <CardDescription>
              {tgLinked
                ? t('settings.telegram.linkedDescription')
                : tgEnabled
                  ? t('settings.telegram.linkHint')
                  : t('settings.telegram.disabled')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tgLinked ? (
              <Badge variant="success" className="gap-1">
                <Check size={12} />
                {t('settings.telegram.linked')}
              </Badge>
            ) : tgEnabled ? (
              <TelegramLinkButton />
            ) : null}
            {user?.dev_telegram_unlink ? <DevTelegramUnlinkBlock onDone={fetchMe} /> : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function DevTelegramUnlinkBlock({ onDone }: { onDone: () => Promise<void> }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function run() {
    setErr(null)
    setMsg(null)
    setLoading(true)
    try {
      await api.devTelegramUnlink()
      setMsg(t('settings.telegram.devUnlinkDone'))
      await onDone()
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setErr(t('errors.unknown'))
      } else {
        setErr(t('errors.unknown'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <p className="text-xs text-muted-foreground">{t('settings.telegram.devUnlinkHint')}</p>
      {msg && (
        <Alert>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      <Button type="button" variant="outline" size="sm" loading={loading} onClick={() => void run()}>
        {t('settings.telegram.devUnlink')}
      </Button>
    </div>
  )
}
