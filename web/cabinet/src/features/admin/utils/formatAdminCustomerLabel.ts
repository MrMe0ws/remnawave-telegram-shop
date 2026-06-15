export interface AdminCustomerLabelInput {
  telegram_username?: string | null
  nickname?: string | null
  customer_id?: number | null
}

/** @username → nickname → #shopId */
export function formatAdminCustomerLabel(input: AdminCustomerLabelInput): string {
  const username = input.telegram_username?.trim().replace(/^@+/, '')
  if (username) return `@${username}`

  const nickname = input.nickname?.trim()
  if (nickname) return nickname

  if (input.customer_id != null) return `#${input.customer_id}`

  return '—'
}
