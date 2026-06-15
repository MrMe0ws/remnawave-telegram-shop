export type StatsCardAccent =
  | 'blue'
  | 'emerald'
  | 'violet'
  | 'purple'
  | 'pink'
  | 'indigo'
  | 'slate'
  | 'fuchsia'

export const statsCardAccentStyles: Record<
  StatsCardAccent,
  { boxClassName: string; iconClassName: string }
> = {
  blue: { boxClassName: 'bg-blue-500/10 dark:bg-blue-500/20', iconClassName: 'text-blue-500' },
  emerald: {
    boxClassName: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    iconClassName: 'text-emerald-500',
  },
  violet: {
    boxClassName: 'bg-violet-500/10 dark:bg-violet-500/20',
    iconClassName: 'text-violet-500',
  },
  purple: {
    boxClassName: 'bg-purple-500/10 dark:bg-purple-500/20',
    iconClassName: 'text-purple-500',
  },
  pink: { boxClassName: 'bg-pink-500/10 dark:bg-pink-500/20', iconClassName: 'text-pink-500' },
  indigo: {
    boxClassName: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    iconClassName: 'text-indigo-500',
  },
  slate: { boxClassName: 'bg-slate-500/10 dark:bg-slate-500/20', iconClassName: 'text-slate-400' },
  fuchsia: {
    boxClassName: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/20',
    iconClassName: 'text-fuchsia-500',
  },
}
