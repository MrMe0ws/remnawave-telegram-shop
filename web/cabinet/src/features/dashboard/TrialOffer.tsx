import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Calendar, ChevronRight, Gauge, Infinity as InfinityIcon, MonitorSmartphone, Smartphone, Sparkles, Zap, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { api, type TariffItem, type TrialInfoResponse } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Что видит новый пользователь на главной.
 *
 * Два состояния одной карточки: пробный период доступен — предложение его
 * активировать, недоступен — витрина тарифов. Раньше во втором случае был
 * тупик: кнопка гасла с подписью «Пробный период недоступен», и предложить
 * человеку было нечего.
 *
 * Разделов (тарифы, рефералы, промокоды) под карточкой намеренно нет: они
 * уводят от единственной задачи — довести человека до работающего VPN.
 * Кто пришёл покупать, уходит по ссылке под кнопкой.
 */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[hsl(var(--cabinet-accent)/0.35)] bg-[hsl(var(--cabinet-accent)/0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--cabinet-accent))]">
      {children}
    </span>
  )
}

/** Плитка с цифрой: цифра крупно, единица под ней. */
function StatTile({ icon: Icon, value, unit }: { icon: LucideIcon; value: React.ReactNode; unit: string }) {
  return (
    <div className="cabinet-stat-tile px-1.5 py-3">
      <span className="cabinet-icon-box mx-auto mb-1.5 inline-flex size-7 items-center justify-center rounded-lg">
        <Icon size={14} />
      </span>
      <div className="font-heading text-2xl font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">
        {unit}
      </div>
    </div>
  )
}

/** Уход к тарифам мимо пробного: не акцент, но и не потерянная подпись. */
function SkipToTariffs() {
  const { t } = useTranslation()
  return (
    <div className="mt-5 border-t border-border/70 pt-4">
      <Link
        to="/tariffs"
        className="cabinet-row flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-secondary/60 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('dashboard.trialSkipToTariffs')}
        <ChevronRight className="cabinet-row-chevron size-4 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  )
}

/**
 * Предложение пробного периода: одна цифра, две рядом строкой, одна кнопка.
 *
 * Блик на кнопке постоянный — это единственное действие на экране, в отличие
 * от «Подключить устройство», где он появляется только при нуле устройств.
 */
export function TrialOfferCard({
  trial,
  onActivate,
  activating,
}: {
  trial?: TrialInfoResponse | null
  onActivate: () => void
  activating: boolean
}) {
  const { t } = useTranslation()
  const days = trial?.days ?? 0
  const trafficGb = trial?.traffic_gb ?? 0
  const devices = trial?.device_limit ?? 0

  return (
    <div className="subscription-feature-card relative overflow-hidden p-6 text-center">
      <span className="cabinet-onb-aurora" aria-hidden />

      <div className="relative">
        <Pill>{t('dashboard.trialOfferPill')}</Pill>

        <div className="mt-4 font-heading text-6xl font-bold leading-none sm:text-7xl">
          <span className="cabinet-gradient-text">{days}</span>
        </div>
        <div className="mt-2 font-heading text-xl font-bold">
          {t('dashboard.trialOfferCaption', { count: days })}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('dashboard.trialSubtitle')}</p>

        {/* Иконки обязательны: без них строка читалась как подпись, а не как характеристики. */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <span className="cabinet-icon-box inline-flex size-6 items-center justify-center rounded-md">
              <Gauge size={13} />
            </span>
            {t('dashboard.trialStatTraffic', { n: formatNumber(trafficGb) })}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <span className="cabinet-icon-box inline-flex size-6 items-center justify-center rounded-md">
              <Smartphone size={13} />
            </span>
            {t('dashboard.trialStatDevices', { count: devices })}
          </span>
        </div>

        <span className="cabinet-attn-sheen mt-5 block">
          <Button className="h-12 w-full" onClick={onActivate} loading={activating}>
            {t('dashboard.activateTrial')}
          </Button>
        </span>

        <SkipToTariffs />
      </div>
    </div>
  )
}

/**
 * Витрина в цифрах, когда пробный недоступен.
 *
 * Всё считается из ответа /tariffs, ничего не зашито: цена — минимальная
 * месячная по витрине, устройства — максимальный лимит, трафик — ∞, если
 * хоть один тариф безлимитный, иначе максимум в ГБ, выгода — разница
 * месячной цены самого длинного и самого короткого периода. Плитка, которую
 * посчитать не из чего, не выводится: прочерк хуже её отсутствия.
 */
function summarize(tariffs: TariffItem[]) {
  if (!tariffs.length) return null

  const monthly = tariffs.map((x) => x.monthly_base_rub).filter((x) => x > 0)
  if (!monthly.length) return null

  const minMonthly = Math.min(...monthly)
  const maxDevices = Math.max(...tariffs.map((x) => x.device_limit ?? 0))
  // traffic_gb === null у витрины означает безлимит, а не «не задано».
  const unlimited = tariffs.some((x) => x.traffic_gb === null)
  const maxTrafficGb = Math.max(...tariffs.map((x) => x.traffic_gb ?? 0))

  const byMonths = [...tariffs].sort((a, b) => a.months - b.months)
  const shortest = byMonths[0]
  const longest = byMonths[byMonths.length - 1]
  const savingPct =
    shortest && longest && longest.months > shortest.months && shortest.monthly_base_rub > 0
      ? Math.round((1 - longest.monthly_base_rub / shortest.monthly_base_rub) * 100)
      : 0

  return {
    minMonthly,
    maxDevices: maxDevices > 0 ? maxDevices : null,
    unlimited,
    maxTrafficGb: maxTrafficGb > 0 ? maxTrafficGb : null,
    savingPct: savingPct > 0 ? savingPct : null,
    longestMonths: longest?.months ?? 0,
  }
}

export function TariffsOfferCard({ trialEnabled }: { trialEnabled: boolean }) {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['tariffs'],
    queryFn: () => api.tariffs(),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const summary = useMemo(() => summarize(data?.tariffs ?? []), [data])

  const tiles: { icon: LucideIcon; value: React.ReactNode; unit: string }[] = []
  if (summary?.maxDevices) {
    tiles.push({
      icon: MonitorSmartphone,
      value: summary.maxDevices,
      unit: t('dashboard.tariffsStatDevices'),
    })
  }
  if (summary?.unlimited) {
    tiles.push({
      icon: Gauge,
      value: <InfinityIcon size={22} className="mx-auto" aria-hidden />,
      unit: t('dashboard.tariffsStatTraffic'),
    })
  } else if (summary?.maxTrafficGb) {
    tiles.push({
      icon: Gauge,
      value: formatNumber(summary.maxTrafficGb),
      unit: t('dashboard.tariffsStatTrafficGb'),
    })
  }
  if (summary?.savingPct) {
    tiles.push({
      icon: Calendar,
      value: `−${summary.savingPct}%`,
      unit: t('dashboard.tariffsStatSaving', { count: summary.longestMonths }),
    })
  }

  return (
    <div className="subscription-feature-card cabinet-accent-violet relative overflow-hidden p-5 sm:p-6">
      <span className="cabinet-onb-aurora" aria-hidden />

      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="cabinet-icon-box inline-flex size-11 items-center justify-center rounded-2xl">
            <Zap size={20} />
          </span>
          <Pill>{t('dashboard.tariffsOfferPill')}</Pill>
        </div>

        <h2 className="mt-4 font-heading text-3xl font-bold leading-[1.1] sm:text-4xl">
          {summary ? (
            <>
              {t('dashboard.tariffsOfferPrefix')}{' '}
              {/* Округляем: у длинных периодов месячная цена дробная (133,33 ₽). */}
              <span className="cabinet-gradient-text">
                {formatNumber(Math.round(summary.minMonthly))} ₽
              </span>{' '}
              {t('dashboard.tariffsOfferSuffix')}
            </>
          ) : (
            t('dashboard.tariffsOfferFallbackTitle')
          )}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {trialEnabled
            ? t('dashboard.tariffsOfferSubtitleUsed')
            : t('dashboard.tariffsOfferSubtitleOff')}
        </p>

        {tiles.length > 0 && (
          <div className={cn('mt-5 grid gap-2', tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
            {tiles.map((tile) => (
              <StatTile key={tile.unit} icon={tile.icon} value={tile.value} unit={tile.unit} />
            ))}
          </div>
        )}

        <Button asChild className="mt-5 h-12 w-full">
          <Link to="/tariffs">{t('dashboard.tariffsOfferCta')}</Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * Напоминание про резервный вход.
 *
 * Появляется, когда способ входа один: потерял его — потерял аккаунт.
 * Исчезает само, как только привязан второй. Тот же порог, что подсвечивает
 * CTA «Привязанные аккаунты» в профиле.
 */
export function BackupLoginRow() {
  const { t } = useTranslation()
  return (
    <Link
      to="/profile"
      className="subscription-feature-card cabinet-accent-emerald cabinet-row flex items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="cabinet-icon-box inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Sparkles size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t('dashboard.backupLoginTitle')}</span>
        <span className="block text-xs text-muted-foreground">{t('dashboard.backupLoginHint')}</span>
      </span>
      <ChevronRight className="cabinet-row-chevron size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
