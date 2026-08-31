import { useTranslation } from 'react-i18next'
import { CalendarClock, CreditCard, Link2, UserPlus } from 'lucide-react'

import { OfferFlow, type OfferFlowNode } from '@/components/OfferFlow'
import { Card, CardContent } from '@/components/ui/card'

import type { ReferralBonusRules } from './referralModel'

/**
 * Механика рефералки схемой: ссылка → регистрация → оплата → продления.
 *
 * Заменяет нумерованный список шагов. Последний узел выделен, потому что он и
 * есть ответ на вопрос «а дальше»: в прогрессивном режиме бонус приходит не
 * один раз. Если продлений в режиме нет, узла тоже нет — обещать повторные
 * начисления там, где их не будет, нельзя.
 */
export function ReferralFlow({ rules }: { rules: ReferralBonusRules }) {
  const { t } = useTranslation()
  const recurring = rules.repeat > 0

  const nodes: OfferFlowNode[] = [
    {
      icon: Link2,
      title: t('referralPage.flow.n1'),
      text: t('referralPage.flow.n1sub'),
    },
    {
      icon: UserPlus,
      title: t('referralPage.flow.n2'),
      text:
        rules.referee > 0
          ? t('referralPage.flow.n2sub', { n: rules.referee })
          : t('referralPage.flow.n2subNoGift'),
    },
    {
      icon: CreditCard,
      title: t('referralPage.flow.n3'),
      text: t('referralPage.flow.n3sub', { n: rules.first }),
      accent: !recurring,
    },
  ]

  if (recurring) {
    nodes.push({
      icon: CalendarClock,
      title: t('referralPage.flow.n4'),
      text: t('referralPage.flow.n4sub', { n: rules.repeat }),
      accent: true,
    })
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold tracking-tight">{t('referralPage.flow.title')}</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          {recurring
            ? t('referralPage.flow.subtitle', { first: rules.first, repeat: rules.repeat })
            : t('referralPage.flow.subtitleOnce', { first: rules.first })}
        </p>

        <OfferFlow className="mt-5" nodes={nodes} />
      </CardContent>
    </Card>
  )
}
