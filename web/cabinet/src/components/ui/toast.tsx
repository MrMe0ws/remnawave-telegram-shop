import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, Info, X } from 'lucide-react'

import { hapticError } from '@/lib/haptic'
import { cn } from '@/lib/utils'

/**
 * Минимальные тосты без внешних зависимостей.
 *
 * До этого в кабинете не было вообще никакого способа сообщить о результате
 * действия: мутации вроде активации триала имели только onSuccess, и при ошибке
 * кнопка просто разблокировалась — пользователь не понимал, сработало или нет.
 *
 * Очередь сообщений, автоскрытие, портал в body. Ошибки живут дольше успеха —
 * их нужно успеть прочитать. Внизу полоска оставшегося времени; пока курсор
 * над тостом, таймер стоит (успеть нажать «Отменить»).
 */

type ToastVariant = 'success' | 'error' | 'info'

/** Необязательная кнопка в тосте — например, «Отменить». Нажатие закрывает тост. */
interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  action?: ToastAction
  /** Вторая строка мельче: подробности под заголовком. */
  description?: string
  /** Своя длительность показа вместо стандартной для варианта. */
  durationMs?: number
  /**
   * Тост закрылся: истёк таймер, нажали ✕ или кнопку действия. Нужен для «удалить с отменой»:
   * удаление выполняется, только если ушли не через «Отменить».
   */
  onDismiss?: (reason: ToastDismissReason) => void
}

export type ToastDismissReason = 'timeout' | 'close' | 'action'

interface Toast {
  id: number
  message: string
  description?: string
  variant: ToastVariant
  action?: ToastAction
  durationMs: number
  onDismiss?: (reason: ToastDismissReason) => void
  paused?: boolean
  /** Тост уходит — ещё в списке, но уже без кликов. */
  leaving?: boolean
}

interface ToastApi {
  success: (message: string, options?: ToastOptions) => void
  error: (message: string, options?: ToastOptions) => void
  info: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const AUTO_HIDE_MS: Record<ToastVariant, number> = {
  success: 3000,
  info: 4000,
  error: 6000,
}

/** Длительность анимации ухода — совпадает с toast-out в tailwind.config. */
const LEAVE_MS = 300

type TimerState = { timer: number; deadline: number; remaining: number }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, TimerState>())

  // Сначала тост уезжает, и только потом пропадает из списка.
  const callbacks = useRef(new Map<number, (reason: ToastDismissReason) => void>())

  const dismiss = useCallback((id: number, reason: ToastDismissReason = 'close') => {
    const st = timers.current.get(id)
    if (st) window.clearTimeout(st.timer)
    const cb = callbacks.current.get(id)
    callbacks.current.delete(id)
    cb?.(reason)
    setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)))
    timers.current.set(id, {
      timer: window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
        timers.current.delete(id)
      }, LEAVE_MS),
      deadline: 0,
      remaining: 0,
    })
  }, [])

  const arm = useCallback(
    (id: number, ms: number) => {
      timers.current.set(id, { timer: window.setTimeout(() => dismiss(id, 'timeout'), ms), deadline: Date.now() + ms, remaining: ms })
    },
    [dismiss],
  )

  const pause = useCallback((id: number) => {
    const st = timers.current.get(id)
    if (!st || !st.deadline) return
    window.clearTimeout(st.timer)
    timers.current.set(id, { ...st, deadline: 0, remaining: Math.max(400, st.deadline - Date.now()) })
    setToasts((prev) => prev.map((toast) => (toast.id === id && !toast.leaving ? { ...toast, paused: true } : toast)))
  }, [])

  const resume = useCallback(
    (id: number) => {
      const st = timers.current.get(id)
      if (!st || st.deadline || !st.remaining) return
      arm(id, st.remaining)
      setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, paused: false } : toast)))
    },
    [arm],
  )

  const push = useCallback(
    (message: string, variant: ToastVariant, options?: ToastOptions) => {
      const text = message.trim()
      if (!text) return
      // Ошибка вибрирует всегда, успех — только там, где его вызвали явно (lib/haptic.ts).
      if (variant === 'error') hapticError()
      const id = nextId.current++
      const durationMs = options?.durationMs ?? AUTO_HIDE_MS[variant]
      if (options?.onDismiss) callbacks.current.set(id, options.onDismiss)
      setToasts((prev) => {
        // Вытесненные из очереди тосты тоже «закрылись» — иначе отложенное удаление не выполнилось бы.
        const dropped = prev.slice(0, Math.max(0, prev.length - 2))
        dropped.forEach((old) => {
          const cb = callbacks.current.get(old.id)
          callbacks.current.delete(old.id)
          const st = timers.current.get(old.id)
          if (st) window.clearTimeout(st.timer)
          timers.current.delete(old.id)
          if (cb) queueMicrotask(() => cb('timeout'))
        })
        return [
        ...prev.slice(-2),
        { id, message: text, description: options?.description?.trim() || undefined, variant, action: options?.action, durationMs },
        ]
      })
      arm(id, durationMs)
    },
    [arm],
  )

  // Снимаем таймеры при размонтировании: иначе setState по уже мёртвому дереву.
  useEffect(() => {
    const pending = timers.current
    const cbs = callbacks.current
    return () => {
      pending.forEach((st) => window.clearTimeout(st.timer))
      pending.clear()
      cbs.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string, options?: ToastOptions) => push(message, 'success', options),
      error: (message: string, options?: ToastOptions) => push(message, 'error', options),
      info: (message: string, options?: ToastOptions) => push(message, 'info', options),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <ToastViewport toasts={toasts} onDismiss={dismiss} onPause={pause} onResume={resume} />,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

/** Вне провайдера возвращает no-op: тост не должен ронять экран, на котором вызван. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  return ctx ?? noopToast
}

const noopToast: ToastApi = {
  success: () => {},
  error: () => {},
  info: () => {},
}

const variantIcon = {
  success: Check,
  error: AlertTriangle,
  info: Info,
} as const

const variantStyle: Record<ToastVariant, { border: string; badge: string; bar: string }> = {
  success: { border: 'border-emerald-500/30', badge: 'bg-emerald-500 text-emerald-950', bar: 'bg-emerald-500/80' },
  error: { border: 'border-destructive/40', badge: 'bg-destructive text-destructive-foreground', bar: 'bg-destructive/80' },
  info: { border: 'border-border', badge: 'bg-primary text-primary-foreground', bar: 'bg-primary/80' },
}

function ToastViewport({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: {
  toasts: Toast[]
  onDismiss: (id: number, reason?: ToastDismissReason) => void
  onPause: (id: number) => void
  onResume: (id: number) => void
}) {
  if (!toasts.length) return null

  return (
    <div
      // Над нижней навигацией на мобильном; на десктопе она скрыта, отступ безвреден.
      className="pointer-events-none fixed inset-x-0 z-[3000] flex flex-col items-center gap-2 px-3 bottom-[calc(5.5rem+max(env(safe-area-inset-bottom,0px),var(--cabinet-tg-safe-bottom)))] sm:bottom-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = variantIcon[toast.variant]
        const style = variantStyle[toast.variant]
        return (
          <div
            key={toast.id}
            onMouseEnter={() => onPause(toast.id)}
            onMouseLeave={() => onResume(toast.id)}
            className={cn(
              'pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-2xl border bg-card/95 py-2.5 pl-3 pr-2 text-sm shadow-xl shadow-black/25 backdrop-blur-md',
              toast.leaving ? 'pointer-events-none animate-toast-out' : 'animate-toast-in',
              style.border,
            )}
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full animate-toast-icon',
                style.badge,
              )}
              aria-hidden
            >
              <Icon className="size-4" strokeWidth={toast.variant === 'success' ? 3 : 2.25} />
            </span>
            <div className="min-w-0 flex-1 py-0.5">
              <p className={cn('leading-snug text-card-foreground', toast.description && 'font-semibold')}>
                {toast.message}
              </p>
              {toast.description ? (
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{toast.description}</p>
              ) : null}
            </div>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick()
                  onDismiss(toast.id, 'action')
                }}
                className="shrink-0 rounded-lg px-2.5 py-1.5 font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="✕"
            >
              <X className="size-3.5" aria-hidden />
            </button>
            {!toast.leaving ? (
              <span
                aria-hidden
                className={cn('absolute bottom-0 left-0 h-0.5 w-full origin-left animate-toast-progress', style.bar)}
                style={{
                  animationDuration: `${toast.durationMs}ms`,
                  animationPlayState: toast.paused ? 'paused' : 'running',
                }}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
