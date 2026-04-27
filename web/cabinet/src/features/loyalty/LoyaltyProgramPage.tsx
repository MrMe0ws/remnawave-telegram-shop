import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Gem, Gift, Info } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const HOW_LINES: Array<'loyaltyPage.howBullet1' | 'loyaltyPage.howBullet2' | 'loyaltyPage.howBullet3' | 'loyaltyPage.howBullet4'> = [
  'loyaltyPage.howBullet1',
  'loyaltyPage.howBullet2',
  'loyaltyPage.howBullet3',
  'loyaltyPage.howBullet4',
]

export default function LoyaltyProgramPage() {
  const { t } = useTranslation()

  const { data, isLoading, error } = useQuery({
    queryKey: ['loyalty-dashboard'],
    queryFn: () => api.loyalty(),
    staleTime: 60_000,
    retry: 1,
  })

  const discount = data?.current?.discount_percent ?? 0
  const levelLabel =
    data?.current?.display_name?.trim() ||
    t('loyaltyPage.levelNumber', { n: data?.current?.sort_order ?? 0 })

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('loyaltyPage.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('loyaltyPage.subtitle')}</p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : error ? (
          <p className="text-sm text-destructive">{t('errors.unknown')}</p>
        ) : !data?.enabled ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">{t('loyaltyPage.disabled')}</CardContent>
          </Card>
        ) : (
          <>
            {discount === 0 &&
              data.first_discount_xp_min != null &&
              data.first_discount_xp_min > 0 &&
              data.xp < data.first_discount_xp_min && (
                <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                  {t('loyaltyPage.noBonusYet', { xp: data.first_discount_xp_min.toLocaleString('ru-RU') })}
                </p>
              )}

            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-[#0E1A33] via-[#0D1324] to-[#0A1222] text-white shadow-lg">
              <CardContent className="space-y-5 px-6 py-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/15">
                    <Gem size={20} className="text-teal-200" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold leading-tight">
                      {t('loyaltyPage.heroTitle', { level: levelLabel })}
                    </p>
                    <p className="text-xs text-slate-400">{t('loyaltyPage.heroXp', { xp: data.xp.toLocaleString('ru-RU') })}</p>
                  </div>
                </div>

                {data.next != null && data.xp_segment_span > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>
                        {t('loyaltyPage.progressLabel', {
                          cur: data.xp_in_segment.toLocaleString('ru-RU'),
                          span: data.xp_segment_span.toLocaleString('ru-RU'),
                        })}
                      </span>
                      <span>{data.progress_percent}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-[width] duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, data.progress_percent))}%` }}
                      />
                    </div>
                    <p className="text-xs text-teal-200/90">
                      {t('loyaltyPage.untilNext', {
                        xp: data.xp_until_next.toLocaleString('ru-RU'),
                        next: data.next.sort_order,
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">{t('loyaltyPage.maxLevel')}</p>
                )}

                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <Gift size={18} className="shrink-0 text-teal-200" />
                  <p className="text-sm font-medium">{t('loyaltyPage.discountLine', { pct: discount })}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Info size={18} className="text-muted-foreground" />
                  {t('loyaltyPage.howTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {HOW_LINES.map((key) => (
                    <li key={key} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  )
}

/** Заголовок + компактная карточка для профиля (скрывает блок, если лояльность выключена). */
export function ProfileLoyaltySection() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-dashboard'],
    queryFn: () => api.loyalty(),
    staleTime: 60_000,
  })
  if (isLoading || !data?.enabled) return null
  return (
    <div className="space-y-2">
      <h2 className="px-0.5 text-sm font-medium text-muted-foreground">{t('profile.loyaltySection')}</h2>
      <LoyaltyCompactCard />
    </div>
  )
}

/** Компактная плашка для профиля / подписки */
export function LoyaltyCompactCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-dashboard'],
    queryFn: () => api.loyalty(),
    staleTime: 60_000,
  })

  if (isLoading || !data?.enabled) return null

  const discount = data.current?.discount_percent ?? 0

  return (
    <Link
      to="/loyalty"
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-border bg-card/80 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Gem size={16} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t('loyaltyPage.compactTitle', { n: data.current?.sort_order ?? 0 })}</p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.min(100, Math.max(0, data.progress_percent))}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t('loyaltyPage.compactDiscount', { pct: discount })}</p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
