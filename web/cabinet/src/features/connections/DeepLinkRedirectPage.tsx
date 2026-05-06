import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isSafeDeepLinkTarget } from '@/lib/deep-link-redirect'

const AUTO_REDIRECT_SEC = 5

export default function DeepLinkRedirectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const raw = params.get('redirectTo') ?? ''

  const target = useMemo(() => {
    try {
      return decodeURIComponent(raw)
    } catch {
      return ''
    }
  }, [raw])

  const valid = Boolean(target && isSafeDeepLinkTarget(target))
  const [secondsLeft, setSecondsLeft] = useState(AUTO_REDIRECT_SEC)
  const autoTimersRef = useRef<{ intervalId: number; timeoutId: number } | null>(null)

  useEffect(() => {
    if (!valid || !target) return
    setSecondsLeft(AUTO_REDIRECT_SEC)
    let remaining = AUTO_REDIRECT_SEC
    const intervalId = window.setInterval(() => {
      remaining -= 1
      setSecondsLeft(Math.max(0, remaining))
    }, 1000)
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId)
      autoTimersRef.current = null
      window.location.assign(target)
    }, AUTO_REDIRECT_SEC * 1000)
    autoTimersRef.current = { intervalId, timeoutId }
    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
      autoTimersRef.current = null
    }
  }, [valid, target])

  function cancelAutoRedirect() {
    const timers = autoTimersRef.current
    if (!timers) return
    window.clearInterval(timers.intervalId)
    window.clearTimeout(timers.timeoutId)
    autoTimersRef.current = null
  }

  function openDeepLink() {
    if (!valid || !target) return
    cancelAutoRedirect()
    setSecondsLeft(0)
    window.location.assign(target)
  }

  function leaveRedirectPage() {
    cancelAutoRedirect()
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    window.close()
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-lg space-y-4 px-1">
        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            {!valid ? (
              <>
                <h1 className="text-lg font-semibold">{t('connections.deepLinkInvalidTitle')}</h1>
                <p className="text-sm text-muted-foreground">{t('connections.deepLinkInvalidHint')}</p>
                <Button type="button" onClick={leaveRedirectPage}>
                  {t('connections.deepLinkCancel')}
                </Button>
              </>
            ) : (
              <>
                <h1 className="text-lg font-semibold">{t('connections.deepLinkTitle')}</h1>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{t('connections.deepLinkIntro')}</p>
                <p className="text-sm font-medium text-foreground">
                  {t('connections.deepLinkCountdown', { seconds: Math.max(0, secondsLeft) })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={openDeepLink} className="gap-2">
                    <ExternalLink className="size-4" />
                    {t('connections.deepLinkOpenApp')}
                  </Button>
                  <Button type="button" variant="outline" onClick={leaveRedirectPage}>
                    {t('connections.deepLinkCancel')}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
