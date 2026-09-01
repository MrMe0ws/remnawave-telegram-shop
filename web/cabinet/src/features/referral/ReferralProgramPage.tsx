import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, History, Percent, Users } from 'lucide-react'

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
import { ReferralLedgerList } from './ReferralLedgerList'
import { ReferralProgress } from './ReferralProgress'
import { ReferralRefereesList } from './ReferralRefereesList'
import { ReferralSection } from './ReferralSection'
import { ReferralTerms, referralTermsHint } from './ReferralTerms'
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
 * У кого бонусных дней ещё нет — показывать прогресс нечем: пустая полоса
 * читается как «ты ничего не добился». Ему сначала приглашение, потом
 * калькулятор: показывать нечего, зато есть что пообещать.
 *
 * У кого дни уже начислены — наоборот, первым экраном прогресс: он про него и
 * пришёл. Сразу под ним приглашение, а справки и списки — свёрнутыми
 * секциями, чтобы до кнопки «Поделиться» не пришлось прокручивать три экрана
 * на телефоне. Калькулятор уезжает под кнопку «а если позвать ещё», потому что
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

  /*
   * Низ страницы — два списка в ряд.
   *
   * Список приглашённых и лента начислений отвечают на разные вопросы: «кто у
   * меня есть» и «откуда взялись дни». Первый пустует у новичка, вторая — пока
   * никто не оплатил, поэтому пара собирается из того, что реально есть, а не
   * прибита к колонкам гвоздями: пустая колонка выглядит как поломка вёрстки.
   */
  const bottomCards = [
    data.ledger.length ? (
      <ReferralSection
        key="ledger"
        icon={History}
        title={t('referralPage.ledger.title')}
        hint={String(data.ledger.length)}
      >
        <ReferralLedgerList rows={data.ledger} />
      </ReferralSection>
    ) : null,
    data.referees.length ? (
      <ReferralSection
        key="referees"
        icon={Users}
        title={t('referralPage.listTitle')}
        hint={String(data.referees.length)}
      >
        <ReferralRefereesList referees={data.referees} />
      </ReferralSection>
    ) : null,
  ].filter(Boolean)

  const bottom = bottomCards.length ? (
    <RevealItem className={bottomCards.length > 1 ? 'grid gap-6 lg:grid-cols-2' : undefined}>
      {bottomCards}
    </RevealItem>
  ) : null

  if (started) {
    return (
      <>
        <RevealItem>
          <ReferralProgress stats={data.stats} rules={rules} />
        </RevealItem>
        <RevealItem>{invite}</RevealItem>
        {/* Условия — тоже секцией: сумма «+7 · +3 · +7» видна в шапке, а за
            формулировками разворачивают. Раньше три плитки стояли поперёк
            страницы между прогрессом и приглашением. */}
        <RevealItem>
          <ReferralSection
            icon={Percent}
            title={t('referralPage.termsTitle')}
            hint={referralTermsHint(rules)}
          >
            <ReferralTerms rules={rules} />
          </ReferralSection>
        </RevealItem>
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

/** Заглушка: сводка прогресса и приглашение с QR. */
function ReferralSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-32" />
            </div>
            <Skeleton className="h-6 w-40 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
          <Skeleton className="mt-2 h-3 w-56" />
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <Skeleton className="h-[68px] w-full rounded-xl" />
            <Skeleton className="h-[68px] w-full rounded-xl" />
            <Skeleton className="h-[68px] w-full rounded-xl" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6">
            <Skeleton className="h-12 w-full rounded-2xl sm:order-2" />
            <Skeleton className="mx-auto size-[196px] rounded-xl sm:order-1 sm:mx-0 sm:size-[168px]" />
            <Skeleton className="h-11 w-full rounded-xl sm:order-3" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
