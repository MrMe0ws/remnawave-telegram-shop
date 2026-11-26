import type { AdminInfraHistoryRecordDTO, AdminInfraOverviewDTO } from '@/lib/types/admin'

/**
 * Модель страницы «Инфраструктура»: нода биллинга с ценой и периодом,
 * срочность оплаты, группы списка. Без React — только расчёты.
 */

export type InfraNode = {
  billingUuid: string
  nodeUuid: string
  providerUuid: string
  name: string
  countryCode: string
  providerName: string
  providerFavicon: string
  providerLoginUrl: string
  nextBillingAt: Date
  price: number | null
  priceSource: 'set' | 'guess' | 'none'
  periodMonths: number
  lastPaidAt: Date | null
  lastPaidAmount: number | null
}

export type Urgency = 'bad' | 'warn' | 'soon' | 'ok'
export type GroupKey = 'overdue' | 'week' | 'month' | 'later'

export const PERIOD_CHOICES = [1, 3, 6, 12] as const

export function buildInfraNodes(o: AdminInfraOverviewDTO): InfraNode[] {
  return (o.billingNodes ?? []).map((n) => {
    const m = o.meta?.[n.nodeUuid]
    return {
      billingUuid: n.uuid,
      nodeUuid: n.nodeUuid,
      providerUuid: n.providerUuid,
      name: n.node?.name || n.nodeUuid,
      countryCode: n.node?.countryCode ?? '',
      providerName: n.provider?.name ?? '',
      providerFavicon: n.provider?.faviconLink ?? '',
      providerLoginUrl: n.provider?.loginUrl ?? '',
      nextBillingAt: new Date(n.nextBillingAt),
      price: m?.price ?? null,
      priceSource: m?.priceSource ?? 'none',
      periodMonths: m?.periodMonths || 1,
      lastPaidAt: m?.lastPaidAt ? new Date(m.lastPaidAt) : null,
      lastPaidAmount: m?.lastPaidAmount ?? null,
    }
  })
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Календарные дни до даты: 0 — сегодня, отрицательное — просрочено. */
export function daysUntil(d: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000)
}

/** Тот же сдвиг, что на сервере: 31.01 + 1 мес = 28.02, а не 03.03. */
export function addMonthsClamped(d: Date, months: number): Date {
  const r = new Date(d)
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + months)
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, last))
  return r
}

export function urgencyOf(days: number): Urgency {
  if (days < 0) return 'bad'
  if (days <= 3) return 'warn'
  if (days <= 7) return 'soon'
  return 'ok'
}

export function groupOf(days: number): GroupKey {
  if (days < 0) return 'overdue'
  if (days <= 7) return 'week'
  if (days <= 31) return 'month'
  return 'later'
}

export type InfraGroup = { key: GroupKey; items: InfraNode[]; sum: number; unknown: number }

export function groupInfraNodes(nodes: InfraNode[], now: Date = new Date()): InfraGroup[] {
  const order: GroupKey[] = ['overdue', 'week', 'month', 'later']
  const map = new Map<GroupKey, InfraGroup>(order.map((k) => [k, { key: k, items: [], sum: 0, unknown: 0 }]))
  ;[...nodes]
    .sort((a, b) => a.nextBillingAt.getTime() - b.nextBillingAt.getTime() || a.name.localeCompare(b.name))
    .forEach((n) => {
      const g = map.get(groupOf(daysUntil(n.nextBillingAt, now)))!
      g.items.push(n)
      if (n.price == null) g.unknown++
      else g.sum += n.price
    })
  return order.map((k) => map.get(k)!).filter((g) => g.items.length)
}

/** Доля прошедшего периода: полоска под датой заполняется к сроку оплаты. */
export function periodProgress(n: InfraNode, now: Date = new Date()): number {
  const total = Math.max(1, n.periodMonths * 30)
  return Math.max(4, Math.min(100, 100 - (daysUntil(n.nextBillingAt, now) / total) * 100))
}

/** Валюта пока одна — доллары, как отдаёт панель. Одно место, чтобы потом сменить. */
export function formatMoney(v: number): string {
  return `$${v.toFixed(2)}`
}

export function localeOf(lang: string | undefined): string {
  return lang?.startsWith('en') ? 'en-GB' : 'ru-RU'
}

export function formatDate(d: Date, lang?: string): string {
  return d.toLocaleDateString(localeOf(lang), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatShortDate(d: Date, lang?: string): string {
  return d.toLocaleDateString(localeOf(lang), { day: '2-digit', month: '2-digit' })
}

/** Ежемесячная стоимость ноды (период 3 мес. — делим на 3). */
export function monthlyCost(n: InfraNode): number {
  return n.price == null ? 0 : n.price / Math.max(1, n.periodMonths)
}

export type InfraStats = {
  weekSum: number
  weekCount: number
  overdueCount: number
  weekUnknown: number
  nextMonthSum: number
  nextMonthCount: number
  nextMonthUnknown: number
  nextMonthDate: Date
  monthlyTotal: number
  /** Что ещё осталось оплатить в текущем месяце (для «оплачено из ~плана»). */
  curMonthDueSum: number
}

export function infraStats(nodes: InfraNode[], now: Date = new Date()): InfraStats {
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  let weekSum = 0
  let weekCount = 0
  let weekUnknown = 0
  let overdueCount = 0
  let nextMonthSum = 0
  let nextMonthCount = 0
  let nextMonthUnknown = 0
  let monthlyTotal = 0
  let curMonthDueSum = 0
  for (const n of nodes) {
    if (n.price != null && n.nextBillingAt.getFullYear() === now.getFullYear() && n.nextBillingAt.getMonth() === now.getMonth()) {
      curMonthDueSum += n.price
    }
    const d = daysUntil(n.nextBillingAt, now)
    monthlyTotal += monthlyCost(n)
    if (d < 0) overdueCount++
    if (d <= 7) {
      weekCount++
      if (n.price == null) weekUnknown++
      else weekSum += n.price
    }
    if (n.nextBillingAt.getFullYear() === nextMonthDate.getFullYear() && n.nextBillingAt.getMonth() === nextMonthDate.getMonth()) {
      nextMonthCount++
      if (n.price == null) nextMonthUnknown++
      else nextMonthSum += n.price
    }
  }
  return { weekSum, weekCount, overdueCount, weekUnknown, nextMonthSum, nextMonthCount, nextMonthUnknown, nextMonthDate, monthlyTotal, curMonthDueSum }
}

/** Записи истории по месяцам, новые сверху. */
export function groupHistoryByMonth(records: AdminInfraHistoryRecordDTO[]): { key: string; date: Date; items: AdminInfraHistoryRecordDTO[]; total: number }[] {
  const map = new Map<string, { key: string; date: Date; items: AdminInfraHistoryRecordDTO[]; total: number }>()
  for (const r of [...records].sort((a, b) => +new Date(b.billedAt) - +new Date(a.billedAt))) {
    const d = new Date(r.billedAt)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let g = map.get(key)
    if (!g) {
      g = { key, date: new Date(d.getFullYear(), d.getMonth(), 1), items: [], total: 0 }
      map.set(key, g)
    }
    g.items.push(r)
    g.total += r.amount
  }
  return [...map.values()]
}

/** Дата оплаты «в полдень» выбранного дня — чтобы смена часового пояса не перекинула её на соседний день. */
export function noonOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
}
