import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronRight, Copy, Check, Upload } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { formatDate, maskEmail } from '@/lib/utils'
import { useTranslationWithLang } from '@/hooks/useTranslationWithLang'
import { ChangePasswordCollapsible, DeleteAccountSection } from '@/features/profile/account-security'

export default function ProfilePage() {
  const { t } = useTranslation()
  const { lang } = useTranslationWithLang()
  const { user, fetchMe } = useAuthStore()
  const [copied, setCopied] = useState(false)
  const { data: referrals } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api.referrals(),
    staleTime: 60_000,
    retry: 1,
  })

  useEffect(() => {
    void fetchMe()
  }, [fetchMe])

  const refUrl =
    referrals?.cabinet_register_link ||
    (user?.telegram_id != null && Number.isFinite(user.telegram_id)
      ? `${window.location.origin}/cabinet/register?ref=ref_${user.telegram_id}`
      : null)
  const canShare = useMemo(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function', [])

  async function copyRef() {
    if (!refUrl) return
    await navigator.clipboard.writeText(refUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareRef() {
    if (!refUrl || !canShare) return
    try {
      await navigator.share({
        text: `${t('referralPage.shareInviteText')}\n${refUrl}`,
      })
    } catch {
      // user cancelled share sheet
    }
  }

  const emailMethodLinked = Boolean(user?.can_use_email_password_login)
  const emailDisplay =
    emailMethodLinked && user?.email && String(user.email).trim() !== ''
      ? maskEmail(String(user.email))
      : '—'

  return (
    <AppLayout>
      <div className="space-y-6 max-w-xl mx-auto w-full">
        <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('profile.accountInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <ProfileRow
              label={t('profile.telegramId')}
              value={
                user?.has_telegram_link && user.telegram_id != null
                  ? String(user.telegram_id)
                  : '—'
              }
              hint={!user?.has_telegram_link ? t('profile.telegramIdUnlinkedHint') : undefined}
            />
            <ProfileRow label={t('profile.email')} value={emailDisplay} />
            <ProfileRow
              label={t('profile.registeredAt')}
              value={user?.registered_at ? formatDate(user.registered_at, lang) : '—'}
            />
          </CardContent>
        </Card>

        <Link to="/accounts" className="block">
          <Card className="transition-colors hover:bg-muted/40">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex-1">
                <p className="font-medium">{t('profile.linkedAccountsTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('profile.linkedAccountsHint')}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">{t('profile.referralBlockTitle')}</CardTitle>
              <CardDescription>{t('profile.referralBlockHint')}</CardDescription>
            </div>
            <Button variant="link" size="sm" className="shrink-0 px-0 h-auto gap-1.5" asChild>
              <Link to="/referral">
                {t('profile.referralProgramLink')}
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {refUrl ? (
              <>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
                  <div className="min-w-0 w-full rounded-lg bg-muted px-3 py-2 text-xs font-mono text-muted-foreground truncate select-all md:flex-1">
                    {refUrl}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:ml-auto md:shrink-0">
                    <Button variant="outline" size="sm" onClick={() => void copyRef()} className="shrink-0 gap-1.5">
                      {copied ? (
                        <>
                          <Check size={14} className="text-primary" />
                          {t('subscriptionPage.copied')}
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          {t('subscriptionPage.copyLink')}
                        </>
                      )}
                    </Button>
                    {canShare ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void shareRef()}
                        className="shrink-0 gap-1.5 shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
                      >
                        <Upload size={14} strokeWidth={1.5} />
                        {t('common.share')}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t('profile.referralFootnote')}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('profile.referralNeedTelegram')}</p>
            )}
          </CardContent>
        </Card>

        {user?.has_password ? (
          <ChangePasswordCollapsible
            onSuccess={async (token) => {
              useAuthStore.getState().setToken(token)
              await fetchMe()
            }}
          />
        ) : (
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              {t('settings.password.noPasswordHint')}
            </CardContent>
          </Card>
        )}

        {user?.can_delete_account_ui ? <DeleteAccountSection /> : null}

      </div>
    </AppLayout>
  )
}

function ProfileRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-right break-all">{value}</span>
      </div>
      {hint ? <p className="text-xs text-muted-foreground text-right sm:text-left">{hint}</p> : null}
    </div>
  )
}

