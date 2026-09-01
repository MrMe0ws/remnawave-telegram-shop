import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { ReferralBonusRules } from './referralModel'

/** Плитки условий: за что и сколько дней. */
function termTiles(rules: ReferralBonusRules) {
  // Собираем списком, а не сеткой на три ячейки: в обычном режиме продлений
  // нет, и третья колонка оставалась бы дыркой.
  return [
    { key: 'first', value: rules.first, textKey: 'referralPage.calc.ruleFirst' },
    rules.repeat > 0
      ? { key: 'repeat', value: rules.repeat, textKey: 'referralPage.calc.ruleRepeat' }
      : null,
    rules.referee > 0
      ? { key: 'referee', value: rules.referee, textKey: 'referralPage.calc.ruleReferee' }
      : null,
  ].filter((tile): tile is { key: string; value: number; textKey: string } => tile !== null)
}

/**
 * Сводка условий одной строкой: «+7 · +3 · +7».
 *
 * Стоит в шапке свёрнутой секции и отвечает на вопрос «сколько платят»
 * целиком — раскрывать секцию нужно только за формулировками.
 */
export function referralTermsHint(rules: ReferralBonusRules): string {
  return termTiles(rules)
    .map((tile) => `+${tile.value}`)
    .join(' · ')
}

/**
 * Условия программы: за что и сколько дней.
 *
 * Строками, а не крупными плитками: плитки занимали на телефоне треть экрана
 * ради трёх коротких фраз, а число в них стояло над текстом и читалось как
 * заголовок раздела. В строке число слева фиксированной колонкой, за что —
 * справа; глаз идёт по столбцу чисел и находит нужное, не перечитывая.
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
  const tiles = termTiles(rules)

  return (
    <div className={cn('space-y-2', className)}>
      {tiles.map((tile) => (
        <div key={tile.key} className="flex items-baseline gap-3">
          <span className="w-[68px] shrink-0 text-sm font-bold tabular-nums tracking-tight text-primary">
            {t('referralPage.days', { n: tile.value })}
          </span>
          <span className="min-w-0 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            {t(tile.textKey)}
          </span>
        </div>
      ))}
    </div>
  )
}
