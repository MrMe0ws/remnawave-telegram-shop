import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
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

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const referralFromUrl = (searchParams.get('ref') ?? '').trim()
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
  const justVerified = (location.state as { verified?: boolean })?.verified === true

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
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
      const data = await api.login(email, password)
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
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.login')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to={registerTo} className="text-primary hover:underline font-medium">
              {t('auth.createAccount')}
            </Link>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Link
                  to="/password/forgot"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={!!error}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              {t('auth.login')}
            </Button>
          </form>

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
    </AuthLayout>
  )
}
