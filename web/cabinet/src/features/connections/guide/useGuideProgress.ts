import { useCallback, useEffect, useState } from 'react'

export type GuideProgress = {
  /** Открытый шаг: 0 — установка, 1 — подписка, 2 — включение. */
  current: number
  done: [boolean, boolean, boolean]
  finished: boolean
}

const EMPTY: GuideProgress = { current: 0, done: [false, false, false], finished: false }
const PREFIX = 'cabinet:connections-progress:v1:'

function read(key: string): GuideProgress {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return EMPTY
    const v = JSON.parse(raw) as Partial<GuideProgress>
    const current = typeof v.current === 'number' && v.current >= 0 && v.current <= 2 ? v.current : 0
    const done = Array.isArray(v.done) && v.done.length === 3 ? (v.done.map(Boolean) as GuideProgress['done']) : EMPTY.done
    return { current, done, finished: Boolean(v.finished) }
  } catch {
    // Приватный режим или битое значение — просто начинаем сначала.
    return EMPTY
  }
}

function write(key: string, value: GuideProgress) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* хранилище недоступно — прогресс живёт только до перезагрузки */
  }
}

/** Короткий отпечаток токена приглашения: сам токен в хранилище не кладём. */
export function inviteScope(token: string): string {
  let h = 5381
  for (let i = 0; i < token.length; i++) h = ((h << 5) + h + token.charCodeAt(i)) | 0
  return `i${(h >>> 0).toString(36)}`
}

/**
 * Прогресс по шагам для пары «платформа + приложение». Человек уходит в
 * приложение и возвращается — страница открывается на том же шаге.
 */
export function useGuideProgress(key: string) {
  const [entry, setEntry] = useState(() => ({ key, ...read(key) }))

  // Сменилась пара платформа/приложение — подхватываем её собственный прогресс.
  let state = entry
  if (entry.key !== key) {
    state = { key, ...read(key) }
    setEntry(state)
  }

  useEffect(() => {
    if (!entry.key) return
    write(entry.key, { current: entry.current, done: entry.done, finished: entry.finished })
  }, [entry])

  const update = useCallback(
    (fn: (p: GuideProgress) => GuideProgress) => setEntry((prev) => ({ key: prev.key, ...fn(prev) })),
    [],
  )

  const progress: GuideProgress = { current: state.current, done: state.done, finished: state.finished }
  return { progress, update }
}

export const emptyProgress = EMPTY
