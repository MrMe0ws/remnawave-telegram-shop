import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useAnimation } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Ticket, Volume2, VolumeX } from 'lucide-react'

import { AppLayout } from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api, ApiError, type FortuneStatusResponse } from '@/lib/api'
import {
  ensureFortuneAudio,
  playSpinAnticipation,
  playSpinError,
  playWinFanfare,
  scheduleSpinWheelSounds,
} from '@/features/fortune/fortuneWheelAudio'
import { FortunePossiblePrizes } from '@/features/fortune/FortunePossiblePrizes'
import { FortunePrizeModal } from '@/features/fortune/FortunePrizeModal'
import {
  buildWheelConicGradient,
  type FortuneDesignVariant,
  sortFortuneSectorsByIndex,
} from '@/features/fortune/fortunePrizeVisuals'
import {
  nextSpinRotation,
  sectorIndexUnderPointer,
  sectorCenterDeg,
  spinVisualEase,
} from '@/features/fortune/fortuneWheelGeometry'
import { FortuneWheelFace } from '@/features/fortune/FortuneWheelFace'
import { WheelWinAnimation } from '@/features/fortune/WheelWinAnimation'

const FORTUNE_SOUND_MUTED_KEY = 'cabinet-fortune-sound-muted'
/** Длительность прокрута колеса (CSS transition и звук тиков). */
const FORTUNE_SPIN_MS = 4200
/** Вспышка/конфетти и задержка модалки «что выиграли». */
const FORTUNE_WIN_CELEBRATION_MS = 1500

type SpinTweenSnapshot = {
  from: number
  to: number
  n: number
  t0: number
  sectorTypes: string[]
}

function readFortuneSoundMuted(): boolean {
  try {
    return window.localStorage.getItem(FORTUNE_SOUND_MUTED_KEY) === '1'
  } catch {
    return false
  }
}

/** Момент следующей полуночи UTC (мс с epoch). */
function nextUtcMidnightMs(): number {
  const n = new Date()
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1, 0, 0, 0, 0)
}

function useUtcMidnightCountdown(active: boolean): number {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    if (!active) {
      setMs(0)
      return undefined
    }
    const tick = () => setMs(Math.max(0, nextUtcMidnightMs() - Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [active])
  return ms
}

function formatCountdownHms(
  ms: number,
  t: (key: string, opts: Record<string, string | number>) => string,
): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return t('fortune.countdownHms', {
    h,
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
  })
}

export default function FortunePage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const spinSoundRef = useRef<{ clear: () => void } | null>(null)
  const [soundMuted, setSoundMuted] = useState(readFortuneSoundMuted)
  const soundMutedRef = useRef(soundMuted)
  soundMutedRef.current = soundMuted
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [lastResult, setLastResult] = useState<{ type: string; value: number; free: boolean } | null>(null)
  const [showPrizeModal, setShowPrizeModal] = useState(false)
  const [spinError, setSpinError] = useState<string | null>(null)
  /** Иконка в центре колеса: приз под стрелкой во время/после спина; `null` — дефолтная звезда. */
  const [hubRewardType, setHubRewardType] = useState<string | null>(null)
  const spinTweenRef = useRef<SpinTweenSnapshot | null>(null)
  const lastWinnerRewardRef = useRef<string | null>(null)
  const [winnerIndex, setWinnerIndex] = useState(0)
  const [winCelebration, setWinCelebration] = useState(false)
  const designVariant: FortuneDesignVariant = 'classic'
  const wheelFxControls = useAnimation()
  /** Подсказка по метрикам в шапке: платные спины / дни подписки */
  const [statsHint, setStatsHint] = useState<null | 'paid' | 'subscription'>(null)
  const statsHintClusterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      spinSoundRef.current?.clear()
      spinSoundRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!spinning) return undefined
    const snap = spinTweenRef.current
    if (!snap || snap.n <= 0 || snap.sectorTypes.length === 0) return undefined

    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - snap.t0
      const u = Math.min(1, elapsed / FORTUNE_SPIN_MS)
      const eased = spinVisualEase(u)
      const currentR = snap.from + (snap.to - snap.from) * eased
      const idx = sectorIndexUnderPointer(currentR, snap.n)
      const rt = snap.sectorTypes[idx]
      if (rt) setHubRewardType(rt)
      if (u < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spinning])

  const setMutedPersist = (muted: boolean) => {
    setSoundMuted(muted)
    try {
      window.localStorage.setItem(FORTUNE_SOUND_MUTED_KEY, muted ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const { data: status, isLoading, error } = useQuery({
    queryKey: ['fortune', 'status'],
    queryFn: () => api.fortuneStatus(),
  })

  const spinMut = useMutation({
    mutationFn: () => api.fortuneSpin(),
    onSuccess: async (res) => {
      setLastResult({ type: res.reward_type, value: res.reward_value, free: res.is_free_spin })
      setShowPrizeModal(false)
      const fresh = qc.getQueryData<FortuneStatusResponse>(['fortune', 'status'])
      const n = fresh?.sectors?.length ?? status?.sectors?.length ?? 10
      const target = nextSpinRotation({
        currentRotation: rotation,
        sectorIndex: res.sector_index,
        sectorCount: n,
        fullSpins: 5,
      })
      const sectorTypes = sortFortuneSectorsByIndex(fresh?.sectors ?? status?.sectors ?? []).map((s) => s.reward_type)
      spinTweenRef.current = {
        from: rotation,
        to: target,
        n,
        t0: performance.now(),
        sectorTypes,
      }
      lastWinnerRewardRef.current = res.reward_type
      setWinnerIndex(res.sector_index)
      setSpinning(true)
      setRotation(target)

      spinSoundRef.current?.clear()
      if (!soundMutedRef.current) {
        void ensureFortuneAudio().then((ctx) => {
          if (!ctx) return
          spinSoundRef.current = scheduleSpinWheelSounds(ctx, FORTUNE_SPIN_MS, () => {
            playWinFanfare(ctx, res.reward_type)
          })
        })
      }

      window.setTimeout(() => {
        setSpinning(false)
        setHubRewardType(lastWinnerRewardRef.current)
        setWinCelebration(true)
        const nSafe = Math.max(1, n)
        const c = sectorCenterDeg(res.sector_index, nSafe)
        const finalPointer = -90 + (rotation + (target - rotation)) * -1 + 90
        const overshootDeg = Math.max(2.2, Math.min(6.5, Math.abs(((finalPointer - c) % 360) * 0.03)))
        void wheelFxControls.start({
          rotate: [0, overshootDeg, -overshootDeg * 0.44, 0],
          transition: { duration: 0.72, times: [0, 0.34, 0.7, 1], ease: [0.22, 1, 0.36, 1] },
        })
        void wheelFxControls.start({
          x: [0, -2, 2, -1, 1, 0],
          y: [0, 1, -1, 1, 0],
          transition: { duration: 0.5, ease: 'easeInOut' },
        })
        window.setTimeout(() => setWinCelebration(false), FORTUNE_WIN_CELEBRATION_MS)
        window.setTimeout(() => setShowPrizeModal(true), FORTUNE_WIN_CELEBRATION_MS)
        void qc.invalidateQueries({ queryKey: ['fortune', 'status'] })
        void qc.invalidateQueries({ queryKey: ['subscription'] })
        void qc.invalidateQueries({ queryKey: ['loyalty-dashboard'] })
        void qc.invalidateQueries({ queryKey: ['promocodes-state'] })
      }, FORTUNE_SPIN_MS)
    },
    onError: (e: unknown) => {
      if (!soundMutedRef.current) {
        void ensureFortuneAudio().then((ctx) => {
          if (ctx) playSpinError(ctx)
        })
      }
      if (e instanceof ApiError && e.status === 400) {
        try {
          const j = JSON.parse(e.body) as { code?: string; error?: string }
          const code = j.code ?? 'unknown'
          setSpinError(t(`fortune.reason.${code}`, { defaultValue: j.error ?? e.message }))
          return
        } catch {
          setSpinError(e.message)
          return
        }
      }
      setSpinError(t('common.error'))
    },
  })

  const orderedSectors = useMemo(() => sortFortuneSectorsByIndex(status?.sectors ?? []), [status?.sectors])
  const gradient = useMemo(
    () => buildWheelConicGradient(orderedSectors, designVariant),
    [orderedSectors, designVariant],
  )

  const reasonText = useMemo(() => {
    if (!status || status.can_spin) return null
    const c = status.reason_code ?? 'unknown'
    return t(`fortune.reason.${c}`, { defaultValue: c })
  }, [status, t])

  const canPress =
    Boolean(status?.enabled && status?.panel_ready && status?.can_spin && !spinning && !spinMut.isPending)

  const spinCostDays = Math.max(1, status?.spin_cost_days ?? 1)

  const spinButtonLabel = useMemo(() => {
    if (spinning || spinMut.isPending) return t('fortune.spinning')
    if (status?.daily_free_available) return t('fortune.spinButtonFree')
    return t('fortune.spinButtonPaid', { count: spinCostDays })
  }, [spinning, spinMut.isPending, status?.daily_free_available, spinCostDays, t])

  const rawRemainDays = status?.subscription_remain_days
  const subscriptionDaysLeft =
    status == null
      ? 0
      : typeof rawRemainDays === 'number' && rawRemainDays > 0
        ? rawRemainDays
        : Math.max(0, Math.ceil((status.subscription_remain_hours ?? 0) / 24))

  const paidSpinsLeft = useMemo(() => {
    if (!status?.enabled || !status.panel_ready) return 0
    const max = Math.max(0, status.max_spins_per_day ?? 0)
    const used = Math.max(0, status.spins_used_today ?? 0)
    return Math.max(0, max - used)
  }, [status?.enabled, status?.panel_ready, status?.max_spins_per_day, status?.spins_used_today])

  useEffect(() => {
    if (!statsHint) return undefined
    const onPointerDown = (e: PointerEvent) => {
      const root = statsHintClusterRef.current
      if (root && !root.contains(e.target as Node)) setStatsHint(null)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStatsHint(null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [statsHint])

  const showNextFreeTimer = Boolean(
    status?.enabled && status?.panel_ready && status?.daily_free_enabled && status?.daily_free_available === false,
  )
  const nextFreeCountdownMs = useUtcMidnightCountdown(showNextFreeTimer)

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-5xl space-y-4 md:space-y-6 pt-2 pb-[max(1rem,calc(5.75rem+env(safe-area-inset-bottom)))] md:px-0 md:pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('fortune.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('fortune.subtitle', { count: spinCostDays })}
            </p>
          </div>
          {status?.enabled && status?.panel_ready && (
            <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <div className="flex flex-row items-center justify-end gap-2">
                <div ref={statsHintClusterRef} className="relative">
                  <div
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border/80 bg-card/60 px-1.5 py-1 text-sm tabular-nums shadow-sm backdrop-blur-sm dark:bg-card/40"
                    aria-label={t('fortune.statsCompactAria')}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-foreground outline-none ring-offset-background transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:ring-offset-background"
                      aria-expanded={statsHint === 'paid'}
                      aria-controls="fortune-stats-hint"
                      onClick={() => setStatsHint((h) => (h === 'paid' ? null : 'paid'))}
                    >
                      <Ticket className="size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                      <span className="font-semibold">{paidSpinsLeft}</span>
                    </button>
                    <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-foreground outline-none ring-offset-background transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:ring-offset-background"
                      aria-expanded={statsHint === 'subscription'}
                      aria-controls="fortune-stats-hint"
                      onClick={() => setStatsHint((h) => (h === 'subscription' ? null : 'subscription'))}
                    >
                      <CalendarDays className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      <span className="font-semibold">
                        {subscriptionDaysLeft}
                        {t('fortune.daysShortSuffix')}
                      </span>
                    </button>
                  </div>
                  {statsHint && (
                    <div
                      id="fortune-stats-hint"
                      role="tooltip"
                      className="animate-fade-in absolute right-0 top-[calc(100%+6px)] z-50 max-w-[min(288px,calc(100vw-2rem))] rounded-lg border border-border bg-card px-3 py-2 text-left text-xs leading-snug text-card-foreground shadow-lg"
                    >
                      {statsHint === 'paid'
                        ? t('fortune.paidSpinsLeftHint')
                        : t('fortune.subscriptionDaysHint')}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-pressed={soundMuted}
                  aria-label={soundMuted ? t('fortune.soundEnableHint') : t('fortune.soundDisableHint')}
                  title={soundMuted ? t('fortune.soundEnableHint') : t('fortune.soundDisableHint')}
                  onClick={() => {
                    const next = !soundMuted
                    setMutedPersist(next)
                    if (!next) {
                      void ensureFortuneAudio().catch(() => {})
                    }
                  }}
                >
                  {soundMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </Button>
              </div>
              {showNextFreeTimer && (
                <p className="text-right text-xs leading-snug text-muted-foreground">
                  <span className="mr-1.5 align-middle">{t('fortune.nextFreeIn')}</span>
                  <span className="inline-block align-middle font-semibold tabular-nums text-foreground">
                    {formatCountdownHms(nextFreeCountdownMs, t)}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {error && <p className="text-sm text-destructive">{t('common.error')}</p>}

        {status && !status.enabled && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">{t('fortune.moduleOff')}</CardContent>
          </Card>
        )}

        {status?.enabled && !status.panel_ready && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">{t('fortune.noPanel')}</CardContent>
          </Card>
        )}

        {status?.enabled && status.panel_ready && (
          <>
            <div className="relative mx-auto flex w-full max-w-[min(calc(100vw-1.5rem),500px)] flex-col items-center gap-4 sm:max-w-[min(100%,520px)] md:max-w-[min(100%,560px)]">
              <div
                className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 drop-shadow-md"
                aria-hidden
              >
                <div className="size-0 border-x-[14px] border-x-transparent border-t-[20px] border-t-[rgb(2,132,199)] dark:border-t-[rgb(81,193,245)]" />
              </div>
              <motion.div className="relative aspect-square w-full overflow-hidden rounded-full" animate={wheelFxControls}>
                <FortuneWheelFace
                  sectors={orderedSectors}
                  rotationDeg={rotation}
                  spinning={spinning || spinMut.isPending}
                  spinMs={FORTUNE_SPIN_MS}
                  gradient={gradient}
                  designVariant={designVariant}
                  t={t}
                  hubRewardType={hubRewardType}
                />
                <WheelWinAnimation
                  active={winCelebration}
                  prize={lastResult?.type ?? null}
                  amount={lastResult?.value ?? 0}
                  winnerIndex={winnerIndex}
                  sectorCount={orderedSectors.length}
                  designVariant={designVariant}
                />
              </motion.div>

              {status.daily_free_enabled && status.daily_free_available && (
                <p className="text-center text-xs font-medium text-[rgb(2,132,199)] dark:text-[rgb(81,193,245)]">
                  {t('fortune.dailyFreeHint')}
                </p>
              )}

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto min-w-[200px]"
                  disabled={!canPress}
                  onClick={() => {
                    setSpinError(null)
                    setShowPrizeModal(false)
                    if (!soundMutedRef.current) {
                      void ensureFortuneAudio().then((ctx) => {
                        if (ctx) playSpinAnticipation(ctx)
                      })
                    }
                    spinMut.mutate()
                  }}
                >
                  {spinButtonLabel}
                </Button>
              </div>

              {reasonText && !status.can_spin && (
                <p className="text-center text-sm text-muted-foreground">{reasonText}</p>
              )}
              {spinError && <p className="text-center text-sm text-destructive">{spinError}</p>}
            </div>

            <FortunePossiblePrizes sectors={orderedSectors} t={t} />
          </>
        )}
      </div>

      {lastResult && (
        <FortunePrizeModal
          open={showPrizeModal}
          rewardType={lastResult.type}
          rewardValue={lastResult.value}
          wasFree={lastResult.free}
          onClaim={() => setShowPrizeModal(false)}
        />
      )}
    </AppLayout>
  )
}
