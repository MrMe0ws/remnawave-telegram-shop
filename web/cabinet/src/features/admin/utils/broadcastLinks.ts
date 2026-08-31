// Разделы, доступные как кнопки под сообщением рассылки.
// Ключи и порядок должны совпадать с реестром cabinetLinks в internal/broadcast/links.go —
// бэкенд отбрасывает неизвестные ключи с 400 и сам приводит их к своему порядку.
export const BROADCAST_LINK_KEYS = [
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
  'support',
] as const

export type BroadcastLinkKey = (typeof BROADCAST_LINK_KEYS)[number]

// i18n-ключ подписи в админке. Получателю кнопка приходит с подписью из translations/<lang>.json
// (broadcast_link_*) — на его языке, а не на языке админа.
export function broadcastLinkLabelKey(key: BroadcastLinkKey): string {
  return `admin.broadcast.links.${key}`
}
