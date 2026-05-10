import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { readOnboardingCompleted, writeOnboardingCompleted } from './cabinetOnboardingStorage'

const OVERLAY_Z = 2800
const POPOVER_Z = OVERLAY_Z + 10

/** Затемнение фона при гайде (как в референсе — не «убиваем» экран). */
const OVERLAY_SCRIM = '#0000005c'

const ALLOWED_PATHS = new Set(['/dashboard', '/subscription'])

type Step = 1 | 2 | 3

type PopoverGeom = {
  top: number
  left: number
  width: number
  arrowOffset: number
  arrowOnTop: boolean
} | null

function measureProfileNavTarget(): HTMLElement | null {
  const mobile = window.matchMedia('(max-width: 639px)').matches
  return (
    document.getElementById(mobile ? 'cabinet-onboarding-profile-nav-mobile' : 'cabinet-onboarding-profile-nav-desktop')
  )
}

function computePopoverGeom(target: HTMLElement, popoverWidth: number): PopoverGeom {
  const rect = target.getBoundingClientRect()
  const margin = 12
  const estimatedPopoverH = 260
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(popoverWidth, vw - margin * 2)

  const cx = rect.left + rect.width / 2
  let left = cx - width / 2
  left = Math.max(margin, Math.min(left, vw - width - margin))

  const spaceBelow = vh - rect.bottom - margin
  const spaceAbove = rect.top - margin
  let arrowOnTop = true
  let top = rect.bottom + margin

  if (spaceBelow < estimatedPopoverH && spaceAbove > spaceBelow) {
    arrowOnTop = false
    top = rect.top - margin - estimatedPopoverH
  }

  top = Math.max(margin, Math.min(top, vh - estimatedPopoverH - margin))

  const arrowOffset = Math.max(28, Math.min(width - 28, cx - left))

  return { top, left, width, arrowOffset, arrowOnTop }
}

export function CabinetOnboarding() {
  const { t } = useTranslation()
  const location = useLocation()
  const [completed, setCompleted] = useState(() => readOnboardingCompleted())
  const [step, setStep] = useState<Step>(1)
  const [geom, setGeom] = useState<PopoverGeom>(null)
  const [fallbackCenter, setFallbackCenter] = useState(false)
  const [tick, setTick] = useState(0)

  const active = useMemo(
    () => !completed && ALLOWED_PATHS.has(location.pathname),
    [completed, location.pathname],
  )

  const updateGeometry = useCallback(() => {
    if (!active) {
      setGeom(null)
      return
    }
    const stepTargetId =
      step === 1 ? 'cabinet-onboarding-step1-target' : step === 2 ? 'cabinet-onboarding-step2-target' : null
    let el: HTMLElement | null = null
    if (step === 3) {
      el = measureProfileNavTarget()
    } else if (stepTargetId) {
      el = document.getElementById(stepTargetId)
    }
    if (!el) {
      setGeom(null)
      return
    }
    setGeom(computePopoverGeom(el, 340))
    setFallbackCenter(false)
  }, [active, step])

  useLayoutEffect(() => {
    updateGeometry()
  }, [updateGeometry, location.pathname, tick])

  useEffect(() => {
    if (!active) return
    function onResize() {
      setTick((x) => x + 1)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    const id = window.setInterval(onResize, 350)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
      window.clearInterval(id)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(() => setTick((x) => x + 1), 100)
    return () => window.clearTimeout(id)
  }, [active, step, location.pathname])

  useEffect(() => {
    if (!active || geom) {
      setFallbackCenter(false)
      return
    }
    const id = window.setTimeout(() => setFallbackCenter(true), 700)
    return () => window.clearTimeout(id)
  }, [active, geom, step, location.pathname])

  function finish() {
    writeOnboardingCompleted()
    setCompleted(true)
    setGeom(null)
    setFallbackCenter(false)
  }

  function skip() {
    finish()
  }

  if (!active || completed) return null

  const meta = {
    title: t(`onboarding.step${step}.title`),
    body: t(`onboarding.step${step}.body`),
  }

  const fallbackStyle: CSSProperties = {
    position: 'fixed',
    zIndex: POPOVER_Z,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(340px, calc(100vw - 2rem))',
  }

  const showPopover = geom || fallbackCenter

  const panelChrome = cn(
    'relative overflow-visible rounded-[18px] border shadow-xl',
    'border-primary/35 bg-card text-card-foreground',
    'shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)]',
    'dark:border-primary/45 dark:bg-[#151d2f]/98 dark:text-white',
    'dark:shadow-[0_14px_48px_-10px_rgba(0,0,0,0.55)]',
  )

  const panelScroll = 'max-h-[min(440px,calc(100vh-2rem))] overflow-y-auto overscroll-contain p-5'

  const portal = (
    <div className="pointer-events-auto fixed inset-0" style={{ zIndex: OVERLAY_Z }}>
      <div className="absolute inset-0" style={{ backgroundColor: OVERLAY_SCRIM }} aria-hidden />
      {showPopover && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cabinet-onboarding-title"
          className={cn('fixed', panelChrome)}
          style={
            geom
              ? { zIndex: POPOVER_Z, top: geom.top, left: geom.left, width: geom.width }
              : fallbackCenter
                ? fallbackStyle
                : undefined
          }
        >
          {/* Стрелка к якорю (вверх — модалка под целью) */}
          {geom && geom.arrowOnTop && (
            <div
              className="pointer-events-none absolute z-[1] -translate-x-1/2"
              style={{ left: geom.arrowOffset, top: -7 }}
              aria-hidden
            >
              <div
                className={cn(
                  'h-3.5 w-3.5 rotate-45 border-l border-t',
                  'border-primary/40 bg-card dark:border-primary/50 dark:bg-[#151d2f]',
                )}
              />
            </div>
          )}
          {/* Стрелка вниз — модалка над целью */}
          {geom && !geom.arrowOnTop && (
            <div
              className="pointer-events-none absolute z-[1] -translate-x-1/2 translate-y-1/2"
              style={{ left: geom.arrowOffset, bottom: -7 }}
              aria-hidden
            >
              <div
                className={cn(
                  'h-3.5 w-3.5 rotate-45 border-r border-b',
                  'border-primary/40 bg-card dark:border-primary/50 dark:bg-[#151d2f]',
                )}
              />
            </div>
          )}

          <div className={panelScroll}>
          <div className="relative mb-4 flex gap-1.5">
            {([1, 2, 3] as const).map((s) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  s <= step ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.45)]' : 'bg-muted dark:bg-white/12',
                )}
              />
            ))}
          </div>
          <h2
            id="cabinet-onboarding-title"
            className="text-lg font-semibold leading-snug tracking-tight text-foreground dark:text-white"
          >
            {meta.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground dark:text-slate-300">{meta.body}</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-4 dark:border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-white"
              onClick={skip}
            >
              {t('onboarding.skip')}
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {step > 1 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : 1))}>
                  {t('onboarding.back')}
                </Button>
              ) : null}
              {step < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  className="shadow-[0_4px_24px_-6px_hsl(var(--primary)/0.55)] dark:shadow-[0_4px_28px_-4px_hsl(var(--primary)/0.45)]"
                  onClick={() => setStep((s) => (s < 3 ? ((s + 1) as Step) : 3))}
                >
                  {t('onboarding.next')}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="shadow-[0_4px_24px_-6px_hsl(var(--primary)/0.55)] dark:shadow-[0_4px_28px_-4px_hsl(var(--primary)/0.45)]"
                  onClick={finish}
                >
                  {t('onboarding.done')}
                </Button>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(portal, document.body)
}
