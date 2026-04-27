import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'

import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { AuthSocialProviders } from './AuthSocialProviders'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const referralFromUrl = (searchParams.get('ref') ?? '').trim()
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
      await api.register(email, password, referralFromUrl || undefined)
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
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.register')}</CardTitle>
          <CardDescription>
            {t('auth.haveAccount')}{' '}
            <Link to={loginTo} className="text-primary hover:underline font-medium">
              {t('auth.login')}
            </Link>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!error}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={!!error}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t('auth.passwordConfirm')}</Label>
              <Input
                id="confirm"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('auth.passwordPlaceholder')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={password !== confirm && confirm.length > 0}
                required
              />
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              {t('auth.createAccount')}
            </Button>
          </form>

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
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground">
            {t('auth.haveAccount')}{' '}
            <Link to={loginTo} className="text-primary hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
