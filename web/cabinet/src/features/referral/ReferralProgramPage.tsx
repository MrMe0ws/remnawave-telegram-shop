import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { PageReveal, RevealItem } from '@/components/PageReveal'
import { PageTitleWithBack } from '@/components/PageTitleWithBack'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type ReferralsResponse } from '@/lib/api'

import { ReferralCalculator } from './ReferralCalculator'
import { ReferralFlow } from './ReferralFlow'
import { ReferralInviteCard, type ReferralLink } from './ReferralInviteCard'
import { ReferralProgress } from './ReferralProgress'
import { ReferralRefereesCard } from './ReferralRefereesCard'
import { ReferralRulesCard } from './ReferralRulesCard'
import { referralBonusRules, type ReferralBonusRules } from './referralModel'

export default function ReferralProgramPage() {
  const { t } = useTranslation()
  const canShare = useMemo(
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    [],
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api.referrals(),
    staleTime: 60_000,
    retry: 1,
  })

  async function share(url: string) {
    if (!canShare) return
    try {
      await navigator.share({ text: `${t('referralPage.shareInviteText')}\n${url}` })
    } catch {
      // user cancelled share sheet
    }
  }

  /*
   * Страница живёт в широкой колонке, в отличие от остального кабинета.
   *
   * Её задача — не показать таблицу, а добиться, чтобы ссылкой поделились:
   * калькулятору и схеме потока нужна ширина, чтобы встать в две колонки, а не
   * в стопку. В max-w-2xl на десктопе это выглядело вытянутым мобильным
   * экраном. Списки внизу разведены по двум колонкам, поэтому ширина не
   * пропадает и на них.
   */
  return (
    <AppLayout>
      <PageReveal className="mx-auto w-full max-w-5xl space-y-6">
        <RevealItem>
          <PageTitleWithBack title={t('referralPage.title')} />
        </RevealItem>

        {isLoading ? (
          <RevealItem>
            <ReferralSkeleton />
          </RevealItem>
        ) : error ? (
          <RevealItem>
            <p className="text-sm text-destructive">{t('errors.unknown')}</p>
          </RevealItem>
        ) : data ? (
          <ReferralBody data={data} canShare={canShare} onShare={share} />
        ) : null}
      </PageReveal>
    </AppLayout>
  )
}

/**
 * Порядок блоков решает состояние пользователя.
 *
 * У кого бонусных дней ещё нет — показывать прогресс нечем: пустое кольцо
 * читается как «ты ничего не добился». Ему сначала приглашение, потом
 * калькулятор: показывать нечего, зато есть что пообещать.
 *
 * У кого дни уже начислены — наоборот, первым экраном прогресс: он про него и
 * пришёл. Калькулятор уезжает под кнопку «а если позвать ещё», потому что
 * уговаривать того, кто уже участвует, незачем.
 *
 * Набор блоков один и тот же — меняется только первый экран. Это дешевле, чем
 * держать две страницы.
 */
function ReferralBody({
  data,
  canShare,
  onShare,
}: {
  data: ReferralsResponse
  canShare: boolean
  onShare: (url: string) => void
}) {
  const { t } = useTranslation()

  const rules = referralBonusRules(data)
  const earnedDays = data.stats.earned_days_total ?? 0
  const started = earnedDays > 0

  const links: ReferralLink[] = []
  if (data.bot_start_link) {
    links.push({ key: 'bot', label: t('referralPage.linkBotShort'), url: data.bot_start_link })
  }
  if (data.cabinet_register_link) {
    links.push({
      key: 'cabinet',
      label: t('referralPage.linkCabinetShort'),
      url: data.cabinet_register_link,
    })
  }

  const invite = links.length ? (
    <ReferralInviteCard
      links={links}
      refereeDays={rules.referee}
      canShare={canShare}
      onShare={onShare}
    />
  ) : (
    <Card>
      <CardContent className="pt-6 text-sm text-muted-foreground">
        {t('referralPage.noLinks')}
      </CardContent>
    </Card>
  )

  const bottom = data.referees.length ? (
    <RevealItem className="grid gap-6 lg:grid-cols-2">
      <ReferralRefereesCard referees={data.referees} />
      <ReferralRulesCard data={data} />
    </RevealItem>
  ) : (
    <RevealItem>
      <ReferralRulesCard data={data} />
    </RevealItem>
  )

  if (started) {
    return (
      <>
        <RevealItem>
          <ReferralProgress stats={data.stats} rules={rules} />
        </RevealItem>
        <RevealItem>{invite}</RevealItem>
        {bottom}
        <RevealItem>
          <MoreOffer rules={rules} />
        </RevealItem>
      </>
    )
  }

  return (
    <>
      <RevealItem>
        <p className="text-sm text-muted-foreground">{t('referralPage.intro')}</p>
      </RevealItem>
      <RevealItem>{invite}</RevealItem>
      <RevealItem>
        <ReferralCalculator rules={rules} />
      </RevealItem>
      <RevealItem>
        <ReferralFlow rules={rules} />
      </RevealItem>
      {bottom}
    </>
  )
}

/** Оффер для того, кто уже участвует: по кнопке, а не поперёк его статистики. */
function MoreOffer({ rules }: { rules: ReferralBonusRules }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="outline" className="w-full gap-2" onClick={() => setOpen(true)}>
        <ChevronDown size={16} />
        {t('referralPage.moreOffer')}
      </Button>
    )
  }

  return (
    <div className="space-y-6">
      <ReferralCalculator rules={rules} />
      <ReferralFlow rules={rules} />
    </div>
  )
}

/** Заглушка: приглашение с QR, калькулятор и списки. */
function ReferralSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-6">
            <Skeleton className="mx-auto size-[168px] rounded-xl sm:mx-0" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-6 w-full rounded-full" />
              <div className="grid grid-cols-2 gap-2.5">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            </div>
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
