import { Trans, useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReferralsResponse } from '@/lib/api'

const bonusClass = 'font-semibold text-emerald-600 dark:text-emerald-400'

/**
 * Точные правила начисления — текстом, для всех трёх конфигураций сразу.
 *
 * Схема потока рядом показывает механику, но не выражает тонкостей вроде
 * помесячного начисления и того, что обе ссылки ведут на один аккаунт.
 * Формулировки заданы настройками бота и должны совпадать с тем, что человек
 * читал в самом боте, — поэтому это отдельный блок, а не подпись под схемой.
 */
export function ReferralRulesCard({ data }: { data: ReferralsResponse }) {
  const { t } = useTranslation()

  return (
    <Card className="h-full">
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
                      values={{ referee: data.referral_first_referee_days ?? 0 }}
                      components={[<span className={bonusClass} key="next" />]}
                    />
                  </li>
                </ul>
                {/* Обе ссылки ведут на один аккаунт — без этой строчки
                    регулярно спрашивают, какую из них «правильную» давать. */}
                <p className="text-xs">{t('referralPage.linksHint')}</p>
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
      </CardContent>
    </Card>
  )
}
