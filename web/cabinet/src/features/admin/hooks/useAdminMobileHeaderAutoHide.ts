import { useEffect } from 'react'

import { useAdminShell } from '../layout/AdminShellContext'

/**
 * Авто-скрытие админ-хедера отключено (см. тот же разбор в AppLayout.tsx).
 *
 * AdminChrome прячет строку шапки через `max-md:hidden` внутри sticky-элемента,
 * который лежит в потоке документа. Каждое переключение меняло высоту документа
 * на ~56px → браузер пересчитывал scrollY → приходил scroll-эвент → хук возвращал
 * шапку → высота росла обратно → снова scroll. Цикл на частоте rAF: шапка мигала.
 * В Telegram Mini App заводился сам собой ещё до касания экрана (анимация
 * requestFullscreen меняет --tg-safe-area-inset-top, контент догружается асинхронно).
 *
 * Хук оставлен как no-op, чтобы не трогать вызовы и вёрстку. Вернуть фичу можно
 * только layout-нейтрально: fixed-шапка + распорка фиксированной высоты и transform,
 * плюс накопительные пороги и «карантин» после resize/изменения высоты документа.
 */
export function useAdminMobileHeaderAutoHide(_enabled: boolean) {
  const { setMobileHeaderVisible } = useAdminShell()

  useEffect(() => {
    setMobileHeaderVisible(true)
  }, [setMobileHeaderVisible])
}
