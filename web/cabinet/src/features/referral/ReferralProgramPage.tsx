import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Users, BookOpen } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { PageReveal, RevealItem } from '@/components/PageReveal'
import { ReferralCopyRow } from '@/features/referral/ReferralCopyRow'
import { PageTitleWithBack } from '@/components/PageTitleWithBack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

export default function ReferralProgramPage() {
  const { t } = useTranslation()
  const canShare = useMemo(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function', [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api.referrals(),
    staleTime: 60_000,
    retry: 1,
  })

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

  // Пример на 6 месяцев считаем той же формулой, что и бэкенд: повышенная
  // ставка за первый оплаченный месяц плюс обычная за каждый следующий.
  // Абстрактное правило люди пересчитывают в уме неохотно, конкретное число
  // читается сразу.
  const monthlyExample = useMemo(() => {
    const first = data?.referral_first_referrer_days ?? 0
    const repeat = data?.referral_repeat_referrer_days ?? 0
    return first + repeat * 5
  }, [data?.referral_first_referrer_days, data?.referral_repeat_referrer_days])

  return (
    <AppLayout>
      <PageReveal className="mx-auto w-full max-w-2xl space-y-6">
        <RevealItem>
          <PageTitleWithBack title={t('referralPage.title')} />
        </RevealItem>
        <RevealItem>
          <p className="text-sm text-muted-foreground">{t('referralPage.intro')}</p>
        </RevealItem>

        {!isLoading && !error && data && (
          <RevealItem>
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
                  {data.referral_scale_by_months ? (
                    <>
                      <ul className="list-disc space-y-1.5 pl-5">
                        <li>
                          <Trans
                            i18nKey="referralPage.howProgressiveMonthlyFirst"
                            values={{
                              first: data.referral_first_referrer_days ?? 0,
                              repeat: data.referral_repeat_referrer_days ?? 0,
                              referee: data.referral_first_referee_days ?? 0,
                            }}
                            components={[
                              <span className={bonusClass} key="first" />,
                              <span className={bonusClass} key="repeat" />,
                              <span className={bonusClass} key="referee" />,
                            ]}
                          />
                        </li>
                        <li>
                          <Trans
                            i18nKey="referralPage.howProgressiveMonthlyNext"
                            values={{ repeat: data.referral_repeat_referrer_days ?? 0 }}
                            components={[<span className={bonusClass} key="next" />]}
                          />
                        </li>
                      </ul>
                      <p className="text-xs">
                        {t('referralPage.howProgressiveMonthlyExample', {
                          example: monthlyExample,
                          referee: data.referral_first_referee_days ?? 0,
                        })}
                      </p>
                    </>
                  ) : (
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
                  )}
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
          </RevealItem>
        )}

        {isLoading ? (
          <RevealItem>
            <ReferralSkeleton />
          </RevealItem>
        ) : error ? (
          <RevealItem>
            <p className="text-sm text-destructive">{t('errors.unknown')}</p>
          </RevealItem>
        ) : (
          <>
            <RevealItem>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('referralPage.linksTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data?.bot_start_link ? (
                  <ReferralCopyRow
                    label={t('referralPage.linkBot')}
                    value={data.bot_start_link}
                    canShare={canShare}
                    onShare={() => void share(data.bot_start_link!)}
                  />
                ) : null}
                {data?.cabinet_register_link ? (
                  <ReferralCopyRow
                    label={t('referralPage.linkCabinet')}
                    value={data.cabinet_register_link}
                    canShare={canShare}
                    onShare={() => void share(data.cabinet_register_link!)}
                  />
                ) : null}
                {!data?.bot_start_link && !data?.cabinet_register_link ? (
                  <p className="text-sm text-muted-foreground">{t('referralPage.noLinks')}</p>
                ) : null}
              </CardContent>
            </Card>
            </RevealItem>

            <RevealItem className="grid gap-3 sm:grid-cols-3">
              <StatCard label={t('referralPage.statTotal')} value={String(stats?.total ?? 0)} sub={t('referralPage.statActiveSub', { n: stats?.active ?? 0 })} />
              <StatCard
                label={t('referralPage.statEarnedDays')}
                value={String(stats?.earned_days_total ?? 0)}
                sub={t('referralPage.statLastMonth', { n: stats?.earned_days_last_month ?? 0 })}
              />
              <StatCard label={t('referralPage.statConversion')} value={`${stats?.conversion_pct ?? 0}%`} sub={t('referralPage.statPaid', { n: stats?.paid ?? 0 })} />
            </RevealItem>

            <RevealItem>
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
            </RevealItem>
          </>
        )}
      </PageReveal>
    </AppLayout>
  )
}

/** Заглушка: карточка ссылок, три плитки статистики и список рефералов. */
function ReferralSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-1.5 h-7 w-14" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border rounded-lg border border-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
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

