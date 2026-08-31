// Разделы, доступные как кнопки под сообщением рассылки.
// Ключи и порядок должны совпадать с реестром cabinetLinks в internal/broadcast/links.go —
// бэкенд отбрасывает неизвестные ключи с 400 и сам приводит их к своему порядку.
// Разделы кабинета: кнопка открывает мини-приложение внутри Telegram.
export const CABINET_LINK_KEYS = [
  'dashboard',
  'tariffs',
  'connections',
  'accounts',
  'profile',
  'payments',
  'promocodes',
  'referral',
  'partner',
  'loyalty',
  'fortune',
] as const

// Ссылки наружу: кабинет не открывают. Сейчас это только чат поддержки
// из SUPPORT_URL — он и не раздел, и не действие бота.
export const EXTERNAL_LINK_KEYS = ['support'] as const

export const BROADCAST_LINK_KEYS = [...CABINET_LINK_KEYS, ...EXTERNAL_LINK_KEYS] as const

export type BroadcastLinkKey = (typeof BROADCAST_LINK_KEYS)[number]

// i18n-ключ подписи в админке. Получателю кнопка приходит с подписью из translations/<lang>.json
// (broadcast_link_*) — на его языке, а не на языке админа.
export function broadcastLinkLabelKey(key: BroadcastLinkKey): string {
  return `admin.broadcast.links.${key}`
}
