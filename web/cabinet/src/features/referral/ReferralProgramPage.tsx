import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, Check, Users, BookOpen } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

export default function ReferralProgramPage() {
  const { t } = useTranslation()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

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

  const stats = data?.stats

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
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
                      {t('referralPage.howProgressiveFirst', {
                        ref: data.referral_first_referrer_days ?? 0,
                        referee: data.referral_first_referee_days ?? 0,
                      })}
                    </li>
                    <li>
                      {t('referralPage.howProgressiveNext', {
                        n: data.referral_repeat_referrer_days ?? 0,
                      })}
                    </li>
                  </ul>
                </>
              ) : (
                <p>{t('referralPage.howDefault', { n: data.referral_bonus_days_default ?? data.stats.referral_days_per_paid_default })}</p>
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
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label={t('referralPage.statTotal')} value={String(stats?.total ?? 0)} sub={t('referralPage.statActiveSub', { n: stats?.active ?? 0 })} />
              <StatCard
                label={t('referralPage.statEarnedDays')}
                value={String(stats?.earned_days_total ?? 0)}
                sub={t('referralPage.statLastMonth', { n: stats?.earned_days_last_month ?? 0 })}
              />
              <StatCard label={t('referralPage.statConversion')} value={`${stats?.conversion_pct ?? 0}%`} sub={t('referralPage.statPaid', { n: stats?.paid ?? 0 })} />
            </div>

            {data?.referral_mode === 'progressive' && (
              <p className="text-xs text-muted-foreground">{t('referralPage.progressiveHint')}</p>
            )}

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
                  />
                ) : null}
                {data?.cabinet_register_link ? (
                  <CopyRow
                    label={t('referralPage.linkCabinet')}
                    value={data.cabinet_register_link}
                    copied={copiedKey === 'cab'}
                    onCopy={() => void copy(data.cabinet_register_link!, 'cab')}
                  />
                ) : null}
                {!data?.bot_start_link && !data?.cabinet_register_link ? (
                  <p className="text-sm text-muted-foreground">{t('referralPage.noLinks')}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t('referralPage.defaultDaysHint', { n: stats?.referral_days_per_paid_default ?? 0 })}
                </p>
              </CardContent>
            </Card>

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
                        <span className="font-mono text-xs">{r.telegram_id_masked}</span>
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
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono truncate">{value}</div>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={onCopy}>
          {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
          {copied ? t('subscriptionPage.copied') : t('subscriptionPage.copyLink')}
        </Button>
      </div>
    </div>
  )
}
