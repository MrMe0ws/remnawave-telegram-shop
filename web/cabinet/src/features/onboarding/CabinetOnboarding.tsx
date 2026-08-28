import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { api, SUBSCRIPTION_STALE_MS } from '@/lib/api'
import { cn } from '@/lib/utils'
import { readOnboardingCompleted, writeOnboardingCompleted } from './cabinetOnboardingStorage'

const OVERLAY_Z = 2800
const POPOVER_Z = OVERLAY_Z + 10

/** Затемнение фона при подсказке (как в референсе — не «убиваем» экран). */
const OVERLAY_SCRIM = '#0000005c'

const ALLOWED_PATHS = new Set(['/dashboard', '/subscription'])

/** Кнопка подключения устройства — единственная цель подсказки. */
const TARGET_ID = 'cabinet-onboarding-connect-target'

/**
 * Подсказка «куда нажать, чтобы подключить».
 *
 * Раньше это был тур из трёх шагов, который показывался при первом же заходе
 * в кабинет — до подписки. Из-за этого он врал: второй шаг обещал инструкции
 * по подключению, но подсвечивал кнопку активации пробного периода, потому
 * что подключать было ещё нечего. Третий просил привязать резервный способ
 * входа человеку, который продукт ещё не попробовал.
 *
 * Теперь подсказка одна и появляется только когда подписка уже есть — то
 * есть ровно в тот момент, когда у неё есть смысл. Про резервный вход
 * напоминает тихая строка на главной, она не перекрывает экран.
 */

type PopoverGeom = {
  top: number
  left: number
  width: number
  arrowOffset: number
  arrowOnTop: boolean
} | null

function computePopoverGeom(target: HTMLElement, popoverWidth: number): PopoverGeom {
  const rect = target.getBoundingClientRect()
  const margin = 12
  const estimatedPopoverH = 210
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
  const [geom, setGeom] = useState<PopoverGeom>(null)
  const [fallbackCenter, setFallbackCenter] = useState(false)
  const [tick, setTick] = useState(0)

  /*
   * Тот же ключ, что у дашборда и страницы подписки: запрос переиспользует
   * кэш react-query, лишнего обращения к сети подсказка не делает.
   */
  const { data: sub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.subscription(),
    staleTime: SUBSCRIPTION_STALE_MS,
    retry: 1,
    enabled: !completed && ALLOWED_PATHS.has(location.pathname),
  })

  const hasSubscription = Boolean(
    (sub?.subscription_link && String(sub.subscription_link).trim() !== '') ||
      (sub?.expire_at && String(sub.expire_at).trim() !== ''),
  )

  const active = useMemo(
    () => !completed && hasSubscription && ALLOWED_PATHS.has(location.pathname),
    [completed, hasSubscription, location.pathname],
  )

  const updateGeometry = useCallback(() => {
    if (!active) {
      setGeom(null)
      return
    }
    const el = document.getElementById(TARGET_ID)
    if (!el) {
      setGeom(null)
      return
    }
    setGeom(computePopoverGeom(el, 340))
    setFallbackCenter(false)
  }, [active])

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
  }, [active, location.pathname])

  /*
   * Кнопки может не быть на экране: подключение устройств выключено на
   * инсталляции или разметка ещё не смонтирована. Через 0.7 с показываем
   * подсказку по центру, чтобы она не потерялась вовсе.
   */
  useEffect(() => {
    if (!active || geom) {
      setFallbackCenter(false)
      return
    }
    const id = window.setTimeout(() => setFallbackCenter(true), 700)
    return () => window.clearTimeout(id)
  }, [active, geom, location.pathname])

  function finish() {
    writeOnboardingCompleted()
    setCompleted(true)
    setGeom(null)
    setFallbackCenter(false)
  }

  if (!active || completed) return null

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

  const arrowChrome = cn(
    'h-3.5 w-3.5 rotate-45',
    'border-primary/40 bg-card dark:border-primary/50 dark:bg-[#151d2f]',
  )

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
          {geom && geom.arrowOnTop && (
            <div
              className="pointer-events-none absolute z-[1] -translate-x-1/2"
              style={{ left: geom.arrowOffset, top: -7 }}
              aria-hidden
            >
              <div className={cn(arrowChrome, 'border-l border-t')} />
            </div>
          )}
          {geom && !geom.arrowOnTop && (
            <div
              className="pointer-events-none absolute z-[1] -translate-x-1/2 translate-y-1/2"
              style={{ left: geom.arrowOffset, bottom: -7 }}
              aria-hidden
            >
              <div className={cn(arrowChrome, 'border-b border-r')} />
            </div>
          )}

          <div className="max-h-[min(440px,calc(100vh-2rem))] overflow-y-auto overscroll-contain p-5">
            <h2
              id="cabinet-onboarding-title"
              className="text-lg font-semibold leading-snug tracking-tight text-foreground dark:text-white"
            >
              {t('onboarding.connect.title')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground dark:text-slate-300">
              {t('onboarding.connect.body')}
            </p>
            <div className="mt-5 flex items-center justify-end border-t border-border/50 pt-4 dark:border-white/10">
              <Button
                type="button"
                size="sm"
                className="shadow-[0_4px_24px_-6px_hsl(var(--primary)/0.55)] dark:shadow-[0_4px_28px_-4px_hsl(var(--primary)/0.45)]"
                onClick={finish}
              >
                {t('onboarding.gotIt')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(portal, document.body)
}
