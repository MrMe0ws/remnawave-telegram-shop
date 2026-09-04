import { useEffect, useRef, useState } from 'react'

import { copyToClipboard } from '../../utils/copyToClipboard'

/**
 * Копирование ссылки на подписку с подтверждением прямо на кнопке.
 *
 * Живёт отдельным хуком, потому что кнопок две — в колонке действий на ПК и в
 * нижней панели на телефоне, — а состояние «скопировано» у них общее по смыслу.
 */
export function useCopySubscriptionLink(link: string) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    if (!link) return
    setFailed(false)
    const ok = await copyToClipboard(link)
    if (!ok) {
      setFailed(true)
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return { copied, failed, copy: () => void copy(), available: Boolean(link) }
}
