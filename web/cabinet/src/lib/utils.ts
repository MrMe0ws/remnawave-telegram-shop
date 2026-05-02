import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Читает значение cookie по имени. */
export function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

/** Генерирует UUID v4 для Idempotency-Key. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** Маскирует email: user@example.com → u***@example.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain || local.length <= 1) return email
  return local[0] + '***@' + domain
}

/** Возвращает дни до даты ISO (отрицательное — уже прошло). */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

/** Форматирует дату по локали. */
export function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Формат DD.MM.YYYY HH:mm (локальное время браузера). */
export function formatDateTimeShort(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`
}

/** Форматирует цену в рублях. */
export function formatRub(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽'
}

/** initData из Telegram Mini App (пустая строка в обычном браузере). */
export function getTelegramInitData(): string {
  const raw = window.Telegram?.WebApp?.initData
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * start_param из Mini App (как deep-link бота). Для рефералки обычно ref_<tg>.
 * Не подписан отдельно — доверяем только в связке с проверкой initData на бэкенде;
 * referral_code дублируется в POST явно.
 */
export function getTelegramMiniAppStartParam(): string {
  const u = window.Telegram?.WebApp?.initDataUnsafe
  const sp = u && typeof u === 'object' && u !== null && 'start_param' in u ? (u as { start_param?: unknown }).start_param : undefined
  return typeof sp === 'string' ? sp.trim() : ''
}
