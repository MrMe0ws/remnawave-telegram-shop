import { cn } from '@/lib/utils'

import { type RwIconTone, rwIconToneClassNames } from './rwStatusStyles'

export type AccountStatusKey = 'active' | 'expired' | 'trial' | 'disabled' | 'inactive'

export interface UnifiedAccountStatus {
  key: AccountStatusKey
  tone: RwIconTone
  labelKey: string
}

/** Единый статус аккаунта для бейджей и цвета иконок (не привязан к конкретному user id). */
export function unifiedAccountStatus(params: {
  status?: string | null
  rwStatus?: string | null
  expireAt?: string | null
}): UnifiedAccountStatus {
  const rw = params.rwStatus?.toUpperCase()
  const db = params.status?.toLowerCase()

  if (rw === 'DISABLED' || db === 'disabled') {
    return { key: 'disabled', tone: 'danger', labelKey: 'admin.users.rwStatusDisabled' }
  }
  if (db === 'expired' || rw === 'EXPIRED') {
    return { key: 'expired', tone: 'danger', labelKey: 'admin.users.statusExpired' }
  }
  if (params.expireAt != null) {
    const exp = Date.parse(params.expireAt)
    if (!Number.isNaN(exp) && exp <= Date.now()) {
      return { key: 'expired', tone: 'danger', labelKey: 'admin.users.statusExpired' }
    }
  }
  if (db === 'active' || rw === 'ACTIVE') {
    return { key: 'active', tone: 'success', labelKey: 'admin.users.statusActive' }
  }
  if (db === 'trial') {
    return { key: 'trial', tone: 'warning', labelKey: 'admin.users.statusTrial' }
  }
  if (db === 'inactive') {
    return { key: 'inactive', tone: 'default', labelKey: 'admin.users.statusInactive' }
  }

  return { key: 'expired', tone: 'default', labelKey: 'admin.users.statusExpired' }
}

export function accountStatusBadgeClasses(tone: RwIconTone): string {
  const map: Record<RwIconTone, string> = {
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    danger: 'bg-red-500/15 text-red-700 dark:text-red-400',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    default: 'bg-muted text-muted-foreground',
  }
  return cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', map[tone])
}

export function accountStatusHeaderAccent(tone: RwIconTone): 'emerald' | 'rose' | 'amber' | 'slate' {
  switch (tone) {
    case 'success':
      return 'emerald'
    case 'danger':
      return 'rose'
    case 'warning':
      return 'amber'
    default:
      return 'slate'
  }
}

export { rwIconToneClassNames }
