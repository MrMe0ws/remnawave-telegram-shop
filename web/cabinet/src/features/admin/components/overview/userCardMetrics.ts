import { daysUntil } from '@/lib/utils'
import type { AdminCustomerDTO, AdminUserPanelDTO } from '@/lib/types/admin'

const GB = 1024 * 1024 * 1024

/**
 * Числа карточки пользователя, собранные в одном месте.
 *
 * Раньше каждый блок считал их сам, и «2 из 2» в плитке жило отдельно от
 * «2 из 2» в строке состояния: расходились они молча. Здесь один источник —
 * панель Remnawave, с падением на данные бота там, где панели нет.
 */
export interface UserCardMetrics {
  /** Срок из панели, а при её отсутствии — из БД бота. */
  expireAt: string | null
  /** Дней до конца подписки; отрицательное — просрочено. */
  days: number | null
  trafficUsedGb: number
  /** 0 — безлимит. */
  trafficLimitGb: number
  /** Доля израсходованного, 0–100; null при безлимите. */
  trafficPercent: number | null
  devicesUsed: number
  devicesLimit: number
  devicesFull: boolean
  squadNames: string[]
}

export function buildUserCardMetrics(params: {
  user: AdminCustomerDTO
  panel?: AdminUserPanelDTO | null
  devicesUsed: number
}): UserCardMetrics {
  const rw = params.panel?.rw
  const expireAt = rw?.expire_at ?? params.user.expire_at ?? null

  const trafficUsedGb = rw ? rw.traffic_used_bytes / GB : 0
  const trafficLimitGb = rw && rw.traffic_limit_bytes > 0 ? rw.traffic_limit_bytes / GB : 0
  const devicesLimit = rw?.hwid_device_limit ?? 1

  return {
    expireAt,
    days: expireAt ? daysUntil(expireAt) : null,
    trafficUsedGb,
    trafficLimitGb,
    trafficPercent:
      trafficLimitGb > 0 ? Math.min(100, (trafficUsedGb / trafficLimitGb) * 100) : null,
    devicesUsed: params.devicesUsed,
    devicesLimit,
    devicesFull: devicesLimit > 0 && params.devicesUsed >= devicesLimit,
    squadNames: (rw?.active_squads ?? []).map((s) => s.name),
  }
}
