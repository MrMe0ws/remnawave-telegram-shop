import { useState, useEffect } from 'react'
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MailCheck } from 'lucide-react'

import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api, ApiError } from '@/lib/api'
import { maskEmail } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

const RESEND_COOLDOWN = 60

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  const fetchMe = useAuthStore((s) => s.fetchMe)

  const emailFromState = (location.state as { email?: string })?.email ?? ''
  const token = searchParams.get('token')

  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading, setResendLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Если в URL есть ?token=… — автоматически подтверждаем.
  useEffect(() => {
    if (!token) return
    api.confirmEmail(token)
      .then(async (data) => {
        setToken(data.access_token)
        await fetchMe()
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        setError(t('errors.unknown'))
      })
  }, [token, fetchMe, navigate, setToken, t])

  // Таймер cooldown.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((v) => v - 1), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  async function handleResend() {
    setResendLoading(true)
    setMessage(null)
    setError(null)
    try {
      await api.resendVerifyEmail()
      setResendCooldown(RESEND_COOLDOWN)
      setMessage(t('verifyEmail.resend'))
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t('errors.tooManyRequests'))
      } else {
        setError(t('errors.unknown'))
      }
    } finally {
      setResendLoading(false)
    }
  }

  if (token) {
    return (
      <AuthLayout>
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-muted-foreground">{t('common.loading')}</p>
            )}
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
            <MailCheck className="text-primary" size={28} strokeWidth={1.5} />
          </div>
          <CardTitle>{t('verifyEmail.title')}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          {emailFromState && (
            <p className="text-sm text-muted-foreground">
              {t('verifyEmail.subtitle', { email: maskEmail(emailFromState) })}
            </p>
          )}

          {message && (
            <Alert variant="success">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">{t('verifyEmail.checkSpam')}</p>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            loading={resendLoading}
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0
              ? t('verifyEmail.resendCooldown', { sec: resendCooldown })
              : t('verifyEmail.resend')}
          </Button>

          <Link
            to="/login"
            className="block text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {t('verifyEmail.backToLogin')}
          </Link>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
