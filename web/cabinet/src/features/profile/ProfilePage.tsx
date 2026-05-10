import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Check, ChevronRight, Copy, CreditCard, Gem, Gift, Upload, User } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { cn, formatDate, maskEmail } from '@/lib/utils'
import { useTranslationWithLang } from '@/hooks/useTranslationWithLang'
import { ChangePasswordCollapsible, DeleteAccountSection } from '@/features/profile/account-security'
import { ProfileLoyaltySection } from '@/features/loyalty/LoyaltyProgramPage'
import { PaymentsHistoryCard } from '@/features/payments/PaymentsHistoryPage'

type ProfileTab = 'general' | 'bonuses' | 'history'

function tabFromHash(hash: string): ProfileTab {
  const h = hash.replace(/^#/, '')
  if (h === 'history' || h === 'payments') return 'history'
  if (h === 'bonuses' || h === 'loyalty') return 'bonuses'
  return 'general'
}

function hashForTab(tab: ProfileTab): string {
  if (tab === 'bonuses') return 'bonuses'
  if (tab === 'history') return 'history'
  return ''
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const { lang } = useTranslationWithLang()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, fetchMe } = useAuthStore()
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<ProfileTab>(() => tabFromHash(location.hash))

  const { data: referrals } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api.referrals(),
    staleTime: 60_000,
    retry: 1,
  })

  useEffect(() => {
    void fetchMe()
  }, [fetchMe])

  useEffect(() => {
    setTab(tabFromHash(location.hash))
  }, [location.hash])

  const refUrl =
    referrals?.cabinet_register_link ||
    (user?.telegram_id != null && Number.isFinite(user.telegram_id)
      ? `${window.location.origin}/cabinet/register?ref=ref_${user.telegram_id}`
      : null)
  const canShare = useMemo(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function', [])

  function goTab(next: ProfileTab) {
    setTab(next)
    const h = hashForTab(next)
    if (h) {
      navigate({ pathname: '/profile', hash: h }, { replace: true })
    } else {
      navigate('/profile', { replace: true })
    }
  }

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

  /** Способов входа меньше двух — подсветка CTA «Привязанные аккаунты» как у «Подключить устройство». */
  const linkedMethodCount = user?.providers?.length ?? 0
  const pulseLinkedAccounts = linkedMethodCount < 2

  const emailMethodLinked = Boolean(user?.can_use_email_password_login)
  const emailDisplay =
    emailMethodLinked && user?.email && String(user.email).trim() !== ''
      ? maskEmail(String(user.email))
      : '—'

  const tabs: { id: ProfileTab; labelKey: string; icon: typeof User }[] = [
    { id: 'general', labelKey: 'profile.tabGeneral', icon: User },
    { id: 'bonuses', labelKey: 'profile.tabBonuses', icon: Gem },
    { id: 'history', labelKey: 'profile.tabHistory', icon: CreditCard },
  ]

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>

        <div
          role="tablist"
          aria-label={t('profile.title')}
          className="flex gap-0.5 rounded-lg border border-border/80 bg-muted/35 p-0.5"
        >
          {tabs.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors sm:text-xs',
                tab === id
                  ? 'bg-secondary text-[rgb(2,132,199)] shadow-sm dark:text-[rgb(81,193,245)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => goTab(id)}
            >
              <Icon
                className={cn('size-3.5 shrink-0', tab !== id && 'opacity-90')}
                strokeWidth={2}
                aria-hidden
              />
              <span className="truncate">{t(labelKey)}</span>
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="space-y-4 pt-1">
            <Card>
              <CardHeader className="pb-2">
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

            {pulseLinkedAccounts ? (
              <Link to="/accounts" className="connect-device-cta group block rounded-xl">
                <div className="connect-device-cta-inner profile-linked-accounts-inner flex items-center gap-3 px-4 py-3.5 text-card-foreground dark:text-white">
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-medium leading-snug sm:text-[18px]">{t('profile.linkedAccountsTitle')}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground dark:text-slate-300">{t('profile.linkedAccountsHint')}</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </div>
              </Link>
            ) : (
              <Link to="/accounts" className="block">
                <Card className="profile-tariff-hover transition-[border-color,box-shadow,filter]">
                  <CardContent className="flex items-center gap-3 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-medium leading-snug sm:text-[18px]">{t('profile.linkedAccountsTitle')}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{t('profile.linkedAccountsHint')}</p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </CardContent>
                </Card>
              </Link>
            )}

            {user?.has_password ? (
              <ChangePasswordCollapsible
                onSuccess={async (token) => {
                  useAuthStore.getState().setToken(token)
                  await fetchMe()
                }}
              />
            ) : (
              <Card>
                <CardContent className="py-3 text-sm text-muted-foreground">
                  {t('settings.password.noPasswordHint')}
                </CardContent>
              </Card>
            )}

            {user?.can_delete_account_ui ? <DeleteAccountSection /> : null}
          </div>
        )}

        {tab === 'bonuses' && (
          <div className="space-y-4 pt-1">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">{t('profile.referralBlockTitle')}</CardTitle>
                  <CardDescription className="text-xs">{t('profile.referralBlockHint')}</CardDescription>
                </div>
                <Link
                  to="/referral"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card/70 px-2.5 py-1.5 text-xs font-medium text-primary shadow-sm profile-tariff-hover"
                >
                  {t('profile.referralProgramLink')}
                  <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
                </Link>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {refUrl ? (
                  <>
                    <div className="rounded-lg bg-muted px-2.5 py-2 text-[11px] font-mono text-muted-foreground truncate select-all">
                      {refUrl}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => void copyRef()}>
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
                        <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={() => void shareRef()}>
                          <Upload size={14} strokeWidth={1.5} />
                          {t('common.share')}
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">{t('profile.referralFootnote')}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('profile.referralNeedTelegram')}</p>
                )}
              </CardContent>
            </Card>

            <ProfileLoyaltySection />

            <Link
              to="/promocodes"
              className="profile-tariff-hover flex w-full items-center gap-3 rounded-xl border border-border bg-card/80 p-4 text-left shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)] transition-[border-color,box-shadow,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 dark:bg-violet-400/20">
                <Gift size={16} className="text-violet-600 dark:text-violet-300" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{t('profile.promocodesCardTitle')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('profile.promocodesCardHint')}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </div>
        )}

        {tab === 'history' && (
          <div className="pt-1">
            <PaymentsHistoryCard />
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function ProfileRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-right text-sm font-medium break-all">{value}</span>
      </div>
      {hint ? <p className="text-xs text-muted-foreground sm:text-left text-right">{hint}</p> : null}
    </div>
  )
}
