import { cn } from '@/lib/utils'

export type AdminSectionIconAccent =
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'blue'
  | 'rose'
  | 'indigo'
  | 'cyan'
  | 'orange'
  | 'teal'
  | 'slate'

const accentStyles: Record<AdminSectionIconAccent, { box: string; icon: string }> = {
  violet: {
    box: 'bg-violet-500/15 dark:bg-violet-500/20',
    icon: 'text-violet-600 dark:text-violet-400',
  },
  emerald: {
    box: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    box: 'bg-amber-500/15 dark:bg-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  blue: {
    box: 'bg-blue-500/15 dark:bg-blue-500/20',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  rose: {
    box: 'bg-rose-500/15 dark:bg-rose-500/20',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  indigo: {
    box: 'bg-indigo-500/15 dark:bg-indigo-500/20',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
  cyan: {
    box: 'bg-cyan-500/15 dark:bg-cyan-500/20',
    icon: 'text-cyan-600 dark:text-cyan-400',
  },
  orange: {
    box: 'bg-orange-500/15 dark:bg-orange-500/20',
    icon: 'text-orange-600 dark:text-orange-400',
  },
  teal: {
    box: 'bg-teal-500/15 dark:bg-teal-500/20',
    icon: 'text-teal-600 dark:text-teal-400',
  },
  slate: {
    box: 'bg-slate-500/15 dark:bg-slate-500/20',
    icon: 'text-slate-600 dark:text-slate-400',
  },
}

export function adminSectionIconAccentClassNames(accent: AdminSectionIconAccent) {
  const s = accentStyles[accent]
  return { boxClassName: s.box, iconClassName: s.icon }
}

export function adminSectionIconBoxClass(accent: AdminSectionIconAccent, extra?: string) {
  const { boxClassName } = adminSectionIconAccentClassNames(accent)
  return cn('flex size-8 shrink-0 items-center justify-center rounded-lg', boxClassName, extra)
}
