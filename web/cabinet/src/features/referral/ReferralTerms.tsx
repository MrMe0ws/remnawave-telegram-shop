import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { ReferralBonusRules } from './referralModel'

/**
 * Условия программы тремя плитками: за что и сколько дней.
 *
 * Заменяют собой карточку «Как начисляются бонусы». Та пересказывала словами
 * ровно эти три числа, стояла в самом низу страницы и повторяла то, что уже
 * сказали калькулятор и схема потока. Плитки говорят то же самое, но их видно
 * сразу и они не спорят с остальной страницей.
 *
 * Показываются в обоих состояниях страницы: тому, кто уже участвует, оффер не
 * нужен, а вот сверить ставки — обычное дело.
 */
export function ReferralTerms({
  rules,
  className,
}: {
  rules: ReferralBonusRules
  className?: string
}) {
  const { t } = useTranslation()

  // Плитки собираем списком, а число колонок берём из их количества: в обычном
  // режиме продлений нет, и сетка на три колонки оставляла бы дырку.
  const tiles = [
    { key: 'first', value: rules.first, text: t('referralPage.calc.ruleFirst') },
    rules.repeat > 0
      ? { key: 'repeat', value: rules.repeat, text: t('referralPage.calc.ruleRepeat') }
      : null,
    rules.referee > 0
      ? { key: 'referee', value: rules.referee, text: t('referralPage.calc.ruleReferee') }
      : null,
  ].filter((tile): tile is { key: string; value: number; text: string } => tile !== null)

  return (
    <div
      className={cn(
        'grid gap-2.5',
        tiles.length >= 3 ? 'sm:grid-cols-3' : tiles.length === 2 ? 'sm:grid-cols-2' : '',
        className,
      )}
    >
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-xl border border-border bg-muted p-3">
          {/* Подпись под числом, а не над ним: здесь главное не сама цифра,
              а за что её дают. */}
          <p className="text-lg font-bold tracking-tight text-primary">
            {t('referralPage.days', { n: tile.value })}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tile.text}</p>
        </div>
      ))}
    </div>
  )
}
