import { useEffect, useRef, useState } from 'react'

/**
 * Держит «занято» не меньше `minMs`: быстрый запрос иначе даёт мигание спиннера
 * на долю секунды, и нажатие «Обновить» выглядит так, будто ничего не произошло.
 */
export function useMinBusy(busy: boolean, minMs = 700): boolean {
  const [shown, setShown] = useState(busy)
  const since = useRef<number | null>(busy ? Date.now() : null)

  useEffect(() => {
    if (busy) {
      if (since.current == null) since.current = Date.now()
      setShown(true)
      return
    }
    if (since.current == null) return
    const left = minMs - (Date.now() - since.current)
    const done = () => {
      since.current = null
      setShown(false)
    }
    if (left <= 0) {
      done()
      return
    }
    const id = window.setTimeout(done, left)
    return () => window.clearTimeout(id)
  }, [busy, minMs])

  return shown
}
