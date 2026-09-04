import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CalendarClock, Gauge, Smartphone } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDecimals } from '@/lib/format'
import type { UserCardMetrics } from './userCardMetrics'

type Tone = 'ok' | 'warn' | 'danger' | 'muted'

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  danger: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
  muted: 'border-border bg-secondary text-muted-foreground',
}

function Pill({ tone, icon, children }: { tone: Tone; icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        TONE_CLASS[tone],
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/**
 * Строка состояния: ответ на вопрос «что с этим пользователем не так».
 *
 * Три величины, ради которых карточку и открывают, — остаток срока, расход
 * трафика и занятость устройств — собраны в одну строку и окрашены по
 * состоянию. Раньше их приходилось собирать глазами из трёх мест экрана.
 */
export function AdminUserStateStrip({ metrics }: { metrics: UserCardMetrics }) {
  const { t } = useTranslation()

  const days = metrics.days
  const expireTone: Tone = days == null ? 'muted' : days < 0 ? 'danger' : days <= 3 ? 'warn' : 'ok'
  const expireText =
    days == null
      ? t('admin.users.overview.stripNoExpire')
      : days < 0
        ? t('admin.users.overview.stripExpiredDays', { count: Math.abs(days) })
        : t('admin.users.overview.stripDaysLeft', { count: days })

  const percent = metrics.trafficPercent
  const trafficTone: Tone = percent == null ? 'muted' : percent >= 95 ? 'danger' : percent >= 80 ? 'warn' : 'muted'
  const trafficText =
    percent == null
      ? t('admin.users.overview.stripTrafficUnlimited')
      : t('admin.users.overview.stripTrafficUsed', { percent: formatDecimals(percent, 1) })

  return (
    <Card className="cabinet-elevated-card flex flex-wrap items-center gap-2 px-4 py-3">
      <Pill tone={expireTone} icon={<CalendarClock className="size-3.5 shrink-0" aria-hidden />}>
        {expireText}
      </Pill>
      <Pill tone={trafficTone} icon={<Gauge className="size-3.5 shrink-0" aria-hidden />}>
        {trafficText}
      </Pill>
      <Pill
        tone={metrics.devicesFull ? 'warn' : 'muted'}
        icon={
          metrics.devicesFull ? (
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <Smartphone className="size-3.5 shrink-0" aria-hidden />
          )
        }
      >
        {metrics.devicesFull
          ? t('admin.users.overview.stripDevicesFull', {
              used: metrics.devicesUsed,
              limit: metrics.devicesLimit,
            })
          : t('admin.users.overview.stripDevices', {
              used: metrics.devicesUsed,
              limit: metrics.devicesLimit,
            })}
      </Pill>
    </Card>
  )
}
