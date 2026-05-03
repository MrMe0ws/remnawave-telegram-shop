/** Payload колбэка Telegram Login Widget 1.0. */
export type TelegramWidgetUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}
