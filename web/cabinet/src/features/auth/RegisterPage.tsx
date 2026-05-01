import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const referralFromUrl = (searchParams.get('ref') ?? '').trim()
  const { data: bootstrap } = useAuthBootstrap()
  const botHandle = botHandleFromLink(bootstrap?.site_links?.bot)
  const loginTo = referralFromUrl ? `/login?ref=${encodeURIComponent(referralFromUrl)}` : '/login'
  const { setToken, fetchMe, accessToken, user } = useAuthStore()

  useEffect(() => {
    if (accessToken && user?.email_verified) {
      navigate('/dashboard', { replace: true })
    }
  }, [accessToken, user?.email_verified, navigate])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [securityChecking, setSecurityChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate(): string | null {
    if (!email) return t('errors.required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('errors.invalidEmail')
    if (password.length < 8) return t('errors.passwordMin')
    if (password !== confirm) return t('errors.passwordMismatch')
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validErr = validate()
    if (validErr) { setError(validErr); return }
    setError(null)
    setLoading(true)
    try {
      let turnstileToken: string | undefined
      if (bootstrap?.turnstile_enabled) {
        const siteKey = (bootstrap.turnstile_site_key ?? '').trim()
        if (!siteKey) throw new Error('turnstile site key is missing')
        setSecurityChecking(true)
        turnstileToken = await getTurnstileToken(siteKey, 'register')
        setSecurityChecking(false)
      }
      await api.register(email, password, referralFromUrl || undefined, turnstileToken)
      navigate('/verify-email', { state: { email } })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // Email уже занят — сервис отправит письмо «duplicate register»
          navigate('/verify-email', { state: { email } })
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

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <AuthSocialProviders
            page="register"
            referralCode={referralFromUrl || undefined}
            onTelegramAuth={async (user) => {
              setError(null)
              try {
                const data = await api.telegramAuthWidget(user, referralFromUrl || undefined)
                setToken(data.access_token)
                await fetchMe()
                navigate('/dashboard', { replace: true })
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
              navigate('/dashboard', { replace: true })
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
              defaultOpen
              defaultTab="register"
              from="/dashboard"
              referralCode={referralFromUrl || undefined}
            />
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  )
}
