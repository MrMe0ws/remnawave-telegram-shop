import { useTranslation } from 'react-i18next'

import { cn, formatDate } from '@/lib/utils'

type Props = {
  expireAt: string | null | undefined
  lang: string
  days: number | null
  isActive: boolean
  className?: string
}

export function SubscriptionExpireAtBlock({ expireAt, lang, days, isActive, className }: Props) {
  const { t } = useTranslation()
  const isExpired = !isActive
  const tone = expireAtTone(days, isActive)

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        isExpired ? 'border-destructive/55 bg-destructive/10' : tone.cardClass,
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
          isExpired ? 'bg-destructive/15' : tone.iconBgClass,
        )}
      >
        <CalendarExpireIcon className={isExpired ? 'text-destructive' : tone.iconClass} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[11px] uppercase tracking-[0.14em]',
            isExpired ? 'text-destructive/80' : tone.labelClass,
          )}
        >
          {t('subscriptionPage.expireAt')}
        </p>
        <p className="mt-1 text-[1.1rem] font-medium">
          {expireAt ? formatDate(expireAt, lang) : '—'}
        </p>
        <p className={cn('mt-1 text-xs', daysLeftToneClass(days, isActive))}>
          {days !== null
            ? isActive
              ? t('subscriptionPage.daysLeft', { n: days })
              : t('subscriptionPage.statusExpired')
            : t('subscriptionPage.statusNone')}
        </p>
      </div>
    </div>
  )
}

function daysLeftToneClass(days: number | null, isActive: boolean): string {
  if (!isActive) return 'text-destructive'
  if (days != null && days < 3) return 'text-destructive'
  if (days != null && days < 7) return 'text-amber-700 dark:text-[#fde68ab3]'
  return 'text-emerald-600 dark:text-emerald-300'
}

function expireAtTone(
  days: number | null,
  isActive: boolean,
): { cardClass: string; labelClass: string; iconBgClass: string; iconClass: string } {
  if (!isActive || days == null || days < 3) {
    return {
      cardClass: 'border-destructive/55 bg-destructive/10',
      labelClass: 'text-destructive/80',
      iconBgClass: 'bg-destructive/15',
      iconClass: 'text-destructive',
    }
  }
  if (days < 7) {
    return {
      cardClass: 'border-amber-400/80 bg-amber-100/70 dark:border-amber-300/30 dark:bg-amber-500/10',
      labelClass: 'text-amber-800 dark:text-[#fde68ab3]',
      iconBgClass: 'bg-amber-200/80 dark:bg-amber-500/15',
      iconClass: 'text-amber-800 dark:text-[#fde68ab3]',
    }
  }
  return {
    cardClass: 'border-emerald-300/70 bg-emerald-500/10 dark:border-emerald-300/25 dark:bg-emerald-500/10',
    labelClass: 'text-emerald-700/85 dark:text-emerald-300/90',
    iconBgClass: 'bg-emerald-500/15',
    iconClass: 'text-emerald-600 dark:text-emerald-300',
  }
}

function CalendarExpireIcon({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
