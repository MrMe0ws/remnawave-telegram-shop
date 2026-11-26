import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '@/components/ui/toast'
import { hapticSuccess } from '@/lib/haptic'

import { formatAdminApiError } from '../utils/formatAdminApiError'

/**
 * Результат действий в админке — общим тостом кабинета (`components/ui/toast.tsx`),
 * а не баннером `AdminFeedback`: везде одно и то же уведомление.
 *
 * Ошибка API превращается в текст через `formatAdminApiError`. Успех вибрирует
 * явно — тост сам вибрирует только на ошибке (как раньше делал баннер).
 *
 * Хелперы берут ровно один аргумент: их передают прямо в `onError`/`onSaved`, и вторым
 * аргументом там приходят переменные мутации. Нужны кнопка или описание — `useToast()`.
 */
export function useAdminToast() {
  const { t } = useTranslation()
  const toast = useToast()

  // Строка — уже готовый текст (например, от модалки), остальное — ошибка API.
  const showError = useCallback(
    (err: unknown) => {
      toast.error(typeof err === 'string' ? err : formatAdminApiError(err, t))
    },
    [toast, t],
  )

  const showSuccess = useCallback(
    (message: string) => {
      hapticSuccess()
      toast.success(message)
    },
    [toast],
  )

  const showInfo = useCallback(
    (message: string) => {
      toast.info(message)
    },
    [toast],
  )

  /** `{ onSuccess, onError }` для `mutate(…, handlers('Готово'))`. */
  const handlers = useCallback(
    (successMessage?: string) => ({
      onSuccess: () => {
        if (successMessage) showSuccess(successMessage)
      },
      onError: (err: unknown) => showError(err),
    }),
    [showError, showSuccess],
  )

  return useMemo(() => ({ showError, showSuccess, showInfo, handlers }), [showError, showSuccess, showInfo, handlers])
}

/** Сколько висит тост «удалено — Отменить», прежде чем запрос уйдёт на сервер. */
const UNDO_MS = 6000

/**
 * Удаление с отменой: строка сразу пропадает из списка, а запрос уходит, когда тост
 * закрылся не через «Отменить» (истёк таймер, ✕, вытеснен другим тостом).
 * Если сервер отказал — строка возвращается и показывается ошибка.
 */
export function useAdminUndoRemove() {
  const { t } = useTranslation()
  const toast = useToast()
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())

  const unhide = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const remove = useCallback(
    (id: string, run: () => Promise<unknown>, title: string, description?: string) => {
      setHidden((prev) => new Set(prev).add(id))
      toast.info(title, {
        description,
        durationMs: UNDO_MS,
        action: { label: t('admin.feedback.undo'), onClick: () => unhide(id) },
        onDismiss: (reason) => {
          if (reason === 'action') return
          run()
            .catch((err) => {
              toast.error(formatAdminApiError(err, t))
            })
            // Успех: список уже перезапрошен мутацией, строки там нет. Ошибка: строку возвращаем.
            .finally(() => unhide(id))
        },
      })
    },
    [toast, t, unhide],
  )

  const isHidden = useCallback((id: string) => hidden.has(id), [hidden])

  return { remove, isHidden }
}
