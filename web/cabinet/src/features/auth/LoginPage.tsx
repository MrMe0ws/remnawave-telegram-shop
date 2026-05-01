import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'

import { AuthLayout } from '@/components/AuthLayout'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api, ApiError } from '@/lib/api'
import { getTurnstileToken } from '@/lib/turnstile'
import { useAuthStore } from '@/store/auth'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { AuthSocialProviders } from './AuthSocialProviders'
import { EmailAuthTabs } from './EmailAuthTabs'

function botHandleFromLink(input: string | undefined): string | null {
  const raw = input?.trim()
  if (!raw) return null
  if (raw.startsWith('@')) return raw
  try {
    const url = new URL(raw)
    const path = url.pathname.replace(/\/+$/, '')
    const parts = path.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    if (!last) return null
    return `@${last.replace(/^@/, '')}`
  } catch {
    const parts = raw.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    if (!last) return null
    return `@${last.replace(/^@/, '')}`
  }
}

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [[googleLinkPending, googleMaskedEmail]] = useState(() => {
    const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const oldPending = sp.get('google_link') === 'pending'
    const newPending = sp.get('status') === 'merge_verification_required' && sp.get('reason_code') === 'google_link_email_confirmation_required'
    return [oldPending || newPending, sp.get('masked_email') ?? ''] as const
  })
  const referralFromUrl = (searchParams.get('ref') ?? '').trim()
  const { data: bootstrap } = useAuthBootstrap()
  const botHandle = botHandleFromLink(bootstrap?.site_links?.bot)
  const registerTo = referralFromUrl
    ? `/register?ref=${encodeURIComponent(referralFromUrl)}`
    : '/register'
  const { setToken, fetchMe, accessToken, user } = useAuthStore()
  const from = (location.state as { from?: string })?.from ?? '/dashboard'

  useEffect(() => {
    if (accessToken && user?.email_verified) {
      navigate(from, { replace: true })
    }
  }, [accessToken, user?.email_verified, from, navigate])

  useEffect(() => {
    const oldPending = searchParams.get('google_link') === 'pending'
    const newPending = searchParams.get('status') === 'merge_verification_required' && searchParams.get('reason_code') === 'google_link_email_confirmation_required'
    if (!oldPending && !newPending) return
    navigate('/login', { replace: true })
  }, [searchParams, navigate])
  const justVerified = (location.state as { verified?: boolean })?.verified === true

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [securityChecking, setSecurityChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError(t('errors.required'))
      return
    }
    setLoading(true)
    try {
      let turnstileToken: string | undefined
      if (bootstrap?.turnstile_enabled) {
        const siteKey = (bootstrap.turnstile_site_key ?? '').trim()
        if (!siteKey) throw new Error('turnstile site key is missing')
        setSecurityChecking(true)
        turnstileToken = await getTurnstileToken(siteKey, 'login')
        setSecurityChecking(false)
      }
      const data = await api.login(email, password, turnstileToken)
      setToken(data.access_token)
      await fetchMe()
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          const body = err.body.toLowerCase()
          if (body.includes('not verified') || body.includes('email')) {
            navigate('/verify-email', { state: { email } })
            return
          }
          setError(t('errors.invalidCredentials'))
        } else if (err.status === 429) {
          setError(t('errors.tooManyRequests'))
        } else {
          setError(t('errors.unknown'))
        }
      } else {
        setError(t('errors.unknown'))
      }
    } finally {
      setSecurityChecking(false)
      setLoading(false)
    }
  }

  return (
    <AuthLayout showHeaderLogo={false}>
      <div className="space-y-6">
        <Logo size="sm" stacked logoSizePx={48} className="justify-center" />
        <Card>
          <CardContent className="space-y-4 pt-6">
          {justVerified && (
            <Alert variant="success">
              <AlertDescription>{t('auth.emailVerifiedOk')}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {googleLinkPending && (
            <Alert>
              <AlertDescription>{t('auth.googleLinkPending', { email: googleMaskedEmail || '—' })}</AlertDescription>
            </Alert>
          )}

          {botHandle && (
            <div className="text-center">
              <p className="text-[0.775rem] text-[rgb(100,116,139)] dark:text-[rgb(107,114,128)]">
                {t('auth.openBotInApp')}
              </p>
              <div className="mt-1.5 flex items-center justify-center gap-2 text-sm">
                <a
                  href={bootstrap?.site_links?.bot}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[rgb(51,65,85)] hover:underline dark:text-white"
                >
                  {botHandle}
                </a>
              </div>
            </div>
          )}

          <AuthSocialProviders
            page="login"
            referralCode={referralFromUrl || undefined}
            onTelegramAuth={async (user) => {
              setError(null)
              try {
                const data = await api.telegramAuthWidget(user, referralFromUrl || undefined)
                setToken(data.access_token)
                await fetchMe()
                navigate(from, { replace: true })
              } catch (err) {
                if (err instanceof ApiError && err.status === 401) {
                  setError(t('errors.invalidCredentials'))
                } else if (err instanceof ApiError && err.status === 429) {
                  setError(t('errors.tooManyRequests'))
                } else {
                  setError(t('errors.unknown'))
                }
              }
            }}
            onTelegramMiniAppSuccess={async (data) => {
              setError(null)
              setToken(data.access_token)
              await fetchMe()
              navigate(from, { replace: true })
            }}
            onTelegramFlowError={(err) => {
              if (err instanceof ApiError && err.status === 401) {
                setError(t('errors.invalidCredentials'))
              } else if (err instanceof ApiError && err.status === 429) {
                setError(t('errors.tooManyRequests'))
              } else {
                setError(t('errors.unknown'))
              }
            }}
          />

            <EmailAuthTabs
              defaultOpen={false}
              defaultTab="login"
              from={from}
              referralCode={referralFromUrl || undefined}
              googleLinkPending={googleLinkPending}
              googleMaskedEmail={googleMaskedEmail}
            />
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-xs text-muted-foreground">
              {t('auth.noAccount')}{' '}
              <Link to={registerTo} className="text-primary hover:underline">
                {t('auth.createAccount')}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  )
}
