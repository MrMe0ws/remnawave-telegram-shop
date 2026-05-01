import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Copy, Check, Users, BookOpen, Upload } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

export default function ReferralProgramPage() {
  const { t } = useTranslation()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const canShare = useMemo(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function', [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api.referrals(),
    staleTime: 60_000,
    retry: 1,
  })

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  async function share(text: string) {
    if (!canShare) return
    try {
      await navigator.share({
        text: `${t('referralPage.shareInviteText')}\n${text}`,
      })
    } catch {
      // user cancelled share sheet
    }
  }

  const stats = data?.stats
  const bonusClass = 'font-semibold text-emerald-600 dark:text-emerald-400'

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">{t('referralPage.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('referralPage.intro')}</p>

        {!isLoading && !error && data && (
          <Card className="border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <BookOpen size={18} className="text-primary" />
                {t('referralPage.howTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {data.referral_mode === 'progressive' ? (
                <>
                  <p>{t('referralPage.howProgressiveIntro')}</p>
                  <ul className="list-disc space-y-1.5 pl-5">
                    <li>
                      <Trans
                        i18nKey="referralPage.howProgressiveFirst"
                        values={{
                          ref: data.referral_first_referrer_days ?? 0,
                          referee: data.referral_first_referee_days ?? 0,
                        }}
                        components={[
                          <span className={bonusClass} key="ref" />,
                          <span className={bonusClass} key="referee" />,
                        ]}
                      />
                    </li>
                    <li>
                      <Trans
                        i18nKey="referralPage.howProgressiveNext"
                        values={{ n: data.referral_repeat_referrer_days ?? 0 }}
                        components={[<span className={bonusClass} key="repeat" />]}
                      />
                    </li>
                  </ul>
                </>
              ) : (
                <p>
                  <Trans
                    i18nKey="referralPage.howDefault"
                    values={{
                      n: data.referral_bonus_days_default ?? data.stats.referral_days_per_paid_default,
                    }}
                    components={[<span className={bonusClass} key="default" />]}
                  />
                </p>
              )}
              <p className="text-xs">{t('referralPage.howLinksHint')}</p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : error ? (
          <p className="text-sm text-destructive">{t('errors.unknown')}</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('referralPage.linksTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data?.bot_start_link ? (
                  <CopyRow
                    label={t('referralPage.linkBot')}
                    value={data.bot_start_link}
                    copied={copiedKey === 'bot'}
                    onCopy={() => void copy(data.bot_start_link!, 'bot')}
                    canShare={canShare}
                    onShare={() => void share(data.bot_start_link!)}
                  />
                ) : null}
                {data?.cabinet_register_link ? (
                  <CopyRow
                    label={t('referralPage.linkCabinet')}
                    value={data.cabinet_register_link}
                    copied={copiedKey === 'cab'}
                    onCopy={() => void copy(data.cabinet_register_link!, 'cab')}
                    canShare={canShare}
                    onShare={() => void share(data.cabinet_register_link!)}
                  />
                ) : null}
                {!data?.bot_start_link && !data?.cabinet_register_link ? (
                  <p className="text-sm text-muted-foreground">{t('referralPage.noLinks')}</p>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label={t('referralPage.statTotal')} value={String(stats?.total ?? 0)} sub={t('referralPage.statActiveSub', { n: stats?.active ?? 0 })} />
              <StatCard
                label={t('referralPage.statEarnedDays')}
                value={String(stats?.earned_days_total ?? 0)}
                sub={t('referralPage.statLastMonth', { n: stats?.earned_days_last_month ?? 0 })}
              />
              <StatCard label={t('referralPage.statConversion')} value={`${stats?.conversion_pct ?? 0}%`} sub={t('referralPage.statPaid', { n: stats?.paid ?? 0 })} />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Users size={18} className="text-muted-foreground" />
                <CardTitle className="text-base">{t('referralPage.listTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.referees?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">{t('referralPage.emptyList')}</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {data.referees.map((r, i) => (
                      <li key={`${r.telegram_id_masked}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                        <span className="font-mono text-xs">
                          {r.telegram_username
                            ? r.telegram_username.includes(' ')
                              ? r.telegram_username
                              : `@${r.telegram_username}`
                            : r.email
                              ? maskReferralEmail(r.email)
                              : r.telegram_id_masked}
                        </span>
                        <Badge variant={r.active ? 'default' : 'secondary'}>{r.active ? t('referralPage.badgeActive') : t('referralPage.badgeInactive')}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  )
}

function maskReferralEmail(email: string): string {
  const value = String(email).trim().toLowerCase()
  const at = value.lastIndexOf('@')
  if (at <= 0 || at >= value.length - 1) return value
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (local.length <= 1) return `${local}***@${domain}`
  return `${local[0]}***${local[local.length - 1]}@${domain}`
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  canShare,
  onShare,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
  canShare: boolean
  onShare: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
        <div className="min-w-0 w-full rounded-lg bg-muted px-3 py-2 text-xs font-mono truncate md:flex-1">{value}</div>
        <div className="flex flex-wrap items-center gap-2 md:ml-auto md:shrink-0">
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={onCopy}>
            {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
            {copied ? t('subscriptionPage.copied') : t('subscriptionPage.copyLink')}
          </Button>
          {canShare ? (
            <Button
              type="button"
              size="sm"
              className="shrink-0 gap-1 shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
              onClick={onShare}
            >
              <Upload size={14} strokeWidth={1.5} />
              {t('common.share')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
