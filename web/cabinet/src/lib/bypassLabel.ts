import { i18n } from '@/i18n'

/** Название по умолчанию, которое сервер отдаёт, пока админ не задал своё (TRAFFIC_BYPASS_LABEL). */
const SERVER_DEFAULT_LABEL = 'Обход'

/**
 * Как называть серверы обхода в интерфейсе. Заданное админом название показываем как есть;
 * серверное «Обход» по умолчанию в английском интерфейсе заменяем переводом.
 */
export function bypassLabel(label?: string | null): string {
  const l = (label ?? '').trim()
  const fallback = i18n.t('trafficSplit.bypassFallback')
  if (!l) return fallback
  if (l === SERVER_DEFAULT_LABEL && !String(i18n.language ?? '').startsWith('ru')) return fallback
  return l
}
