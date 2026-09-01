import { useTranslation } from 'react-i18next'
import { Copy, Check, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

/**
 * Строка «ссылка + скопировать + поделиться».
 *
 * Состояние копирования живёт внутри: раньше каждая страница вела свой `copiedKey`
 * и свою async-функцию с `navigator.clipboard.writeText` без обработки ошибок.
 *
 * `compact` — вариант для карточки приглашения: лейбл уходит в aria-label, а
 * кнопки становятся квадратными по 44px. Там строка стоит под QR-кодом, где
 * подпись «Ссылка, которую увидит друг» и два текстовых батона занимали две
 * лишние строки. В партнёрке и профиле, где ссылок несколько подряд и их надо
 * различать, остаётся обычный вид с подписью.
 */
export function ReferralCopyRow({
  label,
  value,
  canShare,
  onShare,
  compact = false,
}: {
  label: string
  value: string
  canShare: boolean
  onShare: () => void
  compact?: boolean
}) {
  const { t } = useTranslation()
  const { state, copy } = useCopyToClipboard()

  const copyLabel = state === 'done' ? t('subscriptionPage.copied') : t('subscriptionPage.copyLink')

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div
            className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-3 font-mono text-[11.5px] leading-tight"
            aria-label={label}
          >
            {value}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 rounded-xl"
            aria-label={copyLabel}
            title={copyLabel}
            onClick={() => void copy(value)}
          >
            {state === 'done' ? <Check className="text-primary" /> : <Copy />}
          </Button>
          {canShare ? (
            <Button
              type="button"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              aria-label={t('common.share')}
              title={t('common.share')}
              onClick={onShare}
            >
              <Upload strokeWidth={1.5} />
            </Button>
          ) : null}
        </div>
        <p aria-live="polite" className="sr-only">
          {state === 'done' ? t('subscriptionPage.copied') : ''}
        </p>
        {state === 'failed' && <p className="text-xs text-destructive">{t('common.copyFailed')}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
        <div className="min-w-0 w-full rounded-lg bg-muted px-3 py-2 text-xs font-mono truncate md:flex-1">{value}</div>
        <div className="flex flex-wrap items-center gap-2 md:ml-auto md:shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1"
            onClick={() => void copy(value)}
          >
            {state === 'done' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
            {copyLabel}
          </Button>
          {canShare ? (
            <Button
              type="button"
              size="sm"
              className="shrink-0 gap-1 shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1),0_2px_4px_-2px_rgb(0_0_0_/_0.1)]"
              onClick={onShare}
            >
              <Upload size={14} strokeWidth={1.5} />
              {t('common.share')}
            </Button>
          ) : null}
        </div>
      </div>
      {/* Смена текста кнопки скринридером не объявляется — дублируем в live-регион. */}
      <p aria-live="polite" className="sr-only">
        {state === 'done' ? t('subscriptionPage.copied') : ''}
      </p>
      {state === 'failed' && <p className="text-xs text-destructive">{t('common.copyFailed')}</p>}
    </div>
  )
}
