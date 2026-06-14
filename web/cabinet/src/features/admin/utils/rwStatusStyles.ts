import { cn } from '@/lib/utils'

export type RwIconTone = 'default' | 'success' | 'danger' | 'warning'

export function rwIconToneFromStatus(status?: string | null): RwIconTone {
  const s = status?.toUpperCase()
  if (s === 'ACTIVE') return 'success'
  if (s === 'DISABLED' || s === 'EXPIRED') return 'danger'
  return 'default'
}

const toneClasses: Record<RwIconTone, { box: string; icon: string }> = {
  default: {
    box: 'bg-muted/60',
    icon: 'text-muted-foreground',
  },
  success: {
    box: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  danger: {
    box: 'bg-red-500/15 dark:bg-red-500/20',
    icon: 'text-red-600 dark:text-red-400',
  },
  warning: {
    box: 'bg-amber-500/15 dark:bg-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400',
  },
}

export function rwIconToneClassNames(tone: RwIconTone) {
  const c = toneClasses[tone]
  return {
    boxClassName: c.box,
    iconClassName: c.icon,
  }
}

export function rwStatusBadgeClassName(status?: string | null): string {
  const tone = rwIconToneFromStatus(status)
  if (tone === 'success') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  }
  if (tone === 'danger') {
    return 'bg-red-500/15 text-red-700 dark:text-red-400'
  }
  if (tone === 'warning') {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
  }
  return 'bg-muted text-muted-foreground'
}

export function rwStatusBadgeClasses(status?: string | null) {
  return cn(
    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
    rwStatusBadgeClassName(status),
  )
}
